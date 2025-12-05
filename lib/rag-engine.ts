export interface RAGQuery {
  question: string
  context?: string
  maxResults?: number
}

export interface RAGResponse {
  answer: string
  sources: Array<{
    text: string
    similarity: number
    metadata: Record<string, any>
  }>
  confidence: number
}

// Enhanced interfaces for self-reflective system
interface EnhancedQueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: Array<{
    content: string
    source: string
    similarity: number
  }>
  reasoning?: {
    initialThoughts: string
    criticalReview: string
    finalRefinement: string
  }
  qualityMetrics: {
    accuracyScore: number
    completenessScore: number
    clarityScore: number
    confidenceScore: number
    finalRating: number
  }
  tokenUsage: {
    contextTokens: number
    reasoningTokens: number
    responseTokens: number
    totalTokens: number
  }
  groundednessScore?: number // Score 0-1 indicating how well response is grounded in retrieved chunks
  hallucinationDetected?: boolean // Flag indicating if hallucinations were detected
}

interface ProcessingPhase {
  name: string
  tokenBudget: number
  completed: boolean
  result?: any
}

interface QualityGate {
  name: string
  passed: boolean
  issues: string[]
  confidence: number
}

import { AIClient } from "./ai-client"
import { PDFParser } from "./pdf-parser"
import type { TextChunk } from "./advanced-chunking"
import { DEFAULT_EMBEDDING_DIMENSION } from "./vector-dimensions"
import { getTelemetry } from "./telemetry"
import { 
  Guardrails, 
  Evaluations, 
  createQueryEvaluation, 
  storeEvaluation,
  checkRateLimit,
  type QueryEvaluation 
} from "./guardrails"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[] | TextChunk[] // Support both simple strings and rich TextChunk objects
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface QueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: Array<{
    content: string
    source: string
    similarity: number
  }>
}

interface AIConfig {
  provider:
    | "huggingface"
    | "openai"
    | "anthropic"
    | "aiml"
    | "groq"
    | "openrouter"
    | "deepinfra"
    | "deepseek"
    | "googleai"
    | "vertex"
    | "mistral"
    | "perplexity"
    | "xai"
    | "alibaba"
    | "minimax"
    | "fireworks"
    | "cerebras"
    | "replicate"
    | "anyscale"
  apiKey: string
  model: string
  baseUrl?: string
}

// Options for document pre-filtering before vector search
interface RAGFilterOptions {
  /** Author names to include (case-insensitive exact match against document metadata.author) */
  authors?: string[]
  /** Optional date range (inclusive) for filtering by document upload or creation date */
  dateRange?: { start: Date; end: Date }
  /** Restrict search to specific document IDs */
  documentIds?: string[]
  /** Custom metadata tags to include (exact string match in document.metadata.tags array) */
  tags?: string[]
  /** Minimum cosine similarity threshold for a chunk to be kept */
  minSimilarity?: number
}

// Engine status for consistent error handling
export interface RAGEngineStatus {
  initialized: boolean
  degraded: boolean
  degradedReasons: string[]
  connectionHealthy: boolean
  embeddingAvailable: boolean
  textGenerationAvailable: boolean
}

export class RAGEngine {
  private documents: Document[] = []
  private aiClient: AIClient | null = null
  private pdfParser: PDFParser
  private isInitialized = false
  private currentConfig: AIConfig | null = null
  private tokenBudget = 4000 // Default token budget
  private showThinking = false // Option to show/hide thinking process
  
  // Consistent status tracking
  private engineStatus: RAGEngineStatus = {
    initialized: false,
    degraded: false,
    degradedReasons: [],
    connectionHealthy: false,
    embeddingAvailable: false,
    textGenerationAvailable: false
  }

  constructor() {
    this.pdfParser = new PDFParser()
  }
  
  // Get current engine status for consistent error reporting
  getEngineStatus(): RAGEngineStatus {
    return { ...this.engineStatus }
  }

  async initialize(config?: AIConfig): Promise<void> {
    // Reset status at start of initialization
    this.engineStatus = {
      initialized: false,
      degraded: false,
      degradedReasons: [],
      connectionHealthy: false,
      embeddingAvailable: false,
      textGenerationAvailable: false
    }
    
    try {
      if (config) {
        // RAGEngine: Initializing with new config
        this.aiClient = new AIClient(config)
        this.currentConfig = config
      }
      
      if (!this.aiClient) {
        throw new Error("AI client not available - configuration required")
      }
      
      console.log(`RAGEngine: Initializing with AI provider`)
      
      // Test AI client connection first
      console.log("RAGEngine: Testing AI provider connection...")
      const connectionTest = await this.aiClient.testConnection()
      if (!connectionTest) {
        console.warn("RAGEngine: AI provider connection test failed, entering degraded mode")
        this.engineStatus.degraded = true
        this.engineStatus.degradedReasons.push("Connection test failed - provider may be unavailable")
        this.engineStatus.connectionHealthy = false
      } else {
        console.log("RAGEngine: AI provider connection test successful")
        this.engineStatus.connectionHealthy = true
      }

      // Test embedding generation with error handling
      console.log("RAGEngine: Testing embedding generation...")
      try {
        const testEmbedding = await this.aiClient.generateEmbedding("test connection")
        if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
          throw new Error("Invalid embedding response during initialization")
        }
        console.log(`RAGEngine: Embedding test successful, dimension: ${testEmbedding.length}`)
        this.engineStatus.embeddingAvailable = true
      } catch (embeddingError) {
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : "Unknown embedding error"
        console.warn(`RAGEngine: Embedding generation failed: ${errorMessage}`)
        
        // Mark as degraded but continue - will use fallback embeddings
        this.engineStatus.degraded = true
        this.engineStatus.degradedReasons.push(`Embedding unavailable: ${errorMessage}`)
        this.engineStatus.embeddingAvailable = false
        console.warn("RAGEngine: Will use fallback hash-based embeddings")
      }

      // Test text generation - this is critical
      console.log("RAGEngine: Testing text generation...")
      try {
        const testResponse = await this.aiClient.generateText([
          { role: "user", content: "Hi" }
        ])
        if (!testResponse || typeof testResponse !== 'string') {
          throw new Error("Invalid text generation response during initialization")
        }
        console.log("RAGEngine: Text generation test successful")
        this.engineStatus.textGenerationAvailable = true
      } catch (textError) {
        const errorMessage = textError instanceof Error ? textError.message : "Unknown text generation error"
        console.error(`RAGEngine: Text generation failed: ${errorMessage}`)
        this.engineStatus.textGenerationAvailable = false
        this.engineStatus.degradedReasons.push(`Text generation failed: ${errorMessage}`)
        
        // Text generation is essential - fail initialization
        throw new Error(`Text generation is required but failed: ${errorMessage}`)
      }

      // Determine final status
      this.isInitialized = true
      this.engineStatus.initialized = true
      
      if (this.engineStatus.degraded) {
        console.warn("RAGEngine: Initialized in DEGRADED mode:")
        this.engineStatus.degradedReasons.forEach(reason => console.warn(`  - ${reason}`))
      } else {
        console.log("RAGEngine: Initialization completed successfully (FULL mode)")
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown initialization error"
      console.error(`RAGEngine: Initialization failed: ${errorMessage}`)
      
      // Provide specific guidance based on error type
      if (errorMessage.includes("API key") || errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        console.error("RAGEngine: Check your AI provider API key configuration")
      } else if (errorMessage.includes("model") || errorMessage.includes("404")) {
        console.error("RAGEngine: Check your AI model configuration")
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        console.error("RAGEngine: API rate limit exceeded - try again later")
      }
      
      this.isInitialized = false
      this.engineStatus.initialized = false
      throw new Error(`RAG Engine initialization failed: ${errorMessage}`)
    }
  }

  async updateConfig(config: AIConfig) {
    try {
      console.log("Updating RAG Engine configuration")
      await this.initialize(config)

      // Re-generate embeddings for existing documents if provider changed
      if (this.documents.length > 0 && this.aiClient) {
        console.log("Re-generating embeddings for existing documents...")
        for (const document of this.documents) {
          if (document.chunks && document.chunks.length > 0) {
            const plainChunks = this.toPlainChunks(document.chunks as any)
            document.embeddings = await this.aiClient.generateEmbeddings(plainChunks)
          }
        }
        console.log("Embeddings updated for all documents")
      }
    } catch (error) {
      console.error("Failed to update RAG Engine configuration:", error)
      throw error
    }
  }

  /**
   * Generates embeddings for a single string
   * @param text Text to generate embedding for
   * @returns Embedding as a number array
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
    if (!this.isInitialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error("Invalid text input for embedding generation")
      }

      // Generating embedding for text
      const embedding = await this.aiClient.generateEmbedding(text)
      
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Invalid embedding returned from AI client")
      }
      
      // Successfully generated embedding
      return embedding
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown embedding error"
      console.error(`RAGEngine: Embedding generation failed: ${errorMessage}`)
      
      // For critical embedding failures, provide fallback
      if (errorMessage.includes("API")) {
        console.warn("RAGEngine: Using fallback embedding due to provider error")
        // Generate a simple fallback embedding
        return this.generateFallbackEmbedding(text)
      }
      
      throw error
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    console.warn("RAGEngine: Generating fallback embedding")
    
    // Simple hash-based embedding for fallback
    const dimension = DEFAULT_EMBEDDING_DIMENSION
    const embedding = new Array(dimension).fill(0)
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      const index = charCode % dimension
      embedding[index] += charCode * 0.1
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
  }

  async processDocument(file: File): Promise<Document> {
    if (!this.isInitialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

    try {
      // Processing document

      // Extract text from PDF
      const pdfContent = await this.pdfParser.extractText(file)

      // Adaptive chunk sizing based on document length
      const { chunkSize, overlap } = this.getAdaptiveChunkParams(pdfContent.text.length)

      // Chunk the text with adaptive parameters
      const chunks = this.pdfParser.chunkText(pdfContent.text, chunkSize, overlap)
      // Generated chunks

      if (chunks.length === 0) {
        throw new Error("No text chunks could be created from the document")
      }

      // Generate embeddings for all chunks
      // Generating embeddings
      const embeddings = await this.aiClient.generateEmbeddings(chunks)

      if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== chunks.length) {
        throw new Error("Failed to generate embeddings for all chunks")
      }

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: pdfContent.text,
        chunks,
        embeddings,
        uploadedAt: new Date(),
        metadata: {
          ...pdfContent.metadata,
          aiProvider: this.currentConfig?.provider,
          aiModel: this.currentConfig?.model,
        },
      }

      console.log(`Document processed successfully: ${chunks.length} chunks, ${embeddings.length} embeddings`)
      return document
    } catch (error) {
      console.error("Error processing document:", error)
      throw error
    }
  }

  async addDocument(document: Document) {
    try {
      console.log("=== RAG Engine: Adding document ===")
      console.log("Document name:", document.name)
      console.log("Document ID:", document.id)
      
      // Validate document structure
      if (!document || typeof document !== "object") {
        console.error("Invalid document object:", document)
        throw new Error("Invalid document object")
      }

      console.log("Document structure validation:")
      console.log("- Has chunks:", !!document.chunks)
      console.log("- Chunks is array:", Array.isArray(document.chunks))
      console.log("- Chunks length:", document.chunks?.length)
      console.log("- Has embeddings:", !!document.embeddings)
      console.log("- Embeddings is array:", Array.isArray(document.embeddings))
      console.log("- Embeddings length:", document.embeddings?.length)

      if (!document.chunks || !Array.isArray(document.chunks)) {
        console.error("Document chunks are missing or invalid:", document.chunks)
        throw new Error("Document chunks are missing or invalid")
      }

      if (document.chunks.length === 0) {
        console.error("Document has no chunks")
        throw new Error("Document has no chunks")
      }

      console.log("First few chunks preview:")
      document.chunks.slice(0, 3).forEach((chunk, i) => {
        const preview = typeof chunk === 'string' ? chunk.substring(0, 100) : (chunk as any).content?.substring(0, 100) || ''
        console.log(`  Chunk ${i}: ${preview}...`)
      })

      // Check AI client status
      console.log("AI Client status:")
      console.log("- AI Client available:", !!this.aiClient)
      console.log("- RAG Engine initialized:", this.isInitialized)

      // Generate embeddings if they don't exist or are invalid
      if (
        !document.embeddings ||
        !Array.isArray(document.embeddings) ||
        document.embeddings.length !== document.chunks.length
      ) {
        if (!this.aiClient) {
          console.error("AI client not initialized - cannot generate embeddings")
          throw new Error("AI client not initialized")
        }

        console.log("🔄 Generating missing embeddings for document:", document.name)
        console.log("- Need to generate embeddings for", document.chunks.length, "chunks")
        
        try {
          const startTime = Date.now()
          const plainChunks = this.toPlainChunks(document.chunks as any)
          document.embeddings = await this.aiClient.generateEmbeddings(plainChunks)
          const endTime = Date.now()
          console.log(`✅ Embeddings generated successfully in ${endTime - startTime}ms`)
          console.log("- Generated embeddings count:", document.embeddings.length)
          if (document.embeddings.length > 0) {
            console.log("- First embedding dimensions:", document.embeddings[0]?.length)
          }
        } catch (embeddingError) {
          console.error("❌ Failed to generate embeddings:", embeddingError)
          throw new Error(`Failed to generate embeddings: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`)
        }
      } else {
        console.log("✅ Document already has valid embeddings")
        console.log("- Embedding dimensions:", document.embeddings[0]?.length)
      }

      // Validate embeddings
      if (!document.embeddings || document.embeddings.length !== document.chunks.length) {
        console.error("Embedding validation failed:")
        console.error("- Embeddings exist:", !!document.embeddings)
        console.error("- Embeddings length:", document.embeddings?.length)
        console.error("- Chunks length:", document.chunks.length)
        throw new Error("Failed to generate valid embeddings for document")
      }

      // Check if embeddings are properly formatted
      console.log("Validating embedding format...")
      for (let i = 0; i < document.embeddings.length; i++) {
        if (!Array.isArray(document.embeddings[i]) || document.embeddings[i].length === 0) {
          console.error(`Invalid embedding at index ${i}:`, document.embeddings[i])
          throw new Error(`Invalid embedding at index ${i}`)
        }
        
        // Log first few embedding details
        if (i < 3) {
          console.log(`  Embedding ${i}: ${document.embeddings[i].length} dimensions`)
        }
      }

      // Add to documents array
      const beforeCount = this.documents.length
      this.documents.push(document)
      const afterCount = this.documents.length
      
      console.log("✅ Document added successfully to RAG engine")
      console.log("- Documents before:", beforeCount)
      console.log("- Documents after:", afterCount)
      console.log("- Document name:", document.name)
      console.log("- Chunks:", document.chunks.length)
      console.log("- Total documents in RAG engine:", this.documents.length)
      
      // Verify the document was actually added
      const addedDoc = this.documents.find(d => d.id === document.id)
      if (addedDoc) {
        console.log("✅ Document verification: Successfully found in RAG engine documents array")
      } else {
        console.error("❌ Document verification: NOT found in RAG engine documents array")
      }
      
      // Track in telemetry
      try {
        const telemetry = getTelemetry()
        telemetry.trackDocumentAdded(document.id, document.name, document.chunks.length)
      } catch (telemetryError) {
        console.warn("Failed to track document in telemetry:", telemetryError)
      }
      
      console.log("=== RAG Engine: Document addition complete ===")
      
    } catch (error) {
      console.error("❌ Error adding document to RAG engine:", error)
      console.error("Document details:", {
        name: document?.name,
        id: document?.id,
        hasChunks: !!document?.chunks,
        chunksLength: document?.chunks?.length,
        hasEmbeddings: !!document?.embeddings,
        embeddingsLength: document?.embeddings?.length
      })
      throw error
    }
  }

  /**
   * Find relevant chunks using multiple retrieval strategies and RRF
   * @param questionEmbedding - Query embedding vector
   * @param topK - Number of chunks to retrieve
   * @param filters - Optional filters for document/chunk selection
   * @param question - Original question text for exact match and re-ranking
   * @param useRRF - Whether to use Reciprocal Rank Fusion (default: true)
   * @param useReranking - Whether to use re-ranking (default: true)
   */
  private findRelevantChunks(
    questionEmbedding: number[], 
    topK: number, 
    filters?: RAGFilterOptions,
    question?: string,
    useRRF: boolean = true,
    useReranking: boolean = true,
    alternativeEmbeddings: number[][] = [],
    minSimilarityThreshold: number = 0.03
  ) {
    const allChunks: Array<{
      content: string;
      source: string;
      similarity: number;
      documentId: string;
      documentName: string;
      semanticImportance: number;
      // Optional metadata
      page?: number;
      bbox?: any;
      level?: number;
      chunkType?: string;
    }> = [];

    // Analyze question for content-type-aware boosting
    const contentTypeBoosts = question 
      ? this.analyzeQuestionForContentTypes(question)
      : { tableBoost: 1.0, imageBoost: 1.0, equationBoost: 1.0, dataBoost: 1.0 }
    
    if (question) {
      console.log("Content type boosts for query:", contentTypeBoosts)
    }

    try {
      console.log("Enhanced findRelevantChunks: Starting multi-document search")

      // Validate inputs
      if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
        console.error("Invalid question embedding:", questionEmbedding);
        return [];
      }

      if (!Array.isArray(this.documents) || this.documents.length === 0) {
        console.error("No documents available:", this.documents.length);
        return [];
      }

      if (!this.aiClient) {
        console.error("AI client not available");
        return [];
      }

      console.log(`Processing ${this.documents.length} documents for enhanced similarity search`)

      // Enhanced multi-document processing with better fairness
      const documentMetrics = new Map<string, { avgSimilarity: number; chunkCount: number; bestSimilarity: number }>()

      this.documents.forEach((doc, docIndex) => {
        try {
          console.log(`Processing document ${docIndex}: ${doc.name}`)

          // Apply document-level filters first
          if (filters) {
            if (filters.documentIds && filters.documentIds.length > 0 && !filters.documentIds.includes(doc.id)) {
              console.log(`Skipping document ${doc.name} - not in document ID filter`)
              return // Skip – ID not in whitelist
            }
            if (filters.authors && filters.authors.length > 0) {
              const author = (doc.metadata?.author || '').toString().toLowerCase()
              const matchesAuthor = filters.authors.some((a) => a.toLowerCase() === author)
              if (!matchesAuthor) {
                console.log(`Skipping document ${doc.name} - author filter mismatch`)
                return
              }
            }
            if (filters.tags && filters.tags.length > 0) {
              const docTags: string[] = Array.isArray(doc.metadata?.tags) ? doc.metadata!.tags : []
              const tagMatch = docTags.some((t) => filters.tags!.includes(t))
              if (!tagMatch) {
                console.log(`Skipping document ${doc.name} - tag filter mismatch`)
                return
              }
            }
            if (filters.dateRange) {
              const docDate = doc.metadata?.creationDate || doc.uploadedAt
              if (docDate instanceof Date) {
                if (docDate < filters.dateRange.start || docDate > filters.dateRange.end) {
                  console.log(`Skipping document ${doc.name} - date range filter mismatch`)
                  return
                }
              }
            }
          }

          let docSimilaritySum = 0
          let validChunks = 0
          let docBestSimilarity = 0
          let docBestHybridSimilarity = 0

          // Validate document structure
          if (!doc || !doc.chunks || !doc.embeddings) {
            console.warn(`Document ${docIndex} has invalid structure:`, {
              hasDoc: !!doc,
              hasChunks: !!doc?.chunks,
              hasEmbeddings: !!doc?.embeddings
            });
            return;
          }

          if (!Array.isArray(doc.chunks) || !Array.isArray(doc.embeddings)) {
            console.warn(`Document ${docIndex} has invalid chunks or embeddings:`, {
              chunksIsArray: Array.isArray(doc.chunks),
              embeddingsIsArray: Array.isArray(doc.embeddings)
            });
            return;
          }

          if (doc.chunks.length !== doc.embeddings.length) {
            console.warn(`Document ${docIndex} has mismatched chunks and embeddings:`, {
              chunksLength: doc.chunks.length,
              embeddingsLength: doc.embeddings.length
            });
            return;
          }

          console.log(`Document ${docIndex} has ${doc.chunks.length} valid chunks`)

          doc.chunks.forEach((chunk, chunkIndex) => {
            try {
              const chunkEmbedding = doc.embeddings[chunkIndex];

              // Validate chunk embedding
              if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
                console.warn(`Invalid embedding for chunk ${chunkIndex} in document ${docIndex}:`, {
                  isArray: Array.isArray(chunkEmbedding),
                  length: chunkEmbedding?.length
                });
                return;
              }

              if (chunkEmbedding.length !== questionEmbedding.length) {
                console.warn(`Embedding dimension mismatch for chunk ${chunkIndex} in document ${docIndex}:`, {
                  chunkDimensions: chunkEmbedding.length,
                  questionDimensions: questionEmbedding.length
                });
                return;
              }

              // Calculate cosine similarity
              const semanticSimilarity = this.aiClient!.cosineSimilarity(questionEmbedding, chunkEmbedding);

              if (typeof semanticSimilarity === "number" && !isNaN(semanticSimilarity)) {
                // Extract chunk content and metadata first
                  // Support both string chunks and TextChunk objects
                  const chunkContent = typeof chunk === 'string' ? chunk : chunk.content
                  const chunkMetadata = typeof chunk === 'object' && 'metadata' in chunk ? chunk.metadata : null

                // Calculate exact match boost for identifiers (Article numbers, Section numbers, etc.)
                const exactMatchBoost = question ? this.calculateExactMatchBoost(question, chunkContent || '') : 0

                // Hybrid scoring: Combine semantic similarity with exact match boost
                // If exact match is found, significantly boost the score
                const hybridSimilarity = exactMatchBoost > 0.5
                  ? Math.min(1.0, semanticSimilarity * 0.4 + exactMatchBoost * 0.6) // Strong boost for exact matches
                  : semanticSimilarity * 0.8 + exactMatchBoost * 0.2 // Normal hybrid scoring

                // Update document metrics
                docSimilaritySum += hybridSimilarity // Use hybrid for metrics
                validChunks++
                docBestSimilarity = Math.max(docBestSimilarity, semanticSimilarity)
                docBestHybridSimilarity = Math.max(docBestHybridSimilarity, hybridSimilarity)

                // Apply adaptive similarity threshold based on document performance
                const adaptiveMinSim = this.calculateAdaptiveThreshold(hybridSimilarity, filters?.minSimilarity ?? minSimilarityThreshold)

                if (hybridSimilarity >= adaptiveMinSim) {
                  // Get semantic importance with question-aware content type boosting
                  const semanticImportance = this.extractSemanticImportance(chunk, doc.metadata, contentTypeBoosts)

                  // Build enhanced source string with metadata
                  let sourceString = `${doc.name || "Unknown Document"} (chunk ${chunkIndex + 1})`
                  if (chunkMetadata) {
                    if (chunkMetadata.page !== undefined) {
                      sourceString = `${doc.name} · p.${chunkMetadata.page}` + (chunkMetadata.level ? ` · ${this.formatChunkType(chunkMetadata.type, chunkMetadata.level)}` : '')
                    } else if (chunkMetadata.type) {
                      sourceString += ` · ${this.formatChunkType(chunkMetadata.type)}`
                    }
                  }

                  allChunks.push({
                    content: chunkContent || "",
                    source: sourceString,
                    similarity: hybridSimilarity, // Use hybrid score instead of pure semantic
                    documentId: doc.id,
                    documentName: doc.name,
                    semanticImportance,
                    // Include metadata if available
                    ...(chunkMetadata?.page !== undefined && { page: chunkMetadata.page }),
                    ...(chunkMetadata?.bbox && { bbox: chunkMetadata.bbox }),
                    ...(chunkMetadata?.level !== undefined && { level: chunkMetadata.level }),
                    ...(chunkMetadata?.type && { chunkType: chunkMetadata.type }),
                  });

                  // Log high-similarity chunks with exact match info
                  if (hybridSimilarity > 0.2) {
                    const matchInfo = exactMatchBoost > 0.5 ? ` [EXACT MATCH: ${exactMatchBoost.toFixed(2)}]` : ''
                    console.log(`Strong similarity chunk found: ${hybridSimilarity.toFixed(3)} (semantic: ${semanticSimilarity.toFixed(3)}${matchInfo}) from ${sourceString} (importance: ${semanticImportance.toFixed(2)})`)
                  }
                } else if (hybridSimilarity > 0.01) {
                  // Even low-similarity chunks are tracked for diversity purposes
                  console.log(`Low similarity chunk: ${hybridSimilarity.toFixed(3)} from ${doc.name} (below threshold but tracked)`)
                }
              } else {
                console.warn(`Invalid similarity calculated for chunk ${chunkIndex} in document ${docIndex}:`, semanticSimilarity);
              }
            } catch (chunkError) {
              console.error(`Error processing chunk ${chunkIndex} in document ${docIndex}:`, chunkError);
            }
          });

          // Store document metrics for enhanced diversity algorithm
          if (validChunks > 0) {
            documentMetrics.set(doc.id, {
              avgSimilarity: docSimilaritySum / validChunks,
              chunkCount: validChunks,
              bestSimilarity: docBestHybridSimilarity // Use hybrid similarity for best match
            })
            console.log(`Document ${doc.name} metrics - Avg: ${(docSimilaritySum / validChunks).toFixed(3)}, Best: ${docBestHybridSimilarity.toFixed(3)}, Chunks: ${validChunks}`)
          }
        } catch (docError) {
          console.error(`Error processing document ${docIndex}:`, docError);
        }
      });

      console.log(`Total chunks processed: ${allChunks.length} from ${documentMetrics.size} documents`)

      if (allChunks.length === 0) {
        console.warn("No chunks were successfully processed")
        return [];
      }

      // Step 1: Generate multiple retrieval strategies
      let finalChunks: typeof allChunks = []
      
      if (useRRF && question) {
        // If alternative embeddings are provided, use multi-query RRF
        if (alternativeEmbeddings.length > 0) {
          console.log(`Using Multi-Query Reciprocal Rank Fusion with ${alternativeEmbeddings.length + 1} query variations`)
          finalChunks = this.applyMultiQueryRRF(allChunks, questionEmbedding, alternativeEmbeddings, question, topK, filters)
        } else {
          console.log("Using Reciprocal Rank Fusion (RRF) with multiple retrieval strategies")
          finalChunks = this.applyReciprocalRankFusion(allChunks, questionEmbedding, question, topK, filters)
        }
      } else {
        // Fallback to single strategy with diversity algorithm
        console.log("Using single retrieval strategy with diversity algorithm")
        const isMultiDoc = question ? this.isMultiDocumentQuery(question) : false
        finalChunks = this.applyEnhancedDiversityAlgorithm(allChunks, documentMetrics, topK, filters?.minSimilarity ?? minSimilarityThreshold, isMultiDoc)
      }

      // Step 2: Re-ranking (if enabled)
      if (useReranking && question && finalChunks.length > 0) {
        console.log("Applying re-ranking to improve result quality")
        finalChunks = this.rerankChunks(finalChunks, question, topK)
      }

      return finalChunks
    } catch (error) {
      console.error("Error finding relevant chunks:", error);
      return [];
    }
  }

  /**
   * Calculate exact match boost for identifiers in query vs chunk content
   * Detects article numbers, section numbers, clause numbers, etc.
   * Returns a score between 0 and 1, where 1.0 = perfect exact match
   */
  private calculateExactMatchBoost(query: string, chunkContent: string): number {
    if (!query || !chunkContent) return 0

    // Extract identifiers from query (Article numbers, Section numbers, etc.)
    const identifiers = this.extractIdentifiers(query)
    if (identifiers.length === 0) return 0

    let totalBoost = 0
    let matchedIdentifiers = 0

    for (const identifier of identifiers) {
      // Check for exact match (case-insensitive, but preserve structure)
      const exactMatch = new RegExp(`\\b${this.escapeRegex(identifier)}\\b`, 'i')
      if (exactMatch.test(chunkContent)) {
        matchedIdentifiers++
        // Perfect match gets full boost
        totalBoost += 1.0
      } else {
        // Check for partial match (e.g., "Article 24" matches "Article 24-B")
        const partialMatch = new RegExp(`\\b${this.escapeRegex(identifier.split(/[-_]/)[0])}\\b`, 'i')
        if (partialMatch.test(chunkContent)) {
          // Partial match gets reduced boost
          totalBoost += 0.3
        }
      }
    }

    // Normalize: average boost across all identifiers, but reward perfect matches
    if (matchedIdentifiers === identifiers.length) {
      // All identifiers matched perfectly - maximum boost
      return Math.min(1.0, totalBoost / identifiers.length + 0.2)
    } else if (matchedIdentifiers > 0) {
      // Some identifiers matched
      return Math.min(1.0, totalBoost / identifiers.length)
    } else {
      // No matches
      return 0
    }
  }

  /**
   * Extract identifiers from text (Article numbers, Section numbers, etc.)
   * Examples: "Article 24-B", "Section 3.2", "Clause 5(a)", "Rule 12.3.4"
   */
  private extractIdentifiers(text: string): string[] {
    const identifiers: string[] = []
    
    // Pattern 1: Article numbers (Article 24-B, Article 24A, Article 24, etc.)
    const articlePattern = /\bArticle\s+(\d+[-_]?[A-Z]?|\d+[A-Z])\b/gi
    let match
    while ((match = articlePattern.exec(text)) !== null) {
      identifiers.push(`Article ${match[1]}`)
    }

    // Pattern 2: Section numbers (Section 3.2, Section 3-2, Section 3.2.1, etc.)
    const sectionPattern = /\bSection\s+(\d+(?:[.-]\d+)+)\b/gi
    while ((match = sectionPattern.exec(text)) !== null) {
      identifiers.push(`Section ${match[1]}`)
    }

    // Pattern 3: Clause numbers (Clause 5(a), Clause 5(b), Clause 5, etc.)
    const clausePattern = /\bClause\s+(\d+(?:\([a-z]\))?)\b/gi
    while ((match = clausePattern.exec(text)) !== null) {
      identifiers.push(`Clause ${match[1]}`)
    }

    // Pattern 4: Rule numbers (Rule 12.3.4, Rule 12-3, etc.)
    const rulePattern = /\bRule\s+(\d+(?:[.-]\d+)+)\b/gi
    while ((match = rulePattern.exec(text)) !== null) {
      identifiers.push(`Rule ${match[1]}`)
    }

    // Pattern 5: Paragraph numbers (§ 5, § 5.2, etc.)
    const paragraphPattern = /§\s*(\d+(?:[.-]\d+)*)/gi
    while ((match = paragraphPattern.exec(text)) !== null) {
      identifiers.push(`§ ${match[1]}`)
    }

    // Pattern 6: Subsection numbers (Subsection 3.2, Subsection 3-2, etc.)
    const subsectionPattern = /\bSubsection\s+(\d+(?:[.-]\d+)+)\b/gi
    while ((match = subsectionPattern.exec(text)) !== null) {
      identifiers.push(`Subsection ${match[1]}`)
    }

    // Pattern 7: Chapter numbers (Chapter 2, Chapter 2.1, etc.)
    const chapterPattern = /\bChapter\s+(\d+(?:[.-]\d+)*)\b/gi
    while ((match = chapterPattern.exec(text)) !== null) {
      identifiers.push(`Chapter ${match[1]}`)
    }

    // Pattern 8: Standalone numbered references (24-B, 3.2, 5(a), etc.)
    // Only if they appear in a context that suggests they're identifiers
    const standalonePattern = /\b(\d+[-_][A-Z]|\d+[A-Z]|\d+(?:[.-]\d+)+)\b/g
    const standaloneMatches = text.match(standalonePattern)
    if (standaloneMatches && identifiers.length === 0) {
      // Only use standalone if no other identifiers found
      identifiers.push(...standaloneMatches.slice(0, 3)) // Limit to first 3
    }

    // Remove duplicates and return
    return Array.from(new Set(identifiers))
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Reciprocal Rank Fusion (RRF) - Combines multiple retrieval strategies
   * Formula: RRF(d) = Σ(1 / (k + rank_i(d))) for each retrieval strategy i
   * where k is a constant (typically 60) and rank_i is the rank in strategy i
   */
  private applyReciprocalRankFusion(
    allChunks: Array<{
      content: string;
      source: string;
      similarity: number;
      documentId: string;
      documentName: string;
      semanticImportance: number;
      page?: number;
      bbox?: any;
      level?: number;
      chunkType?: string;
    }>,
    questionEmbedding: number[],
    question: string,
    topK: number,
    filters?: RAGFilterOptions
  ): typeof allChunks {
    console.log("=== Reciprocal Rank Fusion (RRF) ===")
    const k = 60 // RRF constant (standard value)

    // Strategy 1: Semantic similarity ranking
    const semanticRanked = [...allChunks]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK * 2) // Get more candidates for RRF

    // Strategy 2: Exact match boost ranking (already calculated in similarity, but we'll re-rank)
    const exactMatchRanked = [...allChunks]
      .map(chunk => ({
        ...chunk,
        exactMatchScore: this.calculateExactMatchBoost(question, chunk.content)
      }))
      .sort((a, b) => {
        // Combine similarity with exact match
        const scoreA = a.similarity * 0.7 + a.exactMatchScore * 0.3
        const scoreB = b.similarity * 0.7 + b.exactMatchScore * 0.3
        return scoreB - scoreA
      })
      .slice(0, topK * 2)

    // Strategy 3: Keyword-based ranking (BM25-like)
    const keywordRanked = [...allChunks]
      .map(chunk => ({
        ...chunk,
        keywordScore: this.calculateKeywordRelevance(question, chunk.content)
      }))
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, topK * 2)

    // Strategy 4: Semantic importance ranking
    const importanceRanked = [...allChunks]
      .sort((a, b) => b.semanticImportance - a.semanticImportance)
      .slice(0, topK * 2)

    // Create a map of chunk IDs to RRF scores
    const chunkMap = new Map<string, {
      chunk: typeof allChunks[0];
      rrfScore: number;
      ranks: { semantic: number; exactMatch: number; keyword: number; importance: number };
    }>()

    // Calculate RRF scores for each chunk
    const addToRRF = (rankedList: typeof allChunks, strategyName: 'semantic' | 'exactMatch' | 'keyword' | 'importance') => {
      rankedList.forEach((chunk, index) => {
        const chunkId = `${chunk.documentId}_${chunk.source}_${chunk.content.substring(0, 50)}`
        const rank = index + 1
        const rrfContribution = 1 / (k + rank)

        if (!chunkMap.has(chunkId)) {
          chunkMap.set(chunkId, {
            chunk,
            rrfScore: 0,
            ranks: { semantic: Infinity, exactMatch: Infinity, keyword: Infinity, importance: Infinity }
          })
        }

        const entry = chunkMap.get(chunkId)!
        entry.rrfScore += rrfContribution
        entry.ranks[strategyName] = rank
      })
    }

    addToRRF(semanticRanked, 'semantic')
    addToRRF(exactMatchRanked, 'exactMatch')
    addToRRF(keywordRanked, 'keyword')
    addToRRF(importanceRanked, 'importance')

    // Sort by RRF score
    const sortedByRRF = Array.from(chunkMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(entry => ({
        ...entry.chunk,
        rrfScore: entry.rrfScore,
        rrfRanks: entry.ranks
      }))

    // Apply cross-document diversity to RRF results
    const isMultiDoc = this.isMultiDocumentQuery(question)
    const rrfResults = this.applyCrossDocumentDiversity(sortedByRRF, topK, isMultiDoc)

    console.log(`RRF: Combined ${chunkMap.size} unique chunks from 4 strategies, returning top ${rrfResults.length}`)
    if (rrfResults.length > 0) {
      console.log(`Best RRF score: ${rrfResults[0].rrfScore?.toFixed(4) || 'N/A'}`)
      // Log document distribution
      const docCounts = new Map<string, number>()
      rrfResults.forEach(r => docCounts.set(r.documentName, (docCounts.get(r.documentName) || 0) + 1))
      console.log(`Document distribution: ${Array.from(docCounts.entries()).map(([n, c]) => `${n}:${c}`).join(', ')}`)
    }

    return rrfResults
  }

  /**
   * Apply cross-document diversity to ranked results
   * Ensures fair representation from multiple documents
   */
  private applyCrossDocumentDiversity<T extends { documentId: string; documentName: string; source: string }>(
    rankedChunks: T[],
    topK: number,
    isMultiDocQuery: boolean
  ): T[] {
    if (rankedChunks.length <= topK) return rankedChunks
    
    // Count unique documents
    const uniqueDocs = new Set(rankedChunks.map(c => c.documentId))
    const numDocs = uniqueDocs.size
    
    if (numDocs <= 1) {
      return rankedChunks.slice(0, topK)
    }

    // Calculate distribution limits
    const maxPerDoc = isMultiDocQuery 
      ? Math.max(2, Math.ceil(topK / numDocs) + 1) // Strict: near-equal distribution
      : Math.ceil(topK * 0.5) // Relaxed: max 50% from any single doc
    
    const minPerDoc = isMultiDocQuery && numDocs <= topK ? 1 : 0

    console.log(`Cross-doc diversity: ${numDocs} docs, max ${maxPerDoc}/doc, multiDoc: ${isMultiDocQuery}`)

    const selected: T[] = []
    const docCounts = new Map<string, number>()
    const usedSources = new Set<string>()

    // First pass: ensure minimum per document
    if (minPerDoc > 0) {
      for (const docId of uniqueDocs) {
        const docChunk = rankedChunks.find(c => 
          c.documentId === docId && !usedSources.has(c.source)
        )
        if (docChunk && selected.length < topK) {
          selected.push(docChunk)
          usedSources.add(docChunk.source)
          docCounts.set(docId, 1)
        }
      }
    }

    // Second pass: fill remaining slots with diversity constraint
    for (const chunk of rankedChunks) {
      if (selected.length >= topK) break
      if (usedSources.has(chunk.source)) continue
      
      const count = docCounts.get(chunk.documentId) || 0
      if (count < maxPerDoc) {
        selected.push(chunk)
        usedSources.add(chunk.source)
        docCounts.set(chunk.documentId, count + 1)
      }
    }

    // If still need more, relax constraints
    if (selected.length < topK) {
      for (const chunk of rankedChunks) {
        if (selected.length >= topK) break
        if (!usedSources.has(chunk.source)) {
          selected.push(chunk)
          usedSources.add(chunk.source)
        }
      }
    }

    return selected
  }

  /**
   * Multi-Query Reciprocal Rank Fusion
   * Uses multiple query embeddings (original + alternatives) to improve retrieval for vague questions
   */
  private applyMultiQueryRRF(
    allChunks: Array<{
      content: string;
      source: string;
      similarity: number;
      documentId: string;
      documentName: string;
      semanticImportance: number;
      page?: number;
      bbox?: any;
      level?: number;
      chunkType?: string;
    }>,
    questionEmbedding: number[],
    alternativeEmbeddings: number[][],
    question: string,
    topK: number,
    filters?: RAGFilterOptions
  ): typeof allChunks {
    console.log("=== Multi-Query Reciprocal Rank Fusion ===")
    const k = 60 // RRF constant
    
    // Combine all embeddings (original + alternatives)
    const allEmbeddings = [questionEmbedding, ...alternativeEmbeddings]
    const allRankings: Map<string, number>[] = []
    
    // For each query embedding, calculate similarity and rank chunks
    for (let i = 0; i < allEmbeddings.length; i++) {
      const embedding = allEmbeddings[i]
      const ranking = new Map<string, number>()
      
      // Calculate similarity for each chunk with this embedding
      const chunkScores: Array<{ chunk: typeof allChunks[0]; similarity: number; index: number }> = []
      
      for (const chunk of allChunks) {
        const doc = this.documents.find(d => d.id === chunk.documentId)
        if (!doc || !doc.embeddings || !doc.chunks) continue
        
        // Find the chunk index
        const chunkIndex = doc.chunks.findIndex((c, idx) => {
          const cContent = typeof c === 'string' ? c : c.content
          return cContent === chunk.content
        })
        
        if (chunkIndex === -1 || !doc.embeddings[chunkIndex]) continue
        
        const chunkEmbedding = doc.embeddings[chunkIndex]
        const similarity = this.aiClient!.cosineSimilarity(embedding, chunkEmbedding)
        
        if (typeof similarity === 'number' && !isNaN(similarity)) {
          chunkScores.push({ chunk, similarity, index: chunkIndex })
        }
      }
      
      // Rank by similarity
      chunkScores.sort((a, b) => b.similarity - a.similarity)
      
      // Store ranks (1-based)
      chunkScores.forEach((item, rank) => {
        const chunkKey = `${item.chunk.documentId}-${item.index}`
        ranking.set(chunkKey, rank + 1)
      })
      
      allRankings.push(ranking)
    }
    
    // Apply RRF: RRF(d) = Σ(1 / (k + rank_i(d)))
    const rrfScores = new Map<string, number>()
    
    for (const chunk of allChunks) {
      const doc = this.documents.find(d => d.id === chunk.documentId)
      if (!doc || !doc.chunks) continue
      
      const chunkIndex = doc.chunks.findIndex((c, idx) => {
        const cContent = typeof c === 'string' ? c : c.content
        return cContent === chunk.content
      })
      
      if (chunkIndex === -1) continue
      
      const chunkKey = `${chunk.documentId}-${chunkIndex}`
      let rrfScore = 0
      
      // Sum RRF scores from all query variations
      for (const ranking of allRankings) {
        const rank = ranking.get(chunkKey)
        if (rank !== undefined) {
          rrfScore += 1 / (k + rank)
        }
      }
      
      rrfScores.set(chunkKey, rrfScore)
    }
    
    // Sort by RRF score
    const finalRankedChunks = [...allChunks]
      .map(chunk => {
        const doc = this.documents.find(d => d.id === chunk.documentId)
        if (!doc || !doc.chunks) return { chunk, rrfScore: 0 }
        
        const chunkIndex = doc.chunks.findIndex((c, idx) => {
          const cContent = typeof c === 'string' ? c : c.content
          return cContent === chunk.content
        })
        
        if (chunkIndex === -1) return { chunk, rrfScore: 0 }
        
        const chunkKey = `${chunk.documentId}-${chunkIndex}`
        const rrfScore = rrfScores.get(chunkKey) || 0
        
        return {
          chunk: {
            ...chunk,
            similarity: rrfScore // Use RRF score as similarity
          },
          rrfScore
        }
      })
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(item => item.chunk)
    
    // Apply cross-document diversity
    const isMultiDoc = this.isMultiDocumentQuery(question)
    const diverseResults = this.applyCrossDocumentDiversity(finalRankedChunks, topK, isMultiDoc)
    
    console.log(`Multi-Query RRF: Combined ${allEmbeddings.length} query variations, top chunk RRF score: ${diverseResults[0]?.similarity?.toFixed(4) || 'N/A'}`)
    
    // Log document distribution
    const docCounts = new Map<string, number>()
    diverseResults.forEach(r => docCounts.set(r.documentName, (docCounts.get(r.documentName) || 0) + 1))
    console.log(`Document distribution: ${Array.from(docCounts.entries()).map(([n, c]) => `${n}:${c}`).join(', ')}`)
    
    return diverseResults
  }

  /**
   * Calculate keyword relevance score (BM25-inspired)
   */
  private calculateKeywordRelevance(query: string, content: string): number {
    if (!query || !content) return 0

    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)

    const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 2) // Filter out very short terms
    const contentTerms = normalizedContent.split(/\s+/)

    if (queryTerms.length === 0) return 0

    // Calculate term frequency (TF) and inverse document frequency (IDF) inspired scores
    let totalScore = 0
    const termFrequencies = new Map<string, number>()

    // Count term frequencies in content
    contentTerms.forEach(term => {
      termFrequencies.set(term, (termFrequencies.get(term) || 0) + 1)
    })

    // Calculate score for each query term
    queryTerms.forEach(queryTerm => {
      const tf = termFrequencies.get(queryTerm) || 0
      const contentLength = contentTerms.length
      
      // BM25-like scoring (simplified)
      // Score = (tf * idf) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)))
      // Simplified version without IDF and avgDocLength
      const k1 = 1.5
      const b = 0.75
      const avgDocLength = 200 // Approximate average
      
      const score = (tf * 1.0) / (tf + k1 * (1 - b + b * (contentLength / avgDocLength)))
      totalScore += score
    })

    // Normalize by number of query terms
    return totalScore / queryTerms.length
  }

  /**
   * Re-rank chunks using cross-encoder-like approach
   * Uses semantic similarity + exact match + keyword relevance for final ranking
   */
  private rerankChunks(
    chunks: Array<{
      content: string;
      source: string;
      similarity: number;
      documentId: string;
      documentName: string;
      semanticImportance: number;
      page?: number;
      bbox?: any;
      level?: number;
      chunkType?: string;
      rrfScore?: number;
      rrfRanks?: any;
    }>,
    question: string,
    topK: number
  ): typeof chunks {
    console.log("=== Re-ranking Chunks ===")
    console.log(`Re-ranking ${chunks.length} chunks for question: "${question.substring(0, 100)}"`)

    const reranked = chunks.map(chunk => {
      // Calculate multiple relevance signals
      const exactMatchScore = this.calculateExactMatchBoost(question, chunk.content)
      const keywordScore = this.calculateKeywordRelevance(question, chunk.content)
      const semanticScore = chunk.similarity
      const importanceScore = chunk.semanticImportance / 3.0 // Normalize to 0-1

      // Cross-encoder-like scoring: weighted combination of all signals
      // Exact matches get highest priority
      let rerankScore: number
      
      if (exactMatchScore > 0.7) {
        // Strong exact match - prioritize heavily
        rerankScore = exactMatchScore * 0.5 + semanticScore * 0.3 + keywordScore * 0.15 + importanceScore * 0.05
      } else if (exactMatchScore > 0.3) {
        // Moderate exact match
        rerankScore = exactMatchScore * 0.35 + semanticScore * 0.35 + keywordScore * 0.2 + importanceScore * 0.1
      } else {
        // No exact match - rely on semantic and keyword
        rerankScore = semanticScore * 0.5 + keywordScore * 0.3 + importanceScore * 0.2
      }

      // Boost for chunks that appear in multiple RRF strategies (if available)
      if (chunk.rrfScore !== undefined) {
        rerankScore = rerankScore * 0.8 + (chunk.rrfScore * 10) * 0.2 // Scale RRF score
      }

      return {
        ...chunk,
        rerankScore,
        rerankSignals: {
          exactMatch: exactMatchScore,
          keyword: keywordScore,
          semantic: semanticScore,
          importance: importanceScore
        }
      }
    })

    // Sort by rerank score and return top K
    const finalReranked = reranked
      .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
      .slice(0, topK)
      .map(({ rerankScore, rerankSignals, ...chunk }) => chunk) // Remove temporary fields

    console.log(`Re-ranking complete: ${finalReranked.length} chunks selected`)
    if (finalReranked.length > 0) {
      const topChunk = reranked.find(c => c.content === finalReranked[0].content)
      if (topChunk) {
        console.log(`Top reranked chunk score: ${topChunk.rerankScore?.toFixed(4)}`)
        console.log(`  - Exact match: ${topChunk.rerankSignals?.exactMatch.toFixed(3)}`)
        console.log(`  - Keyword: ${topChunk.rerankSignals?.keyword.toFixed(3)}`)
        console.log(`  - Semantic: ${topChunk.rerankSignals?.semantic.toFixed(3)}`)
        console.log(`  - Importance: ${topChunk.rerankSignals?.importance.toFixed(3)}`)
      }
    }

    return finalReranked
  }

  // Helper to format chunk type for display
  private formatChunkType(type: string, level?: number): string {
    if (type === 'heading' && level) {
      return `H${level}`
    }
    const typeMap: Record<string, string> = {
      'heading': 'Heading',
      'table': 'Table',
      'list': 'List',
      'code': 'Code',
      'image': 'Image',
      'paragraph': 'Para',
      'other': 'Content'
    }
    return typeMap[type] || type
  }

  // Normalize chunks to plain strings for embedding generation
  private toPlainChunks(chunks: any[]): string[] {
    if (!Array.isArray(chunks)) return []
    return chunks.map((c: any) => (typeof c === 'string' ? c : (c?.content ?? '')))
  }

  // Safe preview extraction for union chunk types
  private getChunkPreview(chunk: any): string {
    if (!chunk) return ''
    const text = typeof chunk === 'string' ? chunk : (chunk?.content ?? '')
    return text?.substring ? text.substring(0, 100) : ''
  }

  async query(question: string, options?: { 
    showThinking?: boolean, 
    tokenBudget?: number,
    complexityLevel?: 'simple' | 'normal' | 'complex',
    filters?: RAGFilterOptions,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    sessionId?: string // For rate limiting
  }): Promise<EnhancedQueryResponse> {
    const queryStartTime = Date.now()
    const queryId = `query_${queryStartTime}_${Math.random().toString(36).substring(7)}`
    console.log(`Enhanced RAG query started [${queryId}]:`, question);

    // Initialize processing options
    const showThinking = options?.showThinking ?? false
    const tokenBudget = options?.tokenBudget ?? 4000
    const complexityLevel = options?.complexityLevel ?? 'normal'
    const filters = options?.filters

    // Create default response structure
    const defaultResponse: EnhancedQueryResponse = {
      answer: "I apologize, but I couldn't process your question properly.",
      sources: [],
      relevanceScore: 0,
      retrievedChunks: [],
      qualityMetrics: {
        accuracyScore: 0,
        completenessScore: 0,
        clarityScore: 0,
        confidenceScore: 0,
        finalRating: 0
      },
      tokenUsage: {
        contextTokens: 0,
        reasoningTokens: 0,
        responseTokens: 0,
        totalTokens: 0
      }
    };

    try {
      // ==================== GUARDRAILS: Input Validation ====================
      const inputValidation = Guardrails.validateQueryInput(question)
      if (!inputValidation.isValid) {
        console.warn(`[${queryId}] Input validation failed:`, inputValidation.errors)
        return {
          ...defaultResponse,
          answer: `Invalid input: ${inputValidation.errors.join('. ')}`,
        }
      }
      if (inputValidation.warnings.length > 0) {
        console.warn(`[${queryId}] Input warnings:`, inputValidation.warnings)
      }
      const sanitizedQuestion = inputValidation.sanitizedInput || question

      // ==================== GUARDRAILS: Rate Limiting ====================
      const sessionId = options?.sessionId || 'default'
      const rateLimitResult = checkRateLimit(sessionId, { windowMs: 60000, maxRequests: 30 })
      if (!rateLimitResult.allowed) {
        console.warn(`[${queryId}] Rate limit exceeded for session: ${sessionId}`)
        return {
          ...defaultResponse,
          answer: `Rate limit exceeded. Please wait ${Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000)} seconds before trying again.`,
        }
      }
      console.log(`[${queryId}] Rate limit: ${rateLimitResult.remaining} requests remaining`)

      // Validate system state
      if (!this.isInitialized || !this.aiClient) {
        return {
          ...defaultResponse,
          answer: "The system is not properly initialized. Please configure your AI provider and try again.",
        };
      }

      // Validate input (basic check)
      if (!sanitizedQuestion || sanitizedQuestion.trim().length === 0) {
        return {
          ...defaultResponse,
          answer: "Please provide a valid question.",
        };
      }

      // Resolve conversation context if history is provided
      const resolvedQuestion = options?.conversationHistory && options.conversationHistory.length > 0
        ? await this.resolveConversationContext(question, options.conversationHistory)
        : question

      // Determine processing approach based on complexity
      return await this.processQueryEnhanced(resolvedQuestion, tokenBudget, complexityLevel, showThinking, filters, options?.conversationHistory)

    } catch (error) {
      console.error("Error in enhanced RAG query:", error);
      return {
        ...defaultResponse,
        answer: "I encountered an error while processing your request. Please try again later.",
      };
    }
  }

  private async processQueryEnhanced(
    question: string, 
    tokenBudget: number, 
    complexityLevel: string,
    showThinking: boolean,
    filters?: RAGFilterOptions,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<EnhancedQueryResponse> {
    const processStartTime = Date.now()
    const queryId = `eval_${processStartTime}`
    
    // Phase-based token allocation
    const tokenAllocation = this.calculateTokenAllocation(tokenBudget, complexityLevel)
    
    // ==================== PHASE 1: Retrieval ====================
    const retrievalStartTime = Date.now()
    const phase1Result = await this.phase1_ContextAnalysis(question, tokenAllocation.context, filters, conversationHistory)
    const retrievalLatencyMs = Date.now() - retrievalStartTime
    
    // ==================== PHASE 2: Self-Critique ====================
    const phase2Result = complexityLevel === 'simple' 
      ? null 
      : await this.phase2_SelfCritique(phase1Result, tokenAllocation.critique)
    
    // ==================== PHASE 3: Generation ====================
    const generationStartTime = Date.now()
    const phase3Result = await this.phase3_Refinement(
      phase1Result, 
      phase2Result, 
      tokenAllocation.refinement,
      showThinking
    )
    const generationLatencyMs = Date.now() - generationStartTime

    // ==================== GUARDRAILS: Output Validation ====================
    const outputValidation = Guardrails.validateOutput(
      phase3Result.answer,
      phase1Result.context || '',
      phase1Result.relevantChunks || []
    )
    
    if (!outputValidation.isValid) {
      console.warn(`[${queryId}] Output validation issues:`, outputValidation.issues)
    }
    
    if (outputValidation.toxicityScore > 0.5) {
      console.warn(`[${queryId}] High toxicity score: ${outputValidation.toxicityScore}`)
      // In production, you might want to filter or flag the response
    }

    // ==================== EVALUATION: Track Metrics ====================
    try {
      const chunks = phase1Result.relevantChunks || []
      const evaluation = createQueryEvaluation(
        queryId,
        question,
        chunks.map((c: any) => ({
          similarity: c.similarity || 0,
          documentId: c.documentId || '',
          documentName: c.documentName || c.source || '',
          content: c.content || '',
          source: c.source || ''
        })),
        phase3Result.answer,
        phase3Result.groundednessScore || phase1Result.groundednessScore || 0.5,
        this.documents.length,
        retrievalLatencyMs,
        generationLatencyMs
      )
      
      storeEvaluation(evaluation)
      
      // Log evaluation summary
      console.log(`[${queryId}] Evaluation: overall=${(evaluation.overallScore * 100).toFixed(1)}%, ` +
        `retrieval=${retrievalLatencyMs}ms, generation=${generationLatencyMs}ms, ` +
        `groundedness=${(evaluation.generation.groundednessScore * 100).toFixed(1)}%`)
      
      if (evaluation.issues.length > 0) {
        console.warn(`[${queryId}] Evaluation issues:`, evaluation.issues)
      }
    } catch (evalError) {
      console.error('Failed to create evaluation:', evalError)
    }

    return phase3Result
  }

  private calculateTokenAllocation(budget: number, complexity: string) {
    const allocations = {
      'simple': { context: 0.6, critique: 0.0, refinement: 0.4 },
      'normal': { context: 0.4, critique: 0.3, refinement: 0.3 },
      'complex': { context: 0.3, critique: 0.4, refinement: 0.3 }
    }
    
    const allocation = allocations[complexity as keyof typeof allocations]
    
    return {
      context: Math.floor(budget * allocation.context),
      critique: Math.floor(budget * allocation.critique), 
      refinement: Math.floor(budget * allocation.refinement)
    }
  }

  private async phase1_ContextAnalysis(question: string, tokenBudget: number, filters?: RAGFilterOptions, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>) {
    console.log("Phase 1: Context Analysis and Initial Response")
    
    // Debug: Check system state
    console.log("RAG Engine Debug:")
    console.log("- Documents available:", this.documents.length)
    console.log("- AI Client available:", !!this.aiClient)
    console.log("- Is initialized:", this.isInitialized)
    
    if (this.documents.length === 0) {
      console.warn("No documents available for retrieval")
      return {
        question,
        relevantChunks: [],
        context: "",
        initialResponse: "No documents have been uploaded yet. Please upload documents first to get answers.",
        questionType: 'general',
        tokensUsed: 0
      }
    }

    // Debug: Log documents info
    this.documents.forEach((doc, index) => {
      console.log(`Document ${index}: ${doc.name}, chunks: ${doc.chunks?.length || 0}, embeddings: ${doc.embeddings?.length || 0}`)
    })
    
    try {
      // Detect and handle vague questions
      const vaguenessScore = this.detectVagueness(question)
      console.log(`Vagueness score: ${vaguenessScore.toFixed(2)} (0=clear, 1=very vague)`)
      
      let processedQuestion = question
      let expandedQueries: string[] = []
      
      // If question is vague, expand it
      if (vaguenessScore > 0.4) {
        console.log("⚠️ Vague question detected - expanding query...")
        const expansionResult = await this.expandVagueQuery(question)
        processedQuestion = expansionResult.expandedQuery
        expandedQueries = expansionResult.alternativeQueries
        
        console.log(`Expanded query: "${processedQuestion}"`)
        console.log(`Alternative queries: ${expandedQueries.length}`)
      }
      
      // Generate embeddings for main query and alternatives
      console.log("Generating embedding for question:", processedQuestion.substring(0, 100) + "...")
      const questionEmbedding = await this.aiClient!.generateEmbedding(processedQuestion);
      console.log("Question embedding generated, dimensions:", questionEmbedding.length)
      
      // Generate embeddings for alternative queries if available
      const alternativeEmbeddings: number[][] = []
      if (expandedQueries.length > 0) {
        console.log("Generating embeddings for alternative queries...")
        for (const altQuery of expandedQueries.slice(0, 3)) { // Limit to 3 alternatives
          try {
            const altEmbedding = await this.aiClient!.generateEmbedding(altQuery)
            alternativeEmbeddings.push(altEmbedding)
          } catch (error) {
            console.warn(`Failed to generate embedding for alternative query: ${altQuery}`)
          }
        }
      }
      
      // Analyze question type for optimal chunk selection
      const questionType = this.analyzeQuestionType(processedQuestion)
      const chunkLimit = this.getOptimalChunkLimit(questionType)
      // Increase chunk limit for vague questions to get more context
      const adjustedChunkLimit = vaguenessScore > 0.4 ? Math.min(chunkLimit * 2, 15) : chunkLimit
      console.log(`Question type: ${questionType}, chunk limit: ${adjustedChunkLimit}`)
      
      // Find relevant chunks with question-aware boosting, RRF, and re-ranking
      console.log("Finding relevant chunks with RRF and re-ranking...")
      const useRRF = true // Enable RRF by default
      const useReranking = true // Enable re-ranking by default
      let relevantChunks = this.findRelevantChunks(
        questionEmbedding, 
        adjustedChunkLimit, 
        filters, 
        processedQuestion, 
        useRRF, 
        useReranking,
        alternativeEmbeddings // Pass alternative embeddings for multi-query retrieval
      );
      console.log(`Found ${relevantChunks.length} relevant chunks after RRF and re-ranking`)
      
      // Debug: Log chunk similarities
      if (relevantChunks.length > 0) {
        console.log("Top chunks:")
        relevantChunks.slice(0, 3).forEach((chunk: any, i: number) => {
          console.log(`  ${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}, Source: ${chunk.source}`)
          console.log(`     Content preview: ${chunk.content.substring(0, 100)}...`)
        })
      } else {
        console.warn("No relevant chunks found - checking why...")
        
        // Debug: Check first document in detail
        if (this.documents.length > 0) {
          const firstDoc = this.documents[0]
          console.log("First document analysis:")
          console.log("- Name:", firstDoc.name)
          console.log("- Has chunks:", !!firstDoc.chunks)
          console.log("- Chunks length:", firstDoc.chunks?.length)
          console.log("- Has embeddings:", !!firstDoc.embeddings)
          console.log("- Embeddings length:", firstDoc.embeddings?.length)
          
          if (firstDoc.chunks && firstDoc.chunks.length > 0) {
            const c0: any = firstDoc.chunks[0] as any
            const prev = typeof c0 === 'string' ? c0.substring(0, 100) : c0.content?.substring(0, 100)
            console.log("- First chunk preview:", prev)
          }
          
          if (firstDoc.embeddings && firstDoc.embeddings.length > 0) {
            console.log("- First embedding dimensions:", firstDoc.embeddings[0]?.length)
            console.log("- Question embedding dimensions:", questionEmbedding.length)
          }
        }
      }
      
      // Fallback strategies if no chunks found
      if (relevantChunks.length === 0) {
        console.warn("No relevant chunks found - attempting fallback strategies...")
        
        // Strategy 1: Try broader keyword search
        const keywordChunks = this.fallbackKeywordSearch(processedQuestion, expandedQueries, 10)
        if (keywordChunks.length > 0) {
          console.log(`Fallback keyword search found ${keywordChunks.length} chunks`)
          relevantChunks = keywordChunks
        }
        
        // Strategy 2: Try semantic search with MUCH lower threshold
        if (relevantChunks.length === 0) {
          console.log("Attempting semantic search with very low threshold (0.005)...")
          const lowThresholdChunks = this.findRelevantChunks(
            questionEmbedding,
            adjustedChunkLimit * 2, // Get more chunks
            filters,
            processedQuestion,
            useRRF,
            useReranking,
            alternativeEmbeddings,
            0.005 // Very low threshold to catch anything remotely relevant
          )
          if (lowThresholdChunks.length > 0) {
            console.log(`Low-threshold search found ${lowThresholdChunks.length} chunks`)
            relevantChunks = lowThresholdChunks
          }
        }
        
        // Strategy 3: Return top chunks by importance if still nothing
        if (relevantChunks.length === 0) {
          console.log("Attempting importance-based retrieval...")
          const importanceChunks = this.getTopChunksByImportance(10)
          if (importanceChunks.length > 0) {
            console.log(`Importance-based retrieval found ${importanceChunks.length} chunks`)
            relevantChunks = importanceChunks
          }
        }
        
        // If still no chunks, provide helpful response
        if (relevantChunks.length === 0) {
          const clarificationPrompt = this.generateClarificationPrompt(question, vaguenessScore)
        return {
          question,
          relevantChunks: [],
          context: "",
            initialResponse: clarificationPrompt,
          questionType,
          tokensUsed: 0
          }
        }
      }

      // Optimize chunks for token budget
      console.log("Optimizing chunks for token budget:", tokenBudget * 0.7)
      const optimizedChunks = this.optimizeChunksForTokens(relevantChunks, tokenBudget * 0.7)
      console.log(`Optimized to ${optimizedChunks.length} chunks`)
      
      const context = optimizedChunks.map((chunk: any) => chunk.content).join("\n\n");
      console.log("Context length:", context.length, "characters")
      
      // Generate initial response with enhanced prompt (include conversation history)
      const systemPrompt = this.createEnhancedSystemPrompt(questionType)
      const userPrompt = this.createPhase1UserPrompt(question, context, conversationHistory)
      
      console.log("Generating AI response...")
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system" as const, content: systemPrompt }
      ]
      
      // Add conversation history if available (last 5 exchanges to avoid token limits)
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-10) // Last 10 messages (5 exchanges)
        console.log(`Including ${recentHistory.length} previous messages in context`)
        recentHistory.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content })
        })
      }
      
      // Add current question
      messages.push({ role: "user" as const, content: userPrompt })

      // Generate response with low temperature for deterministic, factual responses
      const initialResponse = await this.aiClient!.generateText(messages, { temperature: 0.1 });
      console.log("AI response generated, length:", initialResponse.length)

      // Groundedness check: Verify response is based on retrieved chunks
      const groundednessResult = this.checkGroundedness(initialResponse, optimizedChunks, question)
      if (!groundednessResult.isGrounded) {
        console.warn("⚠️ Groundedness check failed - response may contain hallucinations")
        console.warn("Unverified claims:", groundednessResult.unverifiedClaims)
        
        // Regenerate with stricter prompt if groundedness is too low
        if (groundednessResult.groundednessScore < 0.5) {
          console.log("Regenerating response with stricter anti-hallucination prompt...")
          const strictPrompt = this.createStrictAntiHallucinationPrompt(question, context, optimizedChunks)
          const messagesStrict = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: strictPrompt }
          ]
          const regeneratedResponse = await this.aiClient!.generateText(messagesStrict, { temperature: 0.1 })
          
          // Re-check groundedness
          const regroundedness = this.checkGroundedness(regeneratedResponse, optimizedChunks, question)
          if (regroundedness.groundednessScore > groundednessResult.groundednessScore) {
            console.log("✅ Regenerated response has better groundedness")
      return {
        question,
        relevantChunks: optimizedChunks,
        context: context,
              initialResponse: this.enforceCitations(regeneratedResponse, optimizedChunks).trim(),
        questionType,
              tokensUsed: this.estimateTokens(systemPrompt + strictPrompt + regeneratedResponse),
              groundednessScore: regroundedness.groundednessScore
            }
          }
        }
      }
      
      // Enforce citations in response
      const responseWithCitations = this.enforceCitations(initialResponse, optimizedChunks)

      return {
        question,
        relevantChunks: optimizedChunks,
        context: context,
        initialResponse: responseWithCitations.trim(),
        questionType,
        tokensUsed: this.estimateTokens(systemPrompt + userPrompt + responseWithCitations),
        groundednessScore: groundednessResult.groundednessScore
      }
    } catch (error) {
      console.error("Error in phase1_ContextAnalysis:", error)
      return {
        question,
        relevantChunks: [],
        context: "",
        initialResponse: `Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        questionType: 'general',
        tokensUsed: 0
      }
    }
  }

  private async phase2_SelfCritique(phase1Result: any, tokenBudget: number) {
    console.log("Phase 2: Self-Critique and Validation")
    
    const critiquePrompt = this.createCritiquePrompt(phase1Result)
    
    const messages = [
      { 
        role: "system" as const, 
        content: "You are an AI critic. Review the response for accuracy, completeness, and source attribution. Use this format: ✓=verified, ?=uncertain, !=conflict, ∅=missing" 
      },
      { role: "user" as const, content: critiquePrompt }
    ];

      // Use low temperature for critique to ensure consistent evaluation
      const critiqueResponse = await this.aiClient!.generateText(messages, { temperature: 0.1 });
    
    // Parse critique response for issues
    const issues = this.parseCritiqueResponse(critiqueResponse)
    
    return {
      critiqueText: critiqueResponse.trim(),
      identifiedIssues: issues,
      tokensUsed: this.estimateTokens(critiquePrompt + critiqueResponse)
    }
  }

  private async phase3_Refinement(
    phase1Result: any, 
    phase2Result: any, 
    tokenBudget: number,
    showThinking: boolean
  ): Promise<EnhancedQueryResponse> {
    console.log("Phase 3: Refinement and Final Response")
    
    let refinementPrompt: string
    let finalResponse: string
    
    if (phase2Result) {
      // Complex processing with refinement
      refinementPrompt = this.createRefinementPrompt(phase1Result, phase2Result)
      
      const messages = [
        { 
          role: "system" as const, 
          content: "You are a professional document analyst. Create polished, clean responses without meta-commentary, confidence ratings, or system artifacts. Focus on direct, helpful answers using proper markdown formatting." 
        },
        { role: "user" as const, content: refinementPrompt }
      ];

      // Use low temperature for final response to reduce hallucinations
      finalResponse = await this.aiClient!.generateText(messages, { temperature: 0.1 });
      
      // Final groundedness check and citation enforcement
      const finalGroundedness = this.checkGroundedness(finalResponse, phase1Result.relevantChunks, phase1Result.question)
      if (!finalGroundedness.isGrounded) {
        console.warn("⚠️ Final response groundedness check failed")
        // Enforce citations and remove unverified claims
        finalResponse = this.enforceCitations(finalResponse, phase1Result.relevantChunks)
        finalResponse = this.removeUnverifiedClaims(finalResponse, finalGroundedness.unverifiedClaims)
      } else {
        // Still enforce citations even if grounded
        finalResponse = this.enforceCitations(finalResponse, phase1Result.relevantChunks)
      }
    } else {
      // Simple processing - use initial response
      finalResponse = phase1Result.initialResponse
    }

    // Clean up the response - remove any artifacts
    finalResponse = this.cleanResponse(finalResponse)

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      phase1Result, 
      phase2Result, 
      finalResponse
    )

    // Prepare final response
    let answer = finalResponse.trim()
    
    // Add thinking process if requested (but keep it clean)
    if (showThinking && phase2Result) {
      const thinkingSection = `## 🤔 AI Reasoning Process

### Initial Analysis
${phase1Result.initialResponse.substring(0, 200)}${phase1Result.initialResponse.length > 200 ? '...' : ''}

### Critical Review
${phase2Result.critiqueText.substring(0, 200)}${phase2Result.critiqueText.length > 200 ? '...' : ''}

### Final Enhancement
Applied improvements based on critical review to ensure accuracy and clarity.

---

## Response

`
      answer = thinkingSection + finalResponse.trim()
    }

    // Calculate token usage
    const tokenUsage = {
      contextTokens: phase1Result.tokensUsed,
      reasoningTokens: phase2Result?.tokensUsed || 0,
      responseTokens: this.estimateTokens(finalResponse),
      totalTokens: phase1Result.tokensUsed + (phase2Result?.tokensUsed || 0) + this.estimateTokens(finalResponse)
    }

    // Prepare sources
    const sources = Array.from(
      new Set(phase1Result.relevantChunks.map((chunk: any) => chunk.source))
    ).filter(Boolean) as string[];

    // Check for hallucinations in final response
    const finalGroundedness = phase1Result.groundednessScore !== undefined 
      ? phase1Result.groundednessScore 
      : this.checkGroundedness(finalResponse, phase1Result.relevantChunks, phase1Result.question).groundednessScore
    
    const hallucinationDetected = phase2Result?.identifiedIssues?.some((issue: string) => 
      issue.toLowerCase().includes('hallucination') || issue.toLowerCase().includes('invented') || issue.toLowerCase().includes('fabricated')
    ) || false

    return {
      answer,
      sources,
      relevanceScore: this.calculateRelevanceScore(phase1Result.relevantChunks),
      retrievedChunks: phase1Result.relevantChunks,
      reasoning: phase2Result ? {
        initialThoughts: phase1Result.initialResponse,
        criticalReview: phase2Result.critiqueText,
        finalRefinement: "Enhanced response based on critical analysis"
      } : undefined,
      qualityMetrics,
      tokenUsage,
      groundednessScore: finalGroundedness,
      hallucinationDetected
    }
  }

  private cleanResponse(response: string): string {
    // Remove common artifacts and unwanted elements
    let cleaned = response
      .replace(/\*\*Confidence:\s*(HIGH|MEDIUM|LOW)\*\*/gi, '')
      .replace(/Confidence:\s*(HIGH|MEDIUM|LOW)/gi, '')
      .replace(/\*\*Rating\*\*/gi, '')
      .replace(/Rating:/gi, '')
      .replace(/This revised response addresses.*?by:/gi, '')
      .replace(/The above.*?claims made\./gi, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim()

    // Remove any trailing meta-commentary patterns
    const metaPatterns = [
      /This response addresses.*$/gmi,
      /The above analysis.*$/gmi,
      /This revised.*$/gmi,
      /Note:.*$/gmi
    ]

    metaPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '')
    })

    return cleaned.trim()
  }

  /**
   * Detect if a question is vague (lacks specificity)
   * Returns score 0-1, where 0 = clear/specific, 1 = very vague
   * 
   * IMPORTANT: Normal question words like "what", "explain", "describe" are NOT vague by themselves.
   * A question is vague only if it lacks specific context or subject matter.
   */
  private detectVagueness(question: string): number {
    if (!question || question.trim().length < 3) return 1.0
    
    const questionLower = question.toLowerCase().trim()
    const words = questionLower.split(/\s+/)
    let vaguenessScore = 0
    
    // Very short questions are potentially vague
    if (words.length <= 2) vaguenessScore += 0.3
    if (words.length === 1) vaguenessScore += 0.4
    
    // Count meaningful content words (not stop words, not question words)
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
      'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
      'tell', 'me', 'about', 'explain', 'describe', 'give', 'show', 'please', 'i'
    ])
    
    const contentWords = words.filter(w => w.length > 2 && !stopWords.has(w))
    
    // Questions with no meaningful content words are vague
    if (contentWords.length === 0) {
      vaguenessScore += 0.6
    } else if (contentWords.length === 1) {
      vaguenessScore += 0.2
    }
    
    // Truly vague patterns - pronouns without clear antecedent
    const trulyVaguePatterns = [
      /^(what|how|why)\s+(is|are|was|were)?\s*(it|this|that)\s*\?*$/i, // "What is it?", "What is this?"
      /^(tell|explain|describe)\s+(me\s+)?(about\s+)?(it|this|that)\s*\?*$/i, // "Tell me about it"
      /^(what|how)\s*\?*$/i, // Just "what?" or "how?"
      /^(yes|no|ok|okay|sure|maybe|perhaps)\s*\?*$/i, // Non-questions
    ]
    
    for (const pattern of trulyVaguePatterns) {
      if (pattern.test(questionLower)) {
        vaguenessScore += 0.4
        break
      }
    }
    
    // Check for specific indicators that make a question clear (REDUCES vagueness)
    const specificityIndicators = [
      /\b(article|section|chapter|clause|rule|paragraph|page)\s+\d+/i, // Document references
      /\b\d+\.?\d*\s*(%|percent|percentage)/i, // Percentages
      /\b\d{4}\b/, // Years
      /\b(first|second|third|last|main|primary|key|important)\b/i, // Ordinals and importance
      /\b(definition|meaning|purpose|requirement|process|step|method)\b/i, // Specific query types
      /\b(compare|difference|between|versus|vs\.?)\b/i, // Comparison questions
      /\b(list|enumerate|summarize|outline)\b/i, // Action requests
      /"[^"]+"/i, // Quoted terms
    ]
    
    for (const pattern of specificityIndicators) {
      if (pattern.test(questionLower)) {
        vaguenessScore -= 0.15
      }
    }
    
    return Math.max(0, Math.min(1.0, vaguenessScore))
  }

  /**
   * Expand vague questions into more specific queries
   */
  private async expandVagueQuery(question: string): Promise<{
    expandedQuery: string
    alternativeQueries: string[]
  }> {
    try {
      // Use AI to expand the query
      const expansionPrompt = `You are a query expansion expert. The user asked a vague question that needs to be made more specific.

ORIGINAL VAGUE QUESTION: "${question}"

TASK: Expand this question into a more specific, detailed query that would help find relevant information in documents.

GUIDELINES:
1. Keep the core intent of the original question
2. Add specific terms, context, and details that would help retrieval
3. Generate 3 alternative phrasings of the expanded query
4. Focus on what information the user is likely seeking

OUTPUT FORMAT:
EXPANDED: [one clear, specific version of the question]
ALTERNATIVE 1: [first alternative phrasing]
ALTERNATIVE 2: [second alternative phrasing]
ALTERNATIVE 3: [third alternative phrasing]

Only output the expanded query and alternatives, nothing else.`

      const messages = [
        { role: "system" as const, content: "You are a query expansion expert. Expand vague questions into specific, searchable queries." },
        { role: "user" as const, content: expansionPrompt }
      ]
      
      const expansionResponse = await this.aiClient!.generateText(messages, { temperature: 0.3 })
      
      // Parse the response
      const expandedMatch = expansionResponse.match(/EXPANDED:\s*(.+)/i)
      const alt1Match = expansionResponse.match(/ALTERNATIVE\s+1:\s*(.+)/i)
      const alt2Match = expansionResponse.match(/ALTERNATIVE\s+2:\s*(.+)/i)
      const alt3Match = expansionResponse.match(/ALTERNATIVE\s+3:\s*(.+)/i)
      
      const expandedQuery = expandedMatch?.[1]?.trim() || question
      const alternativeQueries = [
        alt1Match?.[1]?.trim(),
        alt2Match?.[1]?.trim(),
        alt3Match?.[1]?.trim()
      ].filter(Boolean) as string[]
      
      return {
        expandedQuery,
        alternativeQueries
      }
    } catch (error) {
      console.warn("Query expansion failed, using original question:", error)
      // Fallback: simple keyword-based expansion
      return {
        expandedQuery: question,
        alternativeQueries: this.generateSimpleAlternatives(question)
      }
    }
  }

  /**
   * Generate simple alternative queries without AI
   */
  private generateSimpleAlternatives(question: string): string[] {
    const alternatives: string[] = []
    const questionLower = question.toLowerCase()
    
    // Add "what is" if missing
    if (!/^(what|how|why|when|where|who|which)/i.test(question)) {
      alternatives.push(`What is ${question}`)
    }
    
    // Add "explain" variant
    if (!questionLower.includes('explain')) {
      alternatives.push(`Explain ${question}`)
    }
    
    // Add "information about" variant
    alternatives.push(`Information about ${question}`)
    
    return alternatives.slice(0, 3)
  }

  /**
   * Fallback keyword search when semantic search fails
   * Uses improved keyword extraction and lower thresholds for vague queries
   */
  private fallbackKeywordSearch(
    question: string,
    alternativeQueries: string[],
    limit: number
  ): Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: any }> {
    console.log("Performing enhanced fallback keyword search...")
    
    // Comprehensive stop words list
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'all', 'each', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'and', 'or', 'but', 'if', 'because', 'until',
      'while', 'although', 'though', 'after', 'before', 'when', 'where', 'why',
      'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
      'am', 'tell', 'me', 'about', 'explain', 'describe', 'give', 'show', 'please',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
      'its', 'our', 'their', 'any', 'every', 'many', 'much', 'both', 'either',
      'neither', 'also', 'even', 'still', 'already', 'yet', 'ever', 'never'
    ])
    
    // Extract keywords from question and alternatives
    const allQueries = [question, ...alternativeQueries]
    const keywords = new Set<string>()
    const keywordWeights = new Map<string, number>()
    
    for (const query of allQueries) {
      // Extract meaningful words
      const words = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
      
      words.forEach(w => {
        keywords.add(w)
        // Weight words that appear in multiple queries higher
        keywordWeights.set(w, (keywordWeights.get(w) || 0) + 1)
      })
      
      // Also extract potential n-grams (2-word phrases)
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`
        keywords.add(bigram)
        keywordWeights.set(bigram, (keywordWeights.get(bigram) || 0) + 1.5) // Bigrams get extra weight
      }
    }
    
    const keywordArray = Array.from(keywords)
    console.log(`Searching for ${keywordArray.length} keywords/phrases: ${keywordArray.slice(0, 10).join(', ')}${keywordArray.length > 10 ? '...' : ''}`)
    
    const results: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: any }> = []
    
    // Search through all chunks
    for (const doc of this.documents) {
      if (!doc.chunks || !doc.chunks.length) continue
      
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i]
        const chunkContent = typeof chunk === 'string' ? chunk : chunk.content || ''
        const chunkLower = chunkContent.toLowerCase()
        
        // Count weighted keyword matches
        let weightedMatchScore = 0
        let matchCount = 0
        
        for (const keyword of keywordArray) {
          if (chunkLower.includes(keyword)) {
            matchCount++
            const weight = keywordWeights.get(keyword) || 1
            // Count occurrences for frequency bonus
            const occurrences = (chunkLower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
            weightedMatchScore += weight * Math.min(1 + Math.log10(occurrences + 1), 2)
          }
        }
        
        // Calculate relevance score based on weighted keyword matches
        if (matchCount > 0) {
          const maxPossibleScore = Array.from(keywordWeights.values()).reduce((a, b) => a + b, 0) * 2
          const normalizedScore = weightedMatchScore / Math.max(maxPossibleScore, 1)
          const keywordRelevance = this.calculateKeywordRelevance(question, chunkContent)
          const combinedScore = Math.max(normalizedScore, keywordRelevance, matchCount / keywordArray.length)
          
          // Very low threshold - any match is worth considering
          if (combinedScore > 0.05 || matchCount >= 2) {
            const chunkMetadata = typeof chunk === 'object' && 'metadata' in chunk ? chunk.metadata : null
            let sourceString = `${doc.name || "Unknown Document"} (chunk ${i + 1})`
            if (chunkMetadata?.page !== undefined) {
              sourceString = `${doc.name} · p.${chunkMetadata.page}`
            }
            
            results.push({
              content: chunkContent,
              source: sourceString,
              similarity: combinedScore,
              documentId: doc.id,
              documentName: doc.name || "Unknown",
              semanticImportance: matchCount >= 3 ? 0.7 : 0.5,
              matchCount, // Include for debugging
              ...(chunkMetadata || {})
            })
          }
        }
      }
    }
    
    // Sort by relevance and return top results
    results.sort((a, b) => b.similarity - a.similarity)
    console.log(`Fallback keyword search found ${results.length} results, returning top ${limit}`)
    return results.slice(0, limit)
  }

  /**
   * Get top chunks by semantic importance when retrieval fails
   */
  private getTopChunksByImportance(limit: number): Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: any }> {
    console.log("Retrieving top chunks by importance...")
    
    const results: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: any }> = []
    
    for (const doc of this.documents) {
      if (!doc.chunks || !doc.chunks.length) continue
      
      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i]
        const chunkContent = typeof chunk === 'string' ? chunk : chunk.content || ''
        const chunkMetadata = typeof chunk === 'object' && 'metadata' in chunk ? chunk.metadata : null
        
        // Calculate importance based on metadata
        let importance = 0.5 // Base importance
        
        if (chunkMetadata) {
          // Headings are more important
          if (chunkMetadata.type === 'heading') {
            importance += 0.3
            if (chunkMetadata.level && chunkMetadata.level <= 2) {
              importance += 0.2 // Top-level headings are very important
            }
          }
          
          // Tables and lists are important
          if (chunkMetadata.type === 'table' || chunkMetadata.type === 'list') {
            importance += 0.2
          }
          
          // Early pages/chunks might be more important (introductions, summaries)
          if (chunkMetadata.page && chunkMetadata.page <= 5) {
            importance += 0.1
          }
        }
        
        // Longer chunks might contain more information
        if (chunkContent.length > 200) {
          importance += 0.1
        }
        
        let sourceString = `${doc.name || "Unknown Document"} (chunk ${i + 1})`
        if (chunkMetadata?.page !== undefined) {
          sourceString = `${doc.name} · p.${chunkMetadata.page}`
        }
        
        results.push({
          content: chunkContent,
          source: sourceString,
          similarity: importance, // Use importance as similarity score
          documentId: doc.id,
          documentName: doc.name || "Unknown",
          semanticImportance: importance,
          ...(chunkMetadata || {})
        })
      }
    }
    
    // Sort by importance and return top results
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, limit)
  }

  /**
   * Generate clarification prompt for vague questions
   */
  private generateClarificationPrompt(question: string, vaguenessScore: number): string {
    const docCount = this.documents.length
    const totalChunks = this.documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0)
    
    let prompt = `I couldn't find specific information to answer your question: "${question}"\n\n`
    
    if (vaguenessScore > 0.6) {
      prompt += `**Your question is quite vague.** To help me find the right information, could you:\n\n`
      prompt += `1. **Be more specific**: What exactly are you looking for?\n`
      prompt += `2. **Add context**: What topic or subject area is this about?\n`
      prompt += `3. **Specify details**: Are you looking for:\n`
      prompt += `   - A definition or explanation?\n`
      prompt += `   - Specific numbers, dates, or facts?\n`
      prompt += `   - A process or procedure?\n`
      prompt += `   - A comparison or analysis?\n\n`
    } else {
      prompt += `**I couldn't find relevant information in the documents.** This might be because:\n\n`
      prompt += `1. The question doesn't match the document content\n`
      prompt += `2. The information might be phrased differently in the documents\n`
      prompt += `3. Try rephrasing your question with more specific terms\n\n`
    }
    
    prompt += `**Available documents:** ${docCount} document(s) with ${totalChunks} total chunks.\n\n`
    prompt += `**Suggestions:**\n`
    prompt += `- Try asking about specific topics, sections, or concepts from the documents\n`
    prompt += `- Use more specific keywords or terms\n`
    prompt += `- Ask "What topics are covered in these documents?" to see what's available`
    
    return prompt
  }

  private analyzeQuestionType(question: string): string {
    const questionLower = question.toLowerCase()
    
    if (/(what are|list|summary|key points|main|overview)/i.test(question)) {
      return 'summary'
    } else if (/(how|why|explain|analyze|compare)/i.test(question)) {
      return 'analysis'
    } else if (/(when|date|time|timeline)/i.test(question)) {
      return 'timeline'
    } else if (/(number|amount|cost|price|data|statistics)/i.test(question)) {
      return 'data'
    } else if (/(process|steps|procedure|method)/i.test(question)) {
      return 'process'
    } else if (/(difference|versus|vs|compared to)/i.test(question)) {
      return 'comparison'
    }
    
    return 'general'
  }

  /**
   * Analyze question to determine if it requires specific content types
   * Returns multipliers for different content types based on question context
   */
  private analyzeQuestionForContentTypes(question: string): {
    tableBoost: number
    imageBoost: number
    equationBoost: number
    dataBoost: number
  } {
    const q = question.toLowerCase()
    
    let tableBoost = 1.0
    let imageBoost = 1.0
    let equationBoost = 1.0
    let dataBoost = 1.0

    // Table-related queries
    if (/\b(table|column|row|cell|spreadsheet|grid|matrix|compare|comparison|versus|vs)\b/.test(q)) {
      tableBoost = 1.5
      dataBoost = 1.3
    }

    // Data/numerical queries
    if (/\b(number|data|statistic|percentage|percent|%|amount|count|total|sum|average|mean|median|value|figure|metric|kpi|rate)\b/.test(q)) {
      dataBoost = 1.5
      tableBoost = 1.3
    }

    // Image/visual queries  
    if (/\b(image|picture|photo|diagram|chart|graph|visual|illustration|figure|screenshot|show|display|look)\b/.test(q)) {
      imageBoost = 1.5
    }

    // Equation/formula queries
    if (/\b(equation|formula|calculate|calculation|math|mathematical|derivative|integral|function|solve|compute|algorithm)\b/.test(q)) {
      equationBoost = 1.5
      dataBoost = 1.2
    }

    // Chart/graph specific
    if (/\b(trend|growth|decline|increase|decrease|change|over time|timeline|progression|bar|line|pie|scatter)\b/.test(q)) {
      imageBoost = 1.4
      tableBoost = 1.3
      dataBoost = 1.3
    }

    return { tableBoost, imageBoost, equationBoost, dataBoost }
  }

  private getOptimalChunkLimit(questionType: string): number {
    const limits = {
      'summary': 8,
      'analysis': 6, 
      'timeline': 10,
      'data': 5,
      'process': 7,
      'comparison': 8,
      'general': 5
    }
    
    return limits[questionType as keyof typeof limits] || 5
  }

  /**
   * Optimize chunks for token budget with deduplication and smart truncation
   */
  private optimizeChunksForTokens(chunks: any[], tokenBudget: number) {
    // Step 1: Deduplicate chunks (remove near-duplicates)
    const deduplicatedChunks = this.deduplicateChunks(chunks)
    console.log(`Deduplication: ${chunks.length} -> ${deduplicatedChunks.length} chunks`)
    
    let totalTokens = 0
    const optimizedChunks = []
    
    // Step 2: Add chunks within budget
    for (const chunk of deduplicatedChunks) {
      const chunkTokens = this.estimateTokens(chunk.content)
      
      if (totalTokens + chunkTokens <= tokenBudget) {
        optimizedChunks.push(chunk)
        totalTokens += chunkTokens
      } else if (totalTokens + chunkTokens <= tokenBudget * 1.1 && optimizedChunks.length < 3) {
        // Allow slight overflow for critical chunks (first 3)
        optimizedChunks.push(chunk)
        totalTokens += chunkTokens
      } else if (tokenBudget - totalTokens > 100) {
        // Try to fit a truncated version if we have space
        const availableTokens = tokenBudget - totalTokens
        const truncatedContent = this.smartTruncateChunk(chunk.content, availableTokens)
        if (truncatedContent.length > 100) {
          optimizedChunks.push({ ...chunk, content: truncatedContent, truncated: true })
          break
        }
      }
    }
    
    console.log(`Token budget: ${tokenBudget}, used: ${totalTokens}, chunks: ${optimizedChunks.length}`)
    return optimizedChunks
  }

  /**
   * Deduplicate chunks by removing near-duplicates
   * Uses Jaccard similarity to detect overlap
   */
  private deduplicateChunks(chunks: any[]): any[] {
    if (chunks.length <= 1) return chunks
    
    const SIMILARITY_THRESHOLD = 0.7 // 70% similarity = duplicate
    const deduplicated: any[] = []
    
    for (const chunk of chunks) {
      const chunkWords = new Set(
        chunk.content.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
      )
      
      // Check if this chunk is too similar to any already selected chunk
      let isDuplicate = false
      for (const existing of deduplicated) {
        const existingWords = new Set(
          existing.content.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter((w: string) => w.length > 3)
        )
        
        // Calculate Jaccard similarity
        const intersection = new Set([...chunkWords].filter(x => existingWords.has(x)))
        const union = new Set([...chunkWords, ...existingWords])
        const similarity = intersection.size / union.size
        
        if (similarity > SIMILARITY_THRESHOLD) {
          isDuplicate = true
          // Keep the longer/more detailed chunk
          if (chunk.content.length > existing.content.length) {
            const idx = deduplicated.indexOf(existing)
            deduplicated[idx] = chunk
          }
          break
        }
      }
      
      if (!isDuplicate) {
        deduplicated.push(chunk)
      }
    }
    
    return deduplicated
  }

  /**
   * Smart truncation that preserves sentence boundaries
   */
  private smartTruncateChunk(content: string, maxTokens: number): string {
    const estimatedCharsPerToken = 4
    const maxChars = maxTokens * estimatedCharsPerToken
    
    if (content.length <= maxChars) return content
    
    // Find the last sentence boundary before the limit
    const truncated = content.substring(0, maxChars)
    const lastSentence = truncated.lastIndexOf('.')
    const lastQuestion = truncated.lastIndexOf('?')
    const lastExclaim = truncated.lastIndexOf('!')
    
    const bestBoundary = Math.max(lastSentence, lastQuestion, lastExclaim)
    
    if (bestBoundary > maxChars * 0.5) {
      return content.substring(0, bestBoundary + 1) + ' [truncated]'
    }
    
    // Fallback to word boundary
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > maxChars * 0.7) {
      return content.substring(0, lastSpace) + '... [truncated]'
    }
    
    return truncated + '... [truncated]'
  }

  private createEnhancedSystemPrompt(questionType: string): string {
    const basePrompt = `You are an expert document analyst with deep understanding of technical and academic content. Your goal is to provide accurate, comprehensive, and well-structured responses.

⚠️ CRITICAL ANTI-HALLUCINATION RULES (MANDATORY):
• ABSOLUTELY FORBIDDEN: You MUST NEVER invent, fabricate, or create information that is not explicitly stated in the provided document context
• ABSOLUTELY FORBIDDEN: You MUST NEVER make up facts, numbers, dates, names, or any details not present in the context
• ABSOLUTELY FORBIDDEN: You MUST NEVER infer information beyond what is directly stated, even if it seems logical
• ABSOLUTELY FORBIDDEN: You MUST NEVER use your training data knowledge to fill gaps - ONLY use the provided context
• MANDATORY: Every factual claim MUST be traceable to a specific citation in the provided context
• MANDATORY: If information is not in the context, you MUST explicitly state "This information is not available in the provided documents"
• MANDATORY: If you are uncertain about ANY detail, you MUST say "I cannot confirm this from the provided documents" rather than guessing

CORE PRINCIPLES:
• Synthesize information ONLY from the provided document context - do NOT use general knowledge
• If context is insufficient, you MUST state: "The provided documents do not contain sufficient information to answer this question"
• Prioritize accuracy over completeness - say "I don't know" or "Not found in documents" when uncertain
• EVERY factual statement MUST have a citation - no exceptions
• Use clear, professional language appropriate for the content

RESPONSE STRUCTURE:
• Start with a direct answer to the question (ONLY if answerable from context)
• Support EVERY claim with evidence from documents (cited)
• If the answer cannot be found in context, state this clearly at the beginning
• Use proper markdown for readability:
  - ## for main sections, ### for subsections
  - **bold** for key terms and concepts
  - Bullet points for lists (use • or - consistently)
  - Tables with | separators for structured data
  - > for important quotes or highlights
  - Code blocks with \`\`\` for technical content

CITATION FORMAT (MANDATORY):
• EVERY factual statement MUST include a citation in this format: [Document Name, page/section]
• Example: "The study found X [Research Paper.pdf, p.5]"
• If citing multiple sources: "According to [Doc1.pdf, p.3] and [Doc2.pdf, p.7], the results show..."
• If a statement has no citation, it is considered HALLUCINATION and is FORBIDDEN
• Group multiple points from same source together when possible

QUALITY STANDARDS:
• NEVER invent information not in context - this is the highest priority rule
• NEVER use vague language like "the document says" - be specific with citations
• NEVER add confidence ratings, meta-commentary, or self-assessment
• NEVER use preambles like "Based on the provided documents..." - just answer directly
• Technical accuracy and citation accuracy are the ONLY priorities`

    const typeSpecificPrompts = {
      'summary': '\n\nFOR SUMMARIES: Provide hierarchical overview with main themes, key findings, and supporting details. Use headings to organize major topics.',
      'analysis': '\n\nFOR ANALYSIS: Present systematic examination with: 1) Context/Background, 2) Key Findings with evidence, 3) Implications or Conclusions. Connect concepts logically.',
      'timeline': '\n\nFOR TIMELINES: Create chronological table or ordered list with dates, events, and significance. Format: Date | Event | Details | Source.',
      'data': '\n\nFOR DATA QUERIES: Present numbers in well-formatted tables with headers, units, and context. Explain what the data means.',
      'process': '\n\nFOR PROCESSES: Use numbered steps with clear action items. Include prerequisites, main steps, and expected outcomes.',
      'comparison': '\n\nFOR COMPARISONS: Use side-by-side table or structured sections showing: similarities, differences, and relative strengths/limitations.',
      'general': '\n\nFOR GENERAL QUERIES: Structure response with clear sections. Use headings, lists, and examples to enhance clarity.'
    }

    return basePrompt + (typeSpecificPrompts[questionType as keyof typeof typeSpecificPrompts] || typeSpecificPrompts.general)
  }

  private createPhase1UserPrompt(question: string, context: string, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    let prompt = `CONTEXT FROM DOCUMENTS:
${context}

QUESTION: ${question}`

    // Add conversation context note if history exists
    if (conversationHistory && conversationHistory.length > 0) {
      prompt += `\n\nCONVERSATION CONTEXT: The user has asked follow-up questions. Use the conversation history above to understand references like "it", "that", "this", or follow-up questions.`
    }

    prompt += `\n\n⚠️ CRITICAL INSTRUCTIONS:
1. Answer ONLY using information explicitly stated in the CONTEXT above
2. If the answer is not in the CONTEXT, you MUST state: "The provided documents do not contain information to answer this question"
3. EVERY factual statement MUST include a citation: [Document Name, page/section]
4. DO NOT invent, infer, or create any information not in the CONTEXT
5. DO NOT use your general knowledge - ONLY use the CONTEXT provided
6. If you are uncertain about ANY detail, state "I cannot confirm this from the provided documents"
7. If this is a follow-up question, use the conversation history to understand context and references`

    prompt += `\n\nProvide a direct, well-formatted response based STRICTLY on the context above. Use clean markdown formatting and ensure EVERY claim has a citation.`
    
    return prompt
  }

  /**
   * Resolve conversation context - expand pronouns and follow-up questions
   */
  private async resolveConversationContext(
    question: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    // Check if question contains pronouns or is a follow-up
    const hasPronouns = /\b(it|this|that|these|those|they|them|he|she|him|her)\b/i.test(question)
    const isFollowUp = question.length < 30 || /^(what|how|why|when|where|who|which|tell me|explain|describe|can you|will you)\s+/i.test(question)
    
    if (!hasPronouns && !isFollowUp) {
      return question // No resolution needed
    }

    try {
      // Use AI to resolve context
      const contextResolutionPrompt = `You are a conversation context resolver. The user asked a question that may reference previous conversation.

CONVERSATION HISTORY:
${conversationHistory.slice(-6).map((msg, i) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

CURRENT QUESTION: "${question}"

TASK: If the question contains pronouns (it, this, that, etc.) or is a follow-up question, expand it to be self-contained and clear. Replace pronouns with the actual subjects from the conversation history.

OUTPUT FORMAT:
RESOLVED: [expanded question with pronouns replaced and context added]

If the question is already clear and self-contained, just repeat it with "RESOLVED: " prefix.

Only output the resolved question, nothing else.`

      const messages = [
        { role: "system" as const, content: "You are a conversation context resolver. Expand questions with pronouns or follow-ups to be self-contained." },
        { role: "user" as const, content: contextResolutionPrompt }
      ]

      const resolved = await this.aiClient!.generateText(messages, { temperature: 0.1 })
      const resolvedMatch = resolved.match(/RESOLVED:\s*(.+)/i)
      
      if (resolvedMatch && resolvedMatch[1]) {
        const resolvedQuestion = resolvedMatch[1].trim()
        console.log(`Context resolved: "${question}" → "${resolvedQuestion}"`)
        return resolvedQuestion
      }
      
      return question // Fallback to original
    } catch (error) {
      console.warn("Context resolution failed, using original question:", error)
      return question
    }
  }

  private createCritiquePrompt(phase1Result: any): string {
    return `You are a critical reviewer evaluating response quality and checking for HALLUCINATIONS. Review this response with extreme scrutiny.

QUESTION: ${phase1Result.question}

ORIGINAL CONTEXT:
${phase1Result.context}

INITIAL RESPONSE:
${phase1Result.initialResponse}

⚠️ CRITICAL HALLUCINATION DETECTION CHECKLIST:
1. HALLUCINATION CHECK: Does EVERY factual claim appear in the ORIGINAL CONTEXT above?
   - Check each number, date, name, statistic, and specific detail
   - Mark ANY claim not explicitly in ORIGINAL CONTEXT as HALLUCINATION
   - Look for invented facts, made-up numbers, or fabricated details

2. CITATION VERIFICATION: Does EVERY claim have a proper citation?
   - Format: [Document Name, page/section]
   - NO uncited factual statements are allowed
   - Verify citations match actual sources

3. ACCURACY: Are all facts supported by ORIGINAL CONTEXT or clearly marked as "not found"?
   - Compare response claims word-by-word against ORIGINAL CONTEXT
   - Flag any inference, assumption, or deduction beyond explicit statements

4. COMPLETENESS: Does it fully address all parts of the question using ONLY context?
5. CLARITY: Is the explanation clear and well-organized?
6. FORMAT: Is markdown clean and consistent?
7. RELEVANCE: Does it stay focused on the question?

For each issue found, note:
• ✓ = Verified in ORIGINAL CONTEXT and good
• ? = Uncertain or needs clarification
• ! = HALLUCINATION detected - claim not in ORIGINAL CONTEXT
• ∅ = Missing important information
• 🚫 = INVENTED/FABRICATED information (highest priority to flag)

MANDATORY: Flag ALL hallucinations (claims not in ORIGINAL CONTEXT) with 🚫. Provide specific, actionable feedback focusing on removing ALL hallucinations.`
  }

  private createRefinementPrompt(phase1Result: any, phase2Result: any): string {
    return `QUESTION: ${phase1Result.question}

ORIGINAL CONTEXT:
${phase1Result.context}

INITIAL RESPONSE:
${phase1Result.initialResponse}

CRITICAL REVIEW FEEDBACK:
${phase2Result.critiqueText}

⚠️ MANDATORY REFINEMENT REQUIREMENTS:
1. VERIFY EVERY factual claim against the ORIGINAL CONTEXT - remove any information not explicitly stated
2. ENSURE EVERY statement has a citation: [Document Name, page/section]
3. REMOVE any invented, inferred, or fabricated information
4. If any claim cannot be verified in context, REMOVE it or mark as "not found in documents"
5. DO NOT add any information not in the ORIGINAL CONTEXT

TASK: Create an improved, polished final response that:
• Addresses all issues identified in the review
• VERIFIES every claim against the ORIGINAL CONTEXT
• Maintains factual accuracy with MANDATORY citations for every claim
• Uses clean, professional markdown formatting
• Provides direct, comprehensive answer ONLY from the context
• Removes any meta-commentary, confidence scores, or artifacts
• REMOVES any hallucinated or unverified information

IMPORTANT:
- Output ONLY the refined response itself
- Do NOT explain what changes were made
- Do NOT add notes about improvements
- Focus on delivering the best possible answer that is 100% grounded in the provided context
- If you cannot verify a claim in the ORIGINAL CONTEXT, you MUST remove it`
  }

  /**
   * Check if response is grounded in retrieved chunks
   * Returns groundedness score (0-1) and list of unverified claims
   */
  private checkGroundedness(
    response: string,
    chunks: Array<{ content: string; source: string; [key: string]: any }>,
    question: string
  ): {
    isGrounded: boolean
    groundednessScore: number
    unverifiedClaims: string[]
    verifiedClaims: string[]
  } {
    console.log("=== Groundedness Check ===")
    
    // Extract all factual claims from response (sentences with specific information)
    const sentences = response
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && !s.match(/^(##|###|#|\*|•|-|\d+\.)/)) // Filter out headers and list markers
    
    const verifiedClaims: string[] = []
    const unverifiedClaims: string[] = []
    
    // Check each sentence against chunks
    for (const sentence of sentences) {
      if (sentence.length < 10) continue
      
      const sentenceLower = sentence.toLowerCase()
      // Extract key terms (nouns, numbers, specific terms)
      const keyTerms = sentenceLower
        .match(/\b\d+[A-Z]?|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\b\d{4}|\d+%|\$\d+/g) || []
      
      // Check if sentence or its key terms appear in any chunk
      let found = false
      let matchScore = 0
      
      for (const chunk of chunks) {
        const chunkLower = chunk.content.toLowerCase()
        
        // Exact phrase match (high confidence)
        if (chunkLower.includes(sentenceLower.substring(0, Math.min(100, sentenceLower.length)))) {
          found = true
          matchScore = 1.0
          break
        }
        
        // Key term matching
        const matchingTerms = keyTerms.filter(term => chunkLower.includes(term))
        if (matchingTerms.length > 0) {
          const termMatchRatio = matchingTerms.length / Math.max(keyTerms.length, 1)
          if (termMatchRatio > 0.5) {
            found = true
            matchScore = Math.max(matchScore, termMatchRatio)
          }
        }
        
        // Semantic similarity check (simplified - check for common words)
        const sentenceWords = new Set(sentenceLower.split(/\s+/).filter(w => w.length > 3))
        const chunkWords = new Set(chunkLower.split(/\s+/).filter(w => w.length > 3))
        const commonWords = [...sentenceWords].filter(w => chunkWords.has(w))
        if (commonWords.length >= 3) {
          found = true
          matchScore = Math.max(matchScore, commonWords.length / sentenceWords.size)
        }
      }
      
      if (found && matchScore > 0.3) {
        verifiedClaims.push(sentence)
      } else {
        // Check if it's a citation or meta-commentary (these are OK)
        if (sentence.match(/\[.*\]|source|document|citation|according to/i)) {
          verifiedClaims.push(sentence) // Citations are considered verified
        } else {
          unverifiedClaims.push(sentence)
        }
      }
    }
    
    const totalClaims = sentences.length
    const groundednessScore = totalClaims > 0 ? verifiedClaims.length / totalClaims : 1.0
    const isGrounded = groundednessScore >= 0.7 // 70% threshold
    
    console.log(`Groundedness: ${(groundednessScore * 100).toFixed(1)}% (${verifiedClaims.length}/${totalClaims} claims verified)`)
    if (unverifiedClaims.length > 0) {
      console.warn(`⚠️ ${unverifiedClaims.length} unverified claims detected`)
      unverifiedClaims.slice(0, 3).forEach(claim => console.warn(`  - "${claim.substring(0, 80)}..."`))
    }
    
    return {
      isGrounded,
      groundednessScore,
      unverifiedClaims,
      verifiedClaims
    }
  }

  /**
   * Enforce citations in response - add citations for claims that don't have them
   */
  private enforceCitations(
    response: string,
    chunks: Array<{ content: string; source: string; [key: string]: any }>
  ): string {
    // Check if response already has citations
    const hasCitations = /\[.*?\]/.test(response)
    
    if (hasCitations) {
      // Verify existing citations are valid
      return response
    }
    
    // If no citations, try to add them intelligently
    // This is a simplified version - in production, you'd use more sophisticated NLP
    const sentences = response.split(/(?<=[.!?])\s+/)
    const citedSentences: string[] = []
    
    for (const sentence of sentences) {
      if (sentence.length < 20) {
        citedSentences.push(sentence)
        continue
      }
      
      // Find best matching chunk for this sentence
      let bestMatch: { chunk: typeof chunks[0]; score: number } | null = null
      
      for (const chunk of chunks) {
        const sentenceLower = sentence.toLowerCase()
        const chunkLower = chunk.content.toLowerCase()
        
        // Simple matching score
        const sentenceWords = sentenceLower.split(/\s+/).filter(w => w.length > 3)
        const chunkWords = chunkLower.split(/\s+/).filter(w => w.length > 3)
        const commonWords = sentenceWords.filter(w => chunkWords.includes(w))
        const score = commonWords.length / Math.max(sentenceWords.length, 1)
        
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { chunk, score }
        }
      }
      
      // Add citation if match is good enough
      if (bestMatch && bestMatch.score > 0.3) {
        citedSentences.push(`${sentence} [${bestMatch.chunk.source}]`)
      } else {
        citedSentences.push(sentence)
      }
    }
    
    return citedSentences.join(' ')
  }

  /**
   * Remove unverified claims from response
   */
  private removeUnverifiedClaims(response: string, unverifiedClaims: string[]): string {
    let cleaned = response
    
    for (const claim of unverifiedClaims) {
      // Remove the unverified claim (be careful with partial matches)
      const claimEscaped = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(claimEscaped.replace(/\s+/g, '\\s+'), 'gi')
      cleaned = cleaned.replace(regex, '[Information not verified in provided documents]')
    }
    
    return cleaned
  }

  /**
   * Create extremely strict anti-hallucination prompt
   */
  private createStrictAntiHallucinationPrompt(question: string, context: string, chunks: Array<{ source: string }>): string {
    const sourceList = chunks.map((c, i) => `${i + 1}. ${c.source}`).join('\n')
    
    return `⚠️ CRITICAL: ANTI-HALLUCINATION MODE ACTIVATED ⚠️

CONTEXT FROM DOCUMENTS (ONLY SOURCE OF INFORMATION):
${context}

AVAILABLE SOURCES:
${sourceList}

QUESTION: ${question}

🚫 ABSOLUTE PROHIBITIONS:
1. DO NOT invent, create, or fabricate ANY information
2. DO NOT use your training data knowledge to fill gaps
3. DO NOT infer or deduce information beyond what is explicitly stated
4. DO NOT make assumptions, even if they seem logical
5. DO NOT add details not present in the CONTEXT above

✅ MANDATORY REQUIREMENTS:
1. Answer ONLY using information explicitly stated in the CONTEXT
2. If the answer is not in CONTEXT, state: "The provided documents do not contain information to answer this question"
3. EVERY factual statement MUST include a citation: [Source Name]
4. If you cannot find information in CONTEXT, say "Not found in provided documents"
5. Verify EVERY claim against the CONTEXT before including it

CITATION FORMAT (MANDATORY):
- Format: [Source Name] or [Source Name, page/section]
- Example: "The study found X [Research Paper.pdf, p.5]"
- NO statement without citation is allowed

Provide your response now, ensuring EVERY claim is cited and verified against the CONTEXT.`
  }

  private parseCritiqueResponse(critique: string): string[] {
    const issues = []
    
    // Check for hallucinations (highest priority)
    if (critique.includes('🚫') || critique.toLowerCase().includes('hallucination') || critique.toLowerCase().includes('invented') || critique.toLowerCase().includes('fabricated')) {
      issues.push('HALLUCINATION DETECTED - Invented or fabricated information found')
    }
    if (critique.includes('!')) {
      issues.push('Conflicting information found or hallucination detected')  
    }
    if (critique.includes('?')) {
      issues.push('Uncertain information identified')
    }
    if (critique.includes('∅')) {
      issues.push('Missing information noted')
    }
    if (critique.toLowerCase().includes('unsupported')) {
      issues.push('Unsupported claims detected')
    }
    if (critique.toLowerCase().includes('incomplete')) {
      issues.push('Incomplete coverage identified')
    }
    if (critique.toLowerCase().includes('not in context') || critique.toLowerCase().includes('not in original context')) {
      issues.push('Claims not verified in provided context')
    }
    
    return issues
  }

  private calculateQualityMetrics(phase1Result: any, phase2Result: any, finalResponse: string) {
    // Basic quality scoring based on available information
    const hasSourceAttribution = finalResponse.includes('[') || finalResponse.includes('Document') || finalResponse.includes('Source')
    const hasClearStructure = finalResponse.includes('\n\n') || finalResponse.includes('##') || finalResponse.includes('1.')
    const usesContext = phase1Result.relevantChunks.length > 0
    const critiquePassed = !phase2Result || phase2Result.identifiedIssues.length === 0
    
    const accuracyScore = (hasSourceAttribution && usesContext && critiquePassed) ? 90 : 70
    const completenessScore = phase1Result.relevantChunks.length >= 3 ? 85 : 65
    const clarityScore = hasClearStructure ? 80 : 60  
    const confidenceScore = phase1Result.relevantChunks.length > 0 ? 
      Math.min(95, phase1Result.relevantChunks[0].similarity * 100) : 50
    
    const finalRating = (accuracyScore + completenessScore + clarityScore + confidenceScore) / 4
    
    return {
      accuracyScore,
      completenessScore,
      clarityScore,
      confidenceScore,
      finalRating
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  // Update the original query method signature for backward compatibility
  async querySimple(question: string): Promise<QueryResponse> {
    const enhancedResponse = await this.query(question, { complexityLevel: 'simple' })
    
    return {
      answer: enhancedResponse.answer,
      sources: enhancedResponse.sources,
      relevanceScore: enhancedResponse.relevanceScore,
      retrievedChunks: enhancedResponse.retrievedChunks
    }
  }

  private calculateRelevanceScore(chunks: Array<{ similarity: number }>): number {
    try {
      if (!Array.isArray(chunks) || chunks.length === 0) return 0

      const validSimilarities = chunks
        .map((chunk) => (chunk && typeof chunk.similarity === "number" ? chunk.similarity : 0))
        .filter((sim) => typeof sim === "number" && !isNaN(sim))

      if (validSimilarities.length === 0) return 0

      return validSimilarities.reduce((sum, sim) => sum + sim, 0) / validSimilarities.length
    } catch (error) {
      console.error("Error calculating relevance score:", error)
      return 0
    }
  }

  getDocuments(): Document[] {
    return Array.isArray(this.documents) ? this.documents : []
  }

  /**
   * Get evaluation analytics for the RAG system
   */
  getEvaluationAnalytics() {
    return Evaluations.getEvaluationAnalytics()
  }

  /**
   * Clear evaluation history
   */
  clearEvaluationHistory() {
    Evaluations.clearEvaluationHistory()
  }

  removeDocument(documentId: string) {
    try {
      if (!documentId || typeof documentId !== "string") {
        throw new Error("Invalid document ID")
      }

      const initialLength = this.documents.length
      this.documents = this.documents.filter((doc) => doc && doc.id !== documentId)

      const removedCount = initialLength - this.documents.length
      console.log(`Removed ${removedCount} document(s) with ID: ${documentId}`)
      
      // Track in telemetry
      if (removedCount > 0) {
        try {
          const telemetry = getTelemetry()
          telemetry.trackDocumentRemoved(documentId)
        } catch (telemetryError) {
          console.warn("Failed to track document removal in telemetry:", telemetryError)
        }
      }
    } catch (error) {
      console.error("Error removing document:", error)
    }
  }

  clearDocuments() {
    try {
      // Track each document removal in telemetry before clearing
      try {
        const telemetry = getTelemetry()
        for (const doc of this.documents) {
          telemetry.trackDocumentRemoved(doc.id)
        }
      } catch (telemetryError) {
        console.warn("Failed to track document clearing in telemetry:", telemetryError)
      }
      
      this.documents = []
      console.log("Cleared all documents from RAG engine")
    } catch (error) {
      console.error("Error clearing documents:", error)
    }
  }

  // Health check method
  isHealthy(): boolean {
    try {
      return this.isInitialized && this.aiClient !== null && this.pdfParser !== null && Array.isArray(this.documents)
    } catch (error) {
      console.error("Error checking RAG engine health:", error)
      return false
    }
  }

  // Get status information
  getStatus() {
    try {
      return {
        initialized: this.isInitialized,
        documentCount: Array.isArray(this.documents) ? this.documents.length : 0,
        totalChunks: Array.isArray(this.documents)
          ? this.documents.reduce((total, doc) => {
              return total + (Array.isArray(doc.chunks) ? doc.chunks.length : 0)
            }, 0)
          : 0,
        healthy: this.isHealthy(),
        currentProvider: this.currentConfig?.provider,
        currentModel: this.currentConfig?.model,
        isHealthy: () => this.isHealthy(),
      }
    } catch (error) {
      console.error("Error getting RAG engine status:", error)
      return {
        initialized: false,
        documentCount: 0,
        totalChunks: 0,
        healthy: false,
        currentProvider: null,
        currentModel: null,
        isHealthy: () => false,
      }
    }
  }

  // Diagnostic method to help troubleshoot issues
  async runDiagnostics(): Promise<any> {
    console.log("=== RAG Engine Diagnostics ===")
    
    const diagnostics: {
      systemStatus: {
        initialized: boolean
        aiClientAvailable: boolean
        currentProvider: string | undefined
        currentModel: string | undefined
        documentsCount: number
        totalChunks: number
        totalEmbeddings: number
      }
      documents: Array<{
        index: number
        id: string
        name: string
        chunksCount: number
        embeddingsCount: number
        hasValidStructure: boolean
        firstChunkPreview: string
        embeddingDimension: number
      }>
      embeddingTest: {
        success: boolean
        dimensions?: number
        sampleValues?: number[]
        error?: string
      } | null
      similarityTest: {
        success: boolean
        similarity?: number
        testedAgainst?: string
      } | null
    } = {
      systemStatus: {
        initialized: this.isInitialized,
        aiClientAvailable: !!this.aiClient,
        currentProvider: this.currentConfig?.provider,
        currentModel: this.currentConfig?.model,
        documentsCount: this.documents.length,
        totalChunks: this.documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0),
        totalEmbeddings: this.documents.reduce((total, doc) => total + (doc.embeddings?.length || 0), 0)
      },
      documents: [],
      embeddingTest: null,
      similarityTest: null
    }

    // Document details
    diagnostics.documents = this.documents.map((doc, index) => ({
      index,
      id: doc.id,
      name: doc.name,
      chunksCount: doc.chunks?.length || 0,
      embeddingsCount: doc.embeddings?.length || 0,
      hasValidStructure: !!(doc.chunks && doc.embeddings && doc.chunks.length === doc.embeddings.length),
      firstChunkPreview: this.getChunkPreview(doc.chunks?.[0]) + "..." || "No chunks",
      embeddingDimension: doc.embeddings?.[0]?.length || 0
    }))

    // Test embedding generation
    if (this.aiClient && this.isInitialized) {
      try {
        console.log("Testing embedding generation...")
        const testText = "This is a test for embedding generation"
        const testEmbedding = await this.aiClient.generateEmbedding(testText)
        diagnostics.embeddingTest = {
          success: true,
          dimensions: testEmbedding.length,
          sampleValues: testEmbedding.slice(0, 5)
        }
        console.log("✅ Embedding test successful")

        // Test similarity calculation if we have documents
        if (this.documents.length > 0 && this.documents[0].embeddings?.length > 0) {
          const firstDocEmbedding = this.documents[0].embeddings[0]
          const similarity = this.aiClient.cosineSimilarity(testEmbedding, firstDocEmbedding)
          diagnostics.similarityTest = {
            success: true,
            similarity,
            testedAgainst: `${this.documents[0].name} (chunk 1)`
          }
          console.log("✅ Similarity test successful:", similarity)
        }
      } catch (error) {
        diagnostics.embeddingTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.log("❌ Embedding test failed:", error)
      }
    }

    console.log("Diagnostics results:", diagnostics)
    console.log("=== End Diagnostics ===")
    return diagnostics
  }

  /**
   * Simple heuristics to derive chunk size & overlap from text length (in characters).
   * This helps fit chunks within model context windows while minimizing calls.
   */
  private getAdaptiveChunkParams(textLength: number): { chunkSize: number; overlap: number } {
    let chunkSize: number

    if (textLength > 20_000) chunkSize = 1000
    else if (textLength > 10_000) chunkSize = 800
    else if (textLength > 5_000) chunkSize = 600
    else chunkSize = 400

    // Ensure reasonable bounds
    chunkSize = Math.max(300, Math.min(chunkSize, 1200))

    const overlap = Math.floor(chunkSize * 0.1) // 10% overlap
    return { chunkSize, overlap }
  }

  private calculateAdaptiveThreshold(similarity: number, baseThreshold: number): number {
    // Adaptive threshold: lower threshold for poor matches, higher for good matches
    // This helps capture relevant content even when similarity scores are generally low
    if (similarity > 0.3) {
      return baseThreshold // Use standard threshold for strong matches
    } else if (similarity > 0.15) {
      return baseThreshold * 0.7 // Relaxed threshold for moderate matches
    } else {
      return baseThreshold * 0.5 // Very relaxed for weak matches (better than nothing)
    }
  }

  private extractSemanticImportance(
    chunk: string | any, 
    docMetadata?: any,
    contentTypeBoosts?: { tableBoost: number; imageBoost: number; equationBoost: number; dataBoost: number }
  ): number {
    let importance = 1.0

    // Check if chunk is a TextChunk object with metadata
    const chunkMetadata = typeof chunk === 'object' && chunk.metadata ? chunk.metadata : null
    const chunkContent = typeof chunk === 'string' ? chunk : (chunk.content || '')

    // Apply content-type-aware boosts from question analysis
    const boosts = contentTypeBoosts ?? { tableBoost: 1.0, imageBoost: 1.0, equationBoost: 1.0, dataBoost: 1.0 }

    // METADATA-SPECIFIC BOOSTS (higher priority)
    if (chunkMetadata) {
      // Boost for block type - now contextually aware
      if (chunkMetadata.type === 'heading') {
        importance += 0.4
        // Additional boost based on heading level (if available)
        if (chunkMetadata.level) {
          importance += Math.max(0.3 - (chunkMetadata.level * 0.05), 0.1) // h1=0.3, h2=0.25, h3=0.2, etc.
        }
      } else if (chunkMetadata.type === 'table') {
        importance += 0.35 * boosts.tableBoost // Tables often contain critical structured data
      } else if (chunkMetadata.type === 'list') {
        importance += 0.15
      } else if (chunkMetadata.type === 'image') {
        importance += 0.25 * boosts.imageBoost // Images/figures
      } else if (chunkMetadata.type === 'code') {
        importance += 0.2 // Code blocks
      }

      // Boost for high confidence (OCR confidence)
      if (chunkMetadata.confidence && chunkMetadata.confidence > 90) {
        importance += 0.15
      }

      // Boost for pre-calculated semantic importance
      if (chunkMetadata.semanticImportance && chunkMetadata.semanticImportance > 60) {
        importance += 0.2
      }

      // Boost for page metadata presence (indicates structured import)
      if (chunkMetadata.page !== undefined) {
        importance += 0.1 // Slight boost for having page attribution
      }
    }

    // FALLBACK: Text-based heuristics (lower priority, for non-structured content)
    // Boost for headings and titles
    if (/^#{1,6}\s|^[A-Z][^.]*:?$/m.test(chunkContent)) {
      importance += 0.25
    }

    // Boost for content with key indicators
    if (/\b(summary|conclusion|important|key|main|primary|objective|abstract|introduction)\b/i.test(chunkContent)) {
      importance += 0.2
    }

    // Boost for structured content
    if (/\d+\.|•|-|\*/.test(chunkContent)) {
      importance += 0.1
    }

    // Boost for content with data/numbers - now contextually aware
    if (/\d{4}|\d+%|\$\d+/i.test(chunkContent)) {
      importance += 0.15 * boosts.dataBoost
    }
    
    // Table-like content detection (even without explicit type metadata)
    if (/\|.*\|.*\|/.test(chunkContent) || /\t.*\t/.test(chunkContent)) {
      importance += 0.2 * boosts.tableBoost
    }
    
    // Chart/figure reference detection
    if (/\b(table|figure|chart|graph|diagram)\s*\d+/i.test(chunkContent)) {
      importance += 0.15 * boosts.imageBoost
    }

    // Equation/formula detection
    if (/\$\$.*\$\$|\\\[.*\\\]|[∫∑∏∂√∞≈≠≤≥±×÷]|\\frac|\\sqrt/.test(chunkContent)) {
      importance += 0.25 * boosts.equationBoost
    }

    return Math.min(3.0, importance) // Increased max from 2.5 to 3.0 for boosted content
  }

  /**
   * Detect if query is asking about multiple documents
   */
  private isMultiDocumentQuery(question: string): boolean {
    const multiDocPatterns = [
      /\b(all|every|each|both)\s+(documents?|files?|pdfs?)\b/i,
      /\b(summarize|compare|contrast|overview|across)\s+.*(documents?|files?|all)\b/i,
      /\b(documents?|files?)\s+.*(compare|contrast|summarize|overview)\b/i,
      /\bwhat\s+(do|does|are|is)\s+(the|all|these)\s+(documents?|files?)\b/i,
      /\b(between|among|across)\s+(the\s+)?(documents?|files?)\b/i,
      /\b(everything|all\s+information)\b/i,
      /\bgive\s+me\s+.*(overview|summary)\b/i,
      /\bmain\s+(points?|topics?|themes?)\b/i,
    ]
    
    return multiDocPatterns.some(pattern => pattern.test(question))
  }

  private applyEnhancedDiversityAlgorithm(
    allChunks: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number }>,
    documentMetrics: Map<string, { avgSimilarity: number; chunkCount: number; bestSimilarity: number }>,
    topK: number,
    minSimilarity: number,
    isMultiDocQuery: boolean = false
  ) {
    console.log(`Applying Enhanced Multi-Document Diversity Algorithm (multiDoc: ${isMultiDocQuery})`)

    // Calculate composite scores: similarity * semantic importance with diminishing returns
    const rankedChunks = allChunks
      .filter(chunk => chunk.similarity >= minSimilarity)
      .map(chunk => ({
        ...chunk,
        compositeScore: Math.pow(chunk.similarity, 0.8) * Math.pow(chunk.semanticImportance, 0.6)
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)

    console.log(`Ranked ${rankedChunks.length} chunks after filtering (min similarity: ${minSimilarity})`)

    if (rankedChunks.length === 0) {
      console.warn("No chunks passed the similarity threshold - using relaxed criteria")
      return this.getFallbackDiverseChunks(allChunks, documentMetrics, topK)
    }

    // Calculate fair distribution targets based on query type
    const numDocs = documentMetrics.size
    
    // For multi-document queries, enforce stricter fairness
    let baseChunksPerDoc: number
    let maxChunksPerDoc: number
    
    if (isMultiDocQuery && numDocs > 1) {
      // Ensure minimum representation from each document
      baseChunksPerDoc = Math.max(2, Math.floor(topK / numDocs))
      maxChunksPerDoc = Math.max(3, Math.ceil(topK / numDocs) + 1) // Much stricter: ~equal distribution
      console.log(`Multi-document query detected: Enforcing fair distribution (${baseChunksPerDoc}-${maxChunksPerDoc} per doc)`)
    } else {
      baseChunksPerDoc = Math.floor(topK / numDocs)
      maxChunksPerDoc = Math.min(topK, Math.ceil(topK * 0.5)) // Reduced from 70% to 50% max
    }
    
    const extraChunks = topK % numDocs

    // Sort documents by their best similarity to prioritize most relevant docs
    const sortedDocs = Array.from(documentMetrics.entries())
      .sort((a, b) => b[1].bestSimilarity - a[1].bestSimilarity)

    const documentTargets = new Map<string, number>()
    sortedDocs.forEach(([docId], idx) => {
      // Give extra chunks to top-performing documents
      const target = baseChunksPerDoc + (idx < extraChunks ? 1 : 0)
      documentTargets.set(docId, target)
    })

    console.log(`Diversity parameters - Base per doc: ${baseChunksPerDoc}, Max per doc: ${maxChunksPerDoc}, Target total: ${topK}`)

    // Phase 1: Greedy selection with diversity constraints
    const selectedChunks: typeof rankedChunks = []
    const documentChunkCounts = new Map<string, number>()
    const usedSources = new Set<string>()

    console.log("Phase 1: Greedy diverse selection")

    // First pass: ensure every document gets at least one chunk if available
    // For multi-doc queries, get minimum 2 chunks from each document first
    const minChunksFirstPass = isMultiDocQuery ? Math.min(2, baseChunksPerDoc) : 1
    
    for (let pass = 0; pass < minChunksFirstPass; pass++) {
      for (const [docId] of sortedDocs) {
        const currentCount = documentChunkCounts.get(docId) || 0
        if (currentCount > pass) continue // Already has enough for this pass
        
        const docChunks = rankedChunks.filter(chunk => 
          chunk.documentId === docId && !usedSources.has(chunk.source)
        )
        
        if (docChunks.length > 0 && selectedChunks.length < topK) {
          selectedChunks.push(docChunks[0])
          usedSources.add(docChunks[0].source)
          documentChunkCounts.set(docId, currentCount + 1)

          const docName = docChunks[0].documentName
          console.log(`  Pass ${pass + 1}: chunk from ${docName} (similarity: ${docChunks[0].similarity.toFixed(3)}, score: ${docChunks[0].compositeScore.toFixed(3)})`)
        }
      }
    }

    // Second pass: fill remaining slots respecting targets and max limits
    console.log("Phase 2: Filling to targets")
    for (const chunk of rankedChunks) {
      if (selectedChunks.length >= topK) break
      if (usedSources.has(chunk.source)) continue

      const currentCount = documentChunkCounts.get(chunk.documentId) || 0
      const targetCount = documentTargets.get(chunk.documentId) || baseChunksPerDoc

      // Add chunk if: under target OR (under max AND high quality)
      const underTarget = currentCount < targetCount
      const underMax = currentCount < maxChunksPerDoc
      const highQuality = chunk.similarity > 0.2 // Strong match threshold

      if (underTarget || (underMax && highQuality)) {
        selectedChunks.push(chunk)
        usedSources.add(chunk.source)
        documentChunkCounts.set(chunk.documentId, currentCount + 1)
      }
    }

    // Sort final results by composite score for optimal ordering
    const finalChunks = selectedChunks
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, topK)

    // Log final distribution
    console.log(`Final chunk distribution:`)
    const distribution = new Map<string, { count: number, avgSim: number }>()
    finalChunks.forEach(chunk => {
      const existing = distribution.get(chunk.documentName) || { count: 0, avgSim: 0 }
      distribution.set(chunk.documentName, {
        count: existing.count + 1,
        avgSim: (existing.avgSim * existing.count + chunk.similarity) / (existing.count + 1)
      })
    })

    distribution.forEach(({ count, avgSim }, docName) => {
      console.log(`  ${docName}: ${count} chunks (avg similarity: ${avgSim.toFixed(3)})`)
    })

    console.log(`Returning ${finalChunks.length} chunks with enhanced diversity (${distribution.size} documents represented)`)
    if (finalChunks.length > 0) {
      console.log(`Best similarity: ${finalChunks[0].similarity.toFixed(3)}`)
      console.log(`Worst similarity: ${finalChunks[finalChunks.length - 1].similarity.toFixed(3)}`)
    }

    return finalChunks
  }

  private getFallbackDiverseChunks(
    allChunks: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number }>,
    documentMetrics: Map<string, { avgSimilarity: number; chunkCount: number; bestSimilarity: number }>,
    topK: number
  ) {
    console.log("Using fallback diversity strategy (relaxed similarity criteria)")
    
    const fallbackChunks: typeof allChunks = []
    
    // Get the best chunk from each document
    for (const [docId, metrics] of documentMetrics) {
      const docChunks = allChunks
        .filter(chunk => chunk.documentId === docId)
        .sort((a, b) => b.similarity - a.similarity)
      
      if (docChunks.length > 0) {
        fallbackChunks.push(docChunks[0])
        console.log(`Fallback: Added best chunk from ${docChunks[0].documentName} (similarity: ${docChunks[0].similarity.toFixed(3)})`)
      }
    }
    
    // Fill remaining slots if needed
    const usedSources = new Set(fallbackChunks.map(c => c.source))
    const remainingChunks = allChunks
      .filter(chunk => !usedSources.has(chunk.source))
      .sort((a, b) => b.similarity - a.similarity)
    
    const slotsToFill = topK - fallbackChunks.length
    for (let i = 0; i < slotsToFill && i < remainingChunks.length; i++) {
      fallbackChunks.push(remainingChunks[i])
    }
    
    return fallbackChunks.slice(0, topK)
  }
}

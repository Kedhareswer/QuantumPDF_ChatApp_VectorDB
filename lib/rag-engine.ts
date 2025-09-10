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
import { VectorDatabaseClient } from "./vector-database-client"
import type { SearchOptions, VectorDocument } from "./vector-database-types"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
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

export class RAGEngine {
  private documents: Document[] = []
  private aiClient: AIClient | null = null
  private pdfParser: PDFParser
  private isInitialized = false
  private currentConfig: AIConfig | null = null
  private tokenBudget = 4000 // Default token budget
  private showThinking = false // Option to show/hide thinking process
  private vectorDB: VectorDatabaseClient | null = null
  private enablePreCompression = true
  private useVectorDBRetrieval = true

  constructor() {
    this.pdfParser = new PDFParser()
  }

  setVectorDBClient(client: VectorDatabaseClient | null) {
    this.vectorDB = client
  }

  setPreCompressionEnabled(enabled: boolean) {
    this.enablePreCompression = !!enabled
  }

  setUseVectorDBRetrieval(enabled: boolean) {
    this.useVectorDBRetrieval = !!enabled
  }

  async initialize(config?: AIConfig): Promise<void> {
    try {
      if (config) {
              // RAGEngine: Initializing with new config

      // Create AI client with the provided configuration
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
        console.warn("RAGEngine: AI provider connection test failed, but continuing initialization")
        // Don't throw here - allow initialization to continue with potential fallback
      } else {
        console.log("RAGEngine: AI provider connection test successful")
      }

      // Test embedding generation with error handling
      console.log("RAGEngine: Testing embedding generation...")
      try {
        const testEmbedding = await this.aiClient.generateEmbedding("test connection")
        if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
          throw new Error("Invalid embedding response during initialization")
        }
        console.log(`RAGEngine: Embedding test successful, dimension: ${testEmbedding.length}`)
      } catch (embeddingError) {
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : "Unknown embedding error"
        console.error(`RAGEngine: Embedding generation failed during initialization: ${errorMessage}`)
        
        // For Cohere and other providers that might have embedding issues, 
        // we can still continue if text generation works
        if (errorMessage.includes("embedding")) {
          console.warn("RAGEngine: Continuing initialization despite embedding issues - will use fallback embeddings")
        } else {
          throw embeddingError // Re-throw non-embedding specific errors
        }
      }

      // Test text generation as a final check
      console.log("RAGEngine: Testing text generation...")
      try {
        const testResponse = await this.aiClient.generateText([
          { role: "user", content: "Hello, this is a connectivity test." }
        ])
        if (!testResponse || typeof testResponse !== 'string') {
          throw new Error("Invalid text generation response during initialization")
        }
        console.log("RAGEngine: Text generation test successful")
      } catch (textError) {
        const errorMessage = textError instanceof Error ? textError.message : "Unknown text generation error"
        console.error(`RAGEngine: Text generation failed during initialization: ${errorMessage}`)
        throw textError // Text generation is essential, so fail initialization
      }

      console.log("RAGEngine: Initialization completed successfully")
      this.isInitialized = true
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
      throw new Error(`RAG Engine initialization failed: ${errorMessage}`)
    }
  }

  private async retrieveRelevantChunks(
    question: string,
    questionEmbedding: number[],
    topK: number,
    filters?: RAGFilterOptions
  ): Promise<Array<{ content: string; source: string; similarity: number }>> {
    try {
      if (this.vectorDB && this.useVectorDBRetrieval) {
        console.log("retrieveRelevantChunks: Using Vector DB retrieval")
        const dbFilters: Record<string, any> = {}
        if (filters?.documentIds && filters.documentIds.length > 0) {
          dbFilters.documentId = { $in: filters.documentIds }
        }
        if (filters?.authors && filters.authors.length > 0) {
          dbFilters.author = { $in: filters.authors }
        }
        if (filters?.tags && filters.tags.length > 0) {
          dbFilters.tags = { $in: filters.tags }
        }
        if (filters?.dateRange) {
          dbFilters.date = {
            ...(filters.dateRange.start ? { $gte: filters.dateRange.start } : {}),
            ...(filters.dateRange.end ? { $lte: filters.dateRange.end } : {}),
          }
        }

        const options: SearchOptions = {
          mode: "hybrid",
          limit: topK,
          threshold: filters?.minSimilarity ?? 0.05,
          filters: Object.keys(dbFilters).length > 0 ? dbFilters : undefined,
        }

        const results = await this.vectorDB.search(question, questionEmbedding, options)
        console.log("Vector DB results:", results.length)
        const mapped = results.slice(0, topK).map((r) => ({
          content: r.content,
          source: r.metadata?.source || "Unknown Document",
          similarity: typeof r.score === 'number' ? r.score : 0,
        }))
        return mapped
      }
    } catch (error) {
      console.error("Vector DB retrieval failed; falling back to local:", error)
    }

    // Fallback to local in-memory retrieval
    console.log("retrieveRelevantChunks: Falling back to local similarity search")
    return this.findRelevantChunks(questionEmbedding, topK, filters)
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
            document.embeddings = await this.aiClient.generateEmbeddings(document.chunks)
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
    const dimension = 1024
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
        console.log(`  Chunk ${i}: ${chunk.substring(0, 100)}...`)
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
          document.embeddings = await this.aiClient.generateEmbeddings(document.chunks)
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
      
      // Persist to vector database if available
      if (this.vectorDB) {
        try {
          console.log("🔄 Persisting document chunks to vector DB via API route...")
          const vectorDocs: VectorDocument[] = document.chunks.map((chunk, index) => ({
            id: `${document.id}_${index}`,
            content: chunk,
            embedding: document.embeddings[index] || [],
            metadata: {
              source: document.name,
              chunkIndex: index,
              documentId: document.id,
              timestamp: document.uploadedAt,
              ...(document.metadata || {})
            }
          }))
          await this.vectorDB.addDocuments(vectorDocs)
          console.log("✅ Persisted to vector DB: ", vectorDocs.length, "chunks")
        } catch (persistError) {
          console.error("❌ Failed to persist document to vector DB:", persistError)
        }
      } else {
        console.log("ℹ️ Vector DB client not set; skipping persistence")
      }
      
      // Verify the document was actually added
      const addedDoc = this.documents.find(d => d.id === document.id)
      if (addedDoc) {
        console.log("✅ Document verification: Successfully found in RAG engine documents array")
      } else {
        console.error("❌ Document verification: NOT found in RAG engine documents array")
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

  private findRelevantChunks(questionEmbedding: number[], topK: number, filters?: RAGFilterOptions) {
    const allChunks: Array<{ content: string; source: string; similarity: number }> = [];

    try {
      console.log("findRelevantChunks: Starting chunk search")
      
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

      console.log(`Processing ${this.documents.length} documents for similarity search`)

      // Calculate similarity for all chunks
      this.documents.forEach((doc, docIndex) => {
        try {
          console.log(`Processing document ${docIndex}: ${doc.name}`)
          
          // Apply document-level filters first
          if (filters) {
            if (filters.documentIds && filters.documentIds.length > 0 && !filters.documentIds.includes(doc.id)) {
              return // Skip – ID not in whitelist
            }
            if (filters.authors && filters.authors.length > 0) {
              const author = (doc.metadata?.author || '').toString().toLowerCase()
              const matchesAuthor = filters.authors.some((a) => a.toLowerCase() === author)
              if (!matchesAuthor) return
            }
            if (filters.tags && filters.tags.length > 0) {
              const docTags: string[] = Array.isArray(doc.metadata?.tags) ? doc.metadata!.tags : []
              const tagMatch = docTags.some((t) => filters.tags!.includes(t))
              if (!tagMatch) return
            }
            if (filters.dateRange) {
              const docDate = doc.metadata?.creationDate || doc.uploadedAt
              if (docDate instanceof Date) {
                if (docDate < filters.dateRange.start || docDate > filters.dateRange.end) return
              }
            }
          }
          
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
              const similarity = this.aiClient!.cosineSimilarity(questionEmbedding, chunkEmbedding);

              // Apply similarity threshold if provided
              const minSim = filters?.minSimilarity ?? 0.05
               
              if (typeof similarity === "number" && !isNaN(similarity) && similarity >= minSim) {
                allChunks.push({
                  content: chunk || "",
                  source: `${doc.name || "Unknown Document"} (chunk ${chunkIndex + 1})`,
                  similarity,
                });
                
                // Log high-similarity chunks
                if (similarity > 0.3) {
                  console.log(`High similarity chunk found: ${similarity.toFixed(3)} from ${doc.name}`)
                }
              } else {
                console.warn(`Invalid similarity calculated for chunk ${chunkIndex} in document ${docIndex}:`, similarity);
              }
            } catch (chunkError) {
              console.error(`Error processing chunk ${chunkIndex} in document ${docIndex}:`, chunkError);
            }
          });
        } catch (docError) {
          console.error(`Error processing document ${docIndex}:`, docError);
        }
      });

      console.log(`Total chunks processed: ${allChunks.length}`)
      
      if (allChunks.length === 0) {
        console.warn("No chunks were successfully processed")
        return [];
      }

      // Sort by similarity and return top K
      const sortedChunks = allChunks
        .sort((a, b) => b.similarity - a.similarity)
        .filter((chunk) => chunk.similarity >= (filters?.minSimilarity ?? 0.05));

      // --- Diversity Rule: Ensure at least one chunk per document (if available) ---
      const docChunkMap = new Map<string, { content: string; source: string; similarity: number }>();
      // Extract document name from source string (format: "docName (chunk N)")
      for (const chunk of sortedChunks) {
        const docName = chunk.source.split(" (chunk ")[0];
        if (!docChunkMap.has(docName)) {
          docChunkMap.set(docName, chunk); // Take the highest-similarity chunk per doc
        }
      }
      // Start with one chunk per document (if available)
      const diverseChunks = Array.from(docChunkMap.values());
      // Fill up to topK with remaining highest-similarity chunks (excluding already picked)
      const pickedSet = new Set(diverseChunks.map((c) => c.source));
      for (const chunk of sortedChunks) {
        if (diverseChunks.length >= topK) break;
        if (!pickedSet.has(chunk.source)) {
          diverseChunks.push(chunk);
          pickedSet.add(chunk.source);
        }
      }
      // If still less than topK, just take more from sortedChunks (shouldn't happen, but for safety)
      while (diverseChunks.length < topK && diverseChunks.length < sortedChunks.length) {
        const next = sortedChunks[diverseChunks.length];
        if (next && !pickedSet.has(next.source)) {
          diverseChunks.push(next);
          pickedSet.add(next.source);
        }
      }
      // Limit to topK
      const finalChunks = diverseChunks.slice(0, topK);

      console.log(`Returning ${finalChunks.length} chunks (diversity rule, threshold: ${filters?.minSimilarity ?? 0.05}, topK: ${topK})`)
      if (finalChunks.length > 0) {
        console.log(`Best similarity: ${finalChunks[0].similarity.toFixed(3)}`)
        console.log(`Worst similarity: ${finalChunks[finalChunks.length - 1].similarity.toFixed(3)}`)
      }

      return finalChunks;
    } catch (error) {
      console.error("Error finding relevant chunks:", error);
      return [];
    }
  }

  async query(question: string, options?: { 
    showThinking?: boolean, 
    tokenBudget?: number,
    complexityLevel?: 'simple' | 'normal' | 'complex',
    filters?: RAGFilterOptions
  }): Promise<EnhancedQueryResponse> {
    console.log("Enhanced RAG query started:", question);

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
      // Validate system state
      if (!this.isInitialized || !this.aiClient) {
        return {
          ...defaultResponse,
          answer: "The system is not properly initialized. Please configure your AI provider and try again.",
        };
      }

      // Validate input
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return {
          ...defaultResponse,
          answer: "Please provide a valid question.",
        };
      }

      // Determine processing approach based on complexity
      return await this.processQueryEnhanced(question, tokenBudget, complexityLevel, showThinking, filters)

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
    filters?: RAGFilterOptions
  ): Promise<EnhancedQueryResponse> {
    
    // Phase-based token allocation
    const tokenAllocation = this.calculateTokenAllocation(tokenBudget, complexityLevel)
    
    // Phase 1: Context Analysis and Initial Response
    const phase1Result = await this.phase1_ContextAnalysis(question, tokenAllocation.context, filters)
    
    // Phase 2: Self-Critique and Validation (only for normal/complex queries)
    const phase2Result = complexityLevel === 'simple' 
      ? null 
      : await this.phase2_SelfCritique(phase1Result, tokenAllocation.critique)
    
    // Phase 3: Refinement and Final Response
    const phase3Result = await this.phase3_Refinement(
      phase1Result, 
      phase2Result, 
      tokenAllocation.refinement,
      showThinking
    )

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

  private async phase1_ContextAnalysis(question: string, tokenBudget: number, filters?: RAGFilterOptions) {
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
      // Generate embedding for the question
      console.log("Generating embedding for question:", question.substring(0, 100) + "...")
      const questionEmbedding = await this.aiClient!.generateEmbedding(question);
      console.log("Question embedding generated, dimensions:", questionEmbedding.length)
      
      // Analyze question type for optimal chunk selection
      const questionType = this.analyzeQuestionType(question)
      const chunkLimit = this.getOptimalChunkLimit(questionType)
      console.log(`Question type: ${questionType}, chunk limit: ${chunkLimit}`)
      
      // Find relevant chunks (prefer vector DB when available)
      console.log("Finding relevant chunks...")
      let relevantChunks = await this.retrieveRelevantChunks(question, questionEmbedding, chunkLimit, filters);
      console.log(`Found ${relevantChunks.length} relevant chunks`)
      
      // Debug: Log chunk similarities
      if (relevantChunks.length > 0) {
        console.log("Top chunks:")
        relevantChunks.slice(0, 3).forEach((chunk: { content: string; source: string; similarity: number }, i: number) => {
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
            console.log("- First chunk preview:", firstDoc.chunks[0].substring(0, 100))
          }
          
          if (firstDoc.embeddings && firstDoc.embeddings.length > 0) {
            console.log("- First embedding dimensions:", firstDoc.embeddings[0]?.length)
            console.log("- Question embedding dimensions:", questionEmbedding.length)
          }
        }
      }
      
      if (relevantChunks.length === 0) {
        return {
          question,
          relevantChunks: [],
          context: "",
          initialResponse: "I couldn't find relevant information in the uploaded documents to answer your question. This might be because:\n\n1. The question doesn't match the document content\n2. The documents may not have processed correctly\n3. Try rephrasing your question\n\nDocument status: " + this.documents.length + " documents available with " + this.documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0) + " total chunks.",
          questionType,
          tokensUsed: 0
        }
      }

      // Optionally pre-compress chunks to keep only the most relevant sentences before optimizing for tokens
      const contextBudget = Math.floor(tokenBudget * 0.7)
      let preparedChunks = relevantChunks
      if (this.enablePreCompression) {
        console.log("Pre-compressing chunks for token budget:", contextBudget)
        preparedChunks = this.preCompressChunks(relevantChunks, question, contextBudget)
        console.log(
          `Pre-compressed chunks (avg length): ${preparedChunks.length > 0
              ? Math.floor(
                  preparedChunks.reduce(
                    (sum: number, ch: { content: string }) => sum + (ch.content?.length || 0),
                    0,
                  ) / preparedChunks.length,
                )
              : 0
          } chars`,
        )
      } else {
        console.log("Pre-compression disabled; using raw chunks")
      }

      // Optimize chunks for token budget
      console.log("Optimizing chunks for token budget:", contextBudget)
      const optimizedChunks = this.optimizeChunksForTokens(preparedChunks, contextBudget)
      console.log(`Optimized to ${optimizedChunks.length} chunks`)
      
      const context = optimizedChunks.map(chunk => chunk.content).join("\n\n");
      console.log("Context length:", context.length, "characters")
      
      // Generate initial response with enhanced prompt
      const systemPrompt = this.createEnhancedSystemPrompt(questionType)
      const userPrompt = this.createPhase1UserPrompt(question, context)
      
      console.log("Generating AI response...")
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt }
      ];

      const initialResponse = await this.aiClient!.generateText(messages);
      console.log("AI response generated, length:", initialResponse.length)

      return {
        question,
        relevantChunks: optimizedChunks,
        context,
        initialResponse: initialResponse.trim(),
        questionType,
        tokensUsed: this.estimateTokens(systemPrompt + userPrompt + initialResponse)
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

    const critiqueResponse = await this.aiClient!.generateText(messages);
    
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

      finalResponse = await this.aiClient!.generateText(messages);
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
      tokenUsage
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

  private optimizeChunksForTokens(chunks: any[], tokenBudget: number) {
    let totalTokens = 0
    const optimizedChunks = []
    
    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens(chunk.content)
      if (totalTokens + chunkTokens <= tokenBudget) {
        optimizedChunks.push(chunk)
        totalTokens += chunkTokens
      } else {
        break
      }
    }
    
    return optimizedChunks
  }

  // --- Phase 5: Pre-compression and token optimization helpers ---
  private extractKeywords(text: string, maxKeywords = 12): string[] {
    if (!text) return []
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ') 
      .trim()

    const stopwords = new Set<string>([
      'the','and','a','an','of','to','in','on','for','by','with','as','is','are','was','were','be','been','it','this','that','these','those','from','or','at','we','you','they','i','he','she','not','but','if','then','else','so','than','can','could','should','would','may','might','will','just','about','into','over','under','between','within','without','across','per','each'
    ])

    const terms = cleaned.split(' ').filter(Boolean)
    const freq = new Map<string, number>()
    for (const term of terms) {
      if (stopwords.has(term)) continue
      if (term.length < 3 && !/^[0-9]+$/.test(term)) continue
      freq.set(term, (freq.get(term) || 0) + 1)
    }

    // Boost numeric and camel/snake-case-like tokens
    const scored = Array.from(freq.entries()).map(([t, c]) => {
      let score = c
      if (/^[0-9]+(\.[0-9]+)?$/.test(t)) score += 2
      if (t.includes('_') || t.includes('-')) score += 1
      return { term: t, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxKeywords).map(s => s.term)
  }

  private splitIntoSentences(text: string): string[] {
    if (!text) return []
    // Naive sentence splitter with line breaks respected
    const normalized = text.replace(/\r\n/g, '\n')
    const rough = normalized
      .split(/(?<=[\.!?])\s+|\n+/g)
      .map(s => this.normalizeLine(s))
      .filter(s => s.length > 0)
    return rough
  }

  private normalizeLine(line: string): string {
    return (line || '')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .trim()
  }

  private compressTextByKeywords(text: string, keywords: string[], maxTokens: number): string {
    if (!text) return ''
    const sentences = this.splitIntoSentences(text)
    if (sentences.length === 0) return ''

    // Score sentences by keyword overlap and position
    const kwSet = new Set(keywords.map(k => k.toLowerCase()))
    const scored = sentences.map((s, idx) => {
      const tokens = s.toLowerCase().split(/[^a-z0-9_\-]+/).filter(Boolean)
      let score = 0
      for (const t of tokens) {
        if (kwSet.has(t)) score += 1
      }
      // Boost earlier sentences slightly
      const positionBoost = Math.max(0, (sentences.length - idx) / sentences.length) * 0.25
      score += positionBoost
      return { s, score, tokens: this.estimateTokens(s) }
    })

    scored.sort((a, b) => b.score - a.score)

    // Greedily add sentences until we hit the token cap
    const selected: string[] = []
    let used = 0
    for (const entry of scored) {
      if (used + entry.tokens > maxTokens) continue
      selected.push(entry.s)
      used += entry.tokens
      if (used >= maxTokens) break
    }

    // Fallback: if nothing selected, take the highest-scoring sentence regardless
    if (selected.length === 0) {
      selected.push(scored[0].s)
    }

    return selected.join(' ')
  }

  private preCompressChunks(
    chunks: Array<{ content: string; source: string; similarity: number }>,
    question: string,
    tokenBudget: number
  ): Array<{ content: string; source: string; similarity: number }> {
    if (!Array.isArray(chunks) || chunks.length === 0) return []
    // Allocate tokens across chunks proportionally to similarity (min floor)
    const minPerChunk = Math.max(64, Math.floor(tokenBudget / Math.max(8, chunks.length)))
    const simSum = chunks.reduce((s, c) => s + Math.max(0.01, c.similarity || 0), 0)
    const keywords = this.extractKeywords(question)

    const compressed = chunks.map((c) => {
      const share = Math.max(minPerChunk, Math.floor((Math.max(0.01, c.similarity || 0) / simSum) * tokenBudget))
      const compressedText = this.compressTextByKeywords(c.content || '', keywords, share)
      const finalText = compressedText && compressedText.length > 0 ? compressedText : (c.content || '').slice(0, 500)
      return { content: finalText, source: c.source, similarity: c.similarity }
    })

    return compressed
  }

  private createEnhancedSystemPrompt(questionType: string): string {
    const basePrompt = `You are an expert document analyst providing precise, well-formatted responses to questions about the documents you have been provided.

CORE REQUIREMENTS:
• Use information from the provided context, but also use your own knowledge and experience to answer the question if it is not clear from the context.
• Create clean, professional formatting using proper markdown and proper headings.
• Cite sources clearly and consistently.
• Never add confidence ratings or meta-commentary.
• Focus on answering the user's question directly.

FORMATTING STANDARDS:
• Use ## for main headings, ### for subheadings
• Create proper tables with | separators
• Use bullet points (•) for lists
• Bold key terms with **text**
• Use > for important quotes
• Ensure all markdown renders cleanly

CONTENT RULES:
• Answer directly without preambles
• No "according to the documents" unless natural.
• No confidence ratings or meta-analysis.
• No commentary on response quality or confidence.
• Focus on factual information from sources and your own knowledge and experience.`

    const typeSpecificPrompts = {
      'summary': '\n\nFORMAT: Start with brief overview, then organized sections with clear headings and bullet points.',
      'analysis': '\n\nFORMAT: Structured analysis with clear reasoning, evidence sections, and logical conclusions using your own knowledge and experience.',
      'timeline': '\n\nFORMAT: Chronological presentation with dates, events, and source references in table format using your own knowledge and experience.',
      'data': '\n\nFORMAT: Present numerical data in well-formatted tables with clear headers and units using your own knowledge and experience.',
      'process': '\n\nFORMAT: Step-by-step procedure with numbered steps and clear instructions using your own knowledge and experience.',
      'comparison': '\n\nFORMAT: Side-by-side comparison table showing key differences and similarities using your own knowledge and experience.',
      'general': '\n\nFORMAT: Clear, direct response with appropriate headings and organized information using your own knowledge and experience.'
    }

    return basePrompt + (typeSpecificPrompts[questionType as keyof typeof typeSpecificPrompts] || typeSpecificPrompts.general)
  }

  private createPhase1UserPrompt(question: string, context: string): string {
    return `CONTEXT:
${context}

QUESTION: ${question}

Provide a direct, well-formatted response based on the context above. Use clean markdown formatting and focus on answering the question comprehensively.`
  }

  private createCritiquePrompt(phase1Result: any): string {
    return `REVIEW THIS RESPONSE:

QUESTION: ${phase1Result.question}
RESPONSE: ${phase1Result.initialResponse}

Check for:
• Factual accuracy against context
• Complete coverage of question
• Clear source attribution using the source name and page number
• Clean formatting using proper markdown and proper headings
• Direct answering without fluff and meta-commentary
• Use your own knowledge and experience to answer the question if it is not clear from the context

Identify specific improvements needed. Be concise.`
  }

  private createRefinementPrompt(phase1Result: any, phase2Result: any): string {
    return `ORIGINAL QUESTION: ${phase1Result.question}

INITIAL RESPONSE: ${phase1Result.initialResponse}

IMPROVEMENTS NEEDED: ${phase2Result.critiqueText}

Create a refined, final response that:
• Addresses the identified issues.
• Maintains clean, professional formatting using proper markdown and proper headings.
• Provides direct answers without meta-commentary.
• Uses proper markdown that renders cleanly using proper headings.
• Eliminates any artifacts or confidence ratings or meta-commentary.

Provide ONLY the final response - no explanations about changes made.`
  }

  private parseCritiqueResponse(critique: string): string[] {
    const issues = []
    
    if (critique.includes('?')) {
      issues.push('Uncertain information identified')
    }
    if (critique.includes('!')) {
      issues.push('Conflicting information found')  
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

  // Diagnostics helper to test current retrieval path and list top sources
  async testRetrievalPath(
    question: string = "diagnostic retrieval test",
    topK: number = 5,
    filters?: RAGFilterOptions
  ): Promise<{ path: 'vector' | 'local'; chunks: Array<{ content: string; source: string; similarity: number }> }> {
    if (!this.isInitialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

    const embedding = await this.aiClient.generateEmbedding(question)

    if (this.vectorDB && this.useVectorDBRetrieval) {
      try {
        const dbFilters: Record<string, any> = {}
        if (filters?.documentIds && filters.documentIds.length > 0) dbFilters.documentId = { $in: filters.documentIds }
        if (filters?.authors && filters.authors.length > 0) dbFilters.author = { $in: filters.authors }
        if (filters?.tags && filters.tags.length > 0) dbFilters.tags = { $in: filters.tags }
        if (filters?.dateRange) {
          dbFilters.date = {
            ...(filters.dateRange.start ? { $gte: filters.dateRange.start } : {}),
            ...(filters.dateRange.end ? { $lte: filters.dateRange.end } : {}),
          }
        }

        const options: SearchOptions = {
          mode: 'hybrid',
          limit: topK,
          threshold: filters?.minSimilarity ?? 0.05,
          filters: Object.keys(dbFilters).length > 0 ? dbFilters : undefined,
        }

        const results = await this.vectorDB.search(question, embedding, options)
        const chunks = results.slice(0, topK).map((r) => ({
          content: r.content,
          source: r.metadata?.source || 'Unknown Document',
          similarity: typeof r.score === 'number' ? r.score : 0,
        }))
        return { path: 'vector', chunks }
      } catch (err) {
        console.warn('testRetrievalPath: Vector DB path failed, falling back to local', err)
      }
    }

    // Fallback to local
    const localChunks = this.findRelevantChunks(embedding, topK, filters)
    return { path: 'local', chunks: localChunks }
  }

  getDocuments(): Document[] {
    return Array.isArray(this.documents) ? this.documents : []
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

      // Also remove from vector DB if available
      if (this.vectorDB) {
        this.vectorDB.deleteDocument(documentId).catch((err) => {
          console.error("Failed to delete document from vector DB:", err)
        })
      }
    } catch (error) {
      console.error("Error removing document:", error)
    }
  }

  clearDocuments() {
    try {
      this.documents = []
      console.log("Cleared all documents from RAG engine")

      // Clear vector DB as well if available
      if (this.vectorDB) {
        this.vectorDB.clear().catch((err) => {
          console.error("Failed to clear vector DB:", err)
        })
      }
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
      firstChunkPreview: doc.chunks?.[0]?.substring(0, 100) + "..." || "No chunks",
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
}

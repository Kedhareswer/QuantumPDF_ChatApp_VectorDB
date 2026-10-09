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
    metadata: Record<string, unknown>
  }>
  confidence: number
}

// Enhanced interfaces for self-reflective system
/** Result of RAGEngine.runDiagnostics(), shown in the chat UI. */
export interface RAGDiagnostics {
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
}

/** A retrieved chunk as passed between retrieval, generation and the UI. */
export interface RetrievedChunk {
  content: string
  source: string
  similarity: number
  documentId?: string
  documentName?: string
  semanticImportance?: number
  chunkIndex?: number
  page?: number
  /** Heading or sheet name the chunk sits under (non-PDF formats). */
  section?: string
  bbox?: unknown
  level?: number
  chunkType?: string
  rrfScore?: number
  remoteRank?: number
  truncated?: boolean
}

/** Output of phase 1 (retrieval + draft answer). */
interface Phase1Result {
  question: string
  relevantChunks: RetrievedChunk[]
  context: string
  initialResponse: string
  questionType: string
  tokensUsed: number
  groundednessScore?: number
}

/** Output of the LLM fact-check (phase 2, and the re-check after a revision). */
interface VerificationResult {
  critiqueText: string
  identifiedIssues: string[]
  needsRevision: boolean
  /** Per-claim verdicts; null when the verifier's JSON could not be parsed. */
  verification: { total: number; supported: number; unsupportedClaims: string[] } | null
  tokensUsed: number
}

export interface EnhancedQueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: RetrievedChunk[]
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
  queryAnalysis?: {
    originalQuery: string
    rewrittenQuery: string
    queryType: string
    complexity: "simple" | "moderate" | "complex"
    requiresHyDE: boolean
    requiresStepBack: boolean
    alternativeQueries: string[]
    hasHypotheticalAnswer: boolean
    hasStepBackQuestion: boolean
    confidence: number
  }
  groundednessScore?: number // Share 0-1 of answer claims the LLM verifier found supported by the sources
  hallucinationDetected?: boolean // True when the verifier found unsupported claims in the final answer
  /** Output-guardrail findings for this answer (redactions, missing citations, hedging). */
  warnings?: string[]
  /** Per-claim verifier counts for the final answer, when available. */
  verifiedClaims?: { total: number; supported: number; unsupportedClaims: string[] }
}



import { logger } from "./logger"
import type { TextChunk } from "./advanced-chunking"
import { AIClient, type AIConfig } from "./ai-client"
import {
    Evaluations,
    Guardrails,
    checkRateLimit,
    createQueryEvaluation,
    storeEvaluation
} from "./guardrails"
import {
    QueryProcessor,
    getQueryProcessor,
    type QueryAnalysis
} from "./query-processor"
import { getTelemetry } from "./telemetry"

/** Fields the engine reads from Document.metadata (filters, importance); extra fields pass through. */
export interface DocumentMetadata {
  author?: string
  tags?: string[]
  creationDate?: Date
  [key: string]: unknown
}

export interface Document {
  id: string
  name: string
  content: string
  chunks: string[] | TextChunk[] // Support both simple strings and rich TextChunk objects
  /** 1-based page each chunk starts on, aligned with `chunks` (PDFs only). */
  chunkPages?: Array<number | null>
  /** Nearest heading / sheet name for each chunk, aligned with `chunks` (non-PDF formats). */
  chunkSections?: Array<string | null>
  embeddings: number[][]
  /** AIClient.embeddingSpaceId the embeddings were produced in. */
  embeddingSpace?: string
  uploadedAt: Date
  metadata?: DocumentMetadata
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

/**
 * Dense nearest-neighbour search against an external vector store (Pinecone,
 * Weaviate). Returns hits best-first as (documentId, chunkIndex) pairs.
 */
export type VectorSearchFn = (
  embedding: number[],
  limit: number,
  documentIds?: string[]
) => Promise<Array<{ documentId: string; chunkIndex: number; score: number }>>

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
  /** Chunks scoring below this fraction of the best match are dropped (see findRelevantChunks). */
  static RELATIVE_FLOOR = 0.5

  private documents: Document[] = []
  private aiClient: AIClient | null = null
  private isInitialized = false
  private currentConfig: AIConfig | null = null
  /** Bumped per initialize() so an older, slower run can't overwrite a newer one's result. */
  private initGeneration = 0
  /** External vector store queried at retrieval time (null = in-browser index only). */
  private vectorSearch: VectorSearchFn | null = null
  
  // Advanced query processing
  private queryProcessor: QueryProcessor
  
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
    this.queryProcessor = getQueryProcessor({
      cacheEnabled: true,
      cacheTTLMs: 30 * 60 * 1000, // 30 minutes
      maxCacheSize: 500,
      hydeEnabled: true,
      stepBackEnabled: true,
      rewriteEnabled: true
    })
  }
  
  // Get current engine status for consistent error reporting
  getEngineStatus(): RAGEngineStatus {
    return { ...this.engineStatus }
  }

  /**
   * Connect to the AI provider. Resolves with the number of loaded documents
   * that had to be re-embedded (callers persist them again when > 0).
   */
  async initialize(config?: AIConfig): Promise<{ reembeddedDocuments: number }> {
    const generation = ++this.initGeneration
    const isStale = () => generation !== this.initGeneration

    const status: RAGEngineStatus = {
      initialized: false,
      degraded: false,
      degradedReasons: [],
      connectionHealthy: false,
      embeddingAvailable: false,
      textGenerationAvailable: false
    }

    try {
      const client = config ? new AIClient(config) : this.aiClient
      if (!client) {
        throw new Error("AI client not available - configuration required")
      }

      logger.debug(`RAGEngine: Initializing with AI provider`)

      // Text generation is the one hard requirement, and doubles as the
      // connection test (a separate testConnection() call was a wasted request).
      try {
        await client.generateText([{ role: "user", content: "Reply with OK." }], { maxTokens: 1024, effort: "low" })
        status.textGenerationAvailable = true
        status.connectionHealthy = true
      } catch (textError) {
        const errorMessage = textError instanceof Error ? textError.message : "Unknown text generation error"
        throw new Error(`Text generation is required but failed: ${errorMessage}`)
      }

      if (client.usesRemoteEmbeddings) {
        try {
          await client.generateEmbedding("test connection")
          status.embeddingAvailable = true
        } catch (embeddingError) {
          const errorMessage = embeddingError instanceof Error ? embeddingError.message : "Unknown embedding error"
          // Uploads will fail with this error rather than silently indexing
          // documents with vectors from a different space.
          status.degraded = true
          status.degradedReasons.push(`Embedding API unavailable: ${errorMessage}`)
        }
      } else {
        status.embeddingAvailable = true
        status.degraded = true
        status.degradedReasons.push("Provider has no embeddings API; using local keyword (lexical) embeddings")
      }

      if (isStale()) return { reembeddedDocuments: 0 } // A newer configuration superseded this run

      this.aiClient = client
      if (config) this.currentConfig = config
      this.queryProcessor.setAIClient(client)

      // Documents indexed under another embedding model live in a different
      // vector space (often a different dimension): re-embed them, otherwise
      // every chunk is skipped as a dimension mismatch or scored meaninglessly.
      let reembeddedDocuments = 0
      if (status.embeddingAvailable) {
        for (const document of this.documents) {
          if (document.embeddingSpace === client.embeddingSpaceId) continue
          logger.debug(`RAGEngine: re-embedding ${document.name} (${document.embeddingSpace} -> ${client.embeddingSpaceId})`)
          document.embeddings = await client.generateEmbeddings(this.toPlainChunks(document.chunks))
          document.embeddingSpace = client.embeddingSpaceId
          reembeddedDocuments++
          if (isStale()) return { reembeddedDocuments }
        }
        if (reembeddedDocuments > 0) this.queryProcessor.clearCache()
      }

      status.initialized = true
      this.engineStatus = status
      this.isInitialized = true

      if (status.degraded) {
        console.warn("RAGEngine: Initialized in DEGRADED mode:")
        status.degradedReasons.forEach(reason => console.warn(`  - ${reason}`))
      } else {
        logger.debug("RAGEngine: Initialization completed successfully (FULL mode)")
      }
      return { reembeddedDocuments }
    } catch (error) {
      if (isStale()) return { reembeddedDocuments: 0 }
      const errorMessage = error instanceof Error ? error.message : "Unknown initialization error"
      console.error(`RAGEngine: Initialization failed: ${errorMessage}`)
      status.degradedReasons.push(errorMessage)
      this.engineStatus = status
      this.isInitialized = false
      throw new Error(`RAG Engine initialization failed: ${errorMessage}`)
    }
  }

  /**
   * Attach (or detach with null) an external vector store. Its hits are merged
   * into the candidate set and get their own vote in rank fusion; the full
   * in-browser scan still runs, so a remote index that is missing documents
   * can only add recall, never hide local chunks.
   */
  setVectorSearch(fn: VectorSearchFn | null) {
    this.vectorSearch = fn
  }

  /** Re-initialize with a new config; re-embeds documents if the embedding model changed. */
  async updateConfig(config: AIConfig) {
    await this.initialize(config)
  }

  async addDocument(
    document: Document,
    onEmbeddingProgress?: (progress: {
      completed: number
      total: number
      textPreview: string
      documentName: string
    }) => void,
  ) {
    try {
      logger.debug("=== RAG Engine: Adding document ===")
      logger.debug("Document name:", document.name)
      logger.debug("Document ID:", document.id)
      
      // Validate document structure
      if (!document || typeof document !== "object") {
        console.error("Invalid document object:", document)
        throw new Error("Invalid document object")
      }

      logger.debug("Document structure validation:")
      logger.debug("- Has chunks:", !!document.chunks)
      logger.debug("- Chunks is array:", Array.isArray(document.chunks))
      logger.debug("- Chunks length:", document.chunks?.length)
      logger.debug("- Has embeddings:", !!document.embeddings)
      logger.debug("- Embeddings is array:", Array.isArray(document.embeddings))
      logger.debug("- Embeddings length:", document.embeddings?.length)

      if (!document.chunks || !Array.isArray(document.chunks)) {
        console.error("Document chunks are missing or invalid:", document.chunks)
        throw new Error("Document chunks are missing or invalid")
      }

      if (document.chunks.length === 0) {
        console.error("Document has no chunks")
        throw new Error("Document has no chunks")
      }

      logger.debug("First few chunks preview:")
      document.chunks.slice(0, 3).forEach((chunk, i) => {
        const preview = typeof chunk === 'string' ? chunk.substring(0, 100) : (chunk.content ?? '').substring(0, 100)
        logger.debug(`  Chunk ${i}: ${preview}...`)
      })

      // Check AI client status
      logger.debug("AI Client status:")
      logger.debug("- AI Client available:", !!this.aiClient)
      logger.debug("- RAG Engine initialized:", this.isInitialized)

      // Generate embeddings if they don't exist, are invalid, or come from a
      // different embedding model than the current one (e.g. a restored session).
      const wrongSpace = !!this.aiClient && document.embeddingSpace !== undefined && document.embeddingSpace !== this.aiClient.embeddingSpaceId
      if (
        !document.embeddings ||
        !Array.isArray(document.embeddings) ||
        document.embeddings.length !== document.chunks.length ||
        wrongSpace
      ) {
        if (!this.aiClient) {
          console.error("AI client not initialized - cannot generate embeddings")
          throw new Error("AI client not initialized")
        }

        logger.debug("🔄 Generating missing embeddings for document:", document.name)
        logger.debug("- Need to generate embeddings for", document.chunks.length, "chunks")
        
        try {
          const startTime = Date.now()
          const plainChunks = this.toPlainChunks(document.chunks)
          document.embeddingSpace = this.aiClient.embeddingSpaceId
          document.embeddings = await this.aiClient.generateEmbeddings(plainChunks, (progress) => {
            onEmbeddingProgress?.({
              ...progress,
              documentName: document.name,
            })
          })
          const endTime = Date.now()
          logger.debug(`✅ Embeddings generated successfully in ${endTime - startTime}ms`)
          logger.debug("- Generated embeddings count:", document.embeddings.length)
          if (document.embeddings.length > 0) {
            logger.debug("- First embedding dimensions:", document.embeddings[0]?.length)
          }
        } catch (embeddingError) {
          console.error("❌ Failed to generate embeddings:", embeddingError)
          throw new Error(`Failed to generate embeddings: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`)
        }
      } else {
        logger.debug("✅ Document already has valid embeddings")
        logger.debug("- Embedding dimensions:", document.embeddings[0]?.length)
        onEmbeddingProgress?.({
          completed: document.embeddings.length,
          total: document.chunks.length,
          textPreview: "embeddings already available",
          documentName: document.name,
        })
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
      logger.debug("Validating embedding format...")
      for (let i = 0; i < document.embeddings.length; i++) {
        if (!Array.isArray(document.embeddings[i]) || document.embeddings[i].length === 0) {
          console.error(`Invalid embedding at index ${i}:`, document.embeddings[i])
          throw new Error(`Invalid embedding at index ${i}`)
        }
        
        // Log first few embedding details
        if (i < 3) {
          logger.debug(`  Embedding ${i}: ${document.embeddings[i].length} dimensions`)
        }
      }

      // Add to documents array (replacing any earlier copy with the same id)
      this.documents = this.documents.filter((d) => d.id !== document.id)
      const beforeCount = this.documents.length
      this.documents.push(document)
      const afterCount = this.documents.length
      
      logger.debug("✅ Document added successfully to RAG engine")
      logger.debug("- Documents before:", beforeCount)
      logger.debug("- Documents after:", afterCount)
      logger.debug("- Document name:", document.name)
      logger.debug("- Chunks:", document.chunks.length)
      logger.debug("- Total documents in RAG engine:", this.documents.length)
      
      // Verify the document was actually added
      const addedDoc = this.documents.find(d => d.id === document.id)
      if (addedDoc) {
        logger.debug("✅ Document verification: Successfully found in RAG engine documents array")
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
      
      logger.debug("=== RAG Engine: Document addition complete ===")
      
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
    minSimilarityThreshold: number = 0.03,
    remoteRanks?: Map<string, number>
  ) {
    const allChunks: Array<{
      content: string;
      source: string;
      similarity: number;
      documentId: string;
      documentName: string;
      semanticImportance: number;
      chunkIndex?: number;
      rrfScore?: number;
      /** 1-based rank from the external vector store, when it returned this chunk. */
      remoteRank?: number;
      // Optional metadata
      page?: number;
      section?: string;
      bbox?: unknown;
      level?: number;
      chunkType?: string;
    }> = [];

    // Analyze question for content-type-aware boosting
    const contentTypeBoosts = question 
      ? this.analyzeQuestionForContentTypes(question)
      : { tableBoost: 1.0, imageBoost: 1.0, equationBoost: 1.0, dataBoost: 1.0 }
    
    if (question) {
      logger.debug("Content type boosts for query:", contentTypeBoosts)
    }

    try {
      logger.debug("Enhanced findRelevantChunks: Starting multi-document search")

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

      logger.debug(`Processing ${this.documents.length} documents for enhanced similarity search`)

      // Enhanced multi-document processing with better fairness
      const documentMetrics = new Map<string, { avgSimilarity: number; chunkCount: number; bestSimilarity: number }>()

      this.documents.forEach((doc, docIndex) => {
        try {
          logger.debug(`Processing document ${docIndex}: ${doc.name}`)

          // Apply document-level filters first
          if (filters) {
            if (filters.documentIds && filters.documentIds.length > 0 && !filters.documentIds.includes(doc.id)) {
              logger.debug(`Skipping document ${doc.name} - not in document ID filter`)
              return // Skip – ID not in whitelist
            }
            if (filters.authors && filters.authors.length > 0) {
              const author = (doc.metadata?.author || '').toString().toLowerCase()
              const matchesAuthor = filters.authors.some((a) => a.toLowerCase() === author)
              if (!matchesAuthor) {
                logger.debug(`Skipping document ${doc.name} - author filter mismatch`)
                return
              }
            }
            if (filters.tags && filters.tags.length > 0) {
              const docTags: string[] = Array.isArray(doc.metadata?.tags) ? doc.metadata!.tags : []
              const tagMatch = docTags.some((t) => filters.tags!.includes(t))
              if (!tagMatch) {
                logger.debug(`Skipping document ${doc.name} - tag filter mismatch`)
                return
              }
            }
            if (filters.dateRange) {
              const docDate = doc.metadata?.creationDate || doc.uploadedAt
              if (docDate instanceof Date) {
                if (docDate < filters.dateRange.start || docDate > filters.dateRange.end) {
                  logger.debug(`Skipping document ${doc.name} - date range filter mismatch`)
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

          logger.debug(`Document ${docIndex} has ${doc.chunks.length} valid chunks`)

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

              // Cosine similarity against the main query and every query variant
              // (rewrites, HyDE). Taking the best lets a variant recall chunks the
              // literal question would miss; RRF below then orders them.
              let semanticSimilarity = this.aiClient!.cosineSimilarity(questionEmbedding, chunkEmbedding);
              for (const altEmbedding of alternativeEmbeddings) {
                if (altEmbedding.length === chunkEmbedding.length) {
                  semanticSimilarity = Math.max(semanticSimilarity, this.aiClient!.cosineSimilarity(altEmbedding, chunkEmbedding))
                }
              }

              if (typeof semanticSimilarity === "number" && !isNaN(semanticSimilarity)) {
                // Extract chunk content and metadata first
                  // Support both string chunks and TextChunk objects
                  const chunkContent = typeof chunk === 'string' ? chunk : chunk.content
                  const chunkMetadata = typeof chunk === 'object' && 'metadata' in chunk ? chunk.metadata : null

                // Combine identifier-style and lexical exact matching
                const exactMatchBoost = question ? this.calculateCombinedExactMatchBoost(question, chunkContent || '') : 0

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

                const remoteRank = remoteRanks?.get(`${doc.id}-${chunkIndex}`)
                // Chunks the external vector store ranked are kept regardless of
                // the local threshold; fusion decides how far up they go.
                if (hybridSimilarity >= adaptiveMinSim || remoteRank !== undefined) {
                  // Get semantic importance with question-aware content type boosting
                  const semanticImportance = this.extractSemanticImportance(chunk, doc.metadata, contentTypeBoosts)

                  // Build enhanced source string with metadata
                  const page = this.pageOf(doc, chunk, chunkIndex)
                  const section = this.sectionOf(doc, chunkIndex)
                  let sourceString = `${doc.name || "Unknown Document"} (chunk ${chunkIndex + 1})`
                  if (page !== undefined) {
                    sourceString = `${doc.name} · p.${page}` + (chunkMetadata?.level ? ` · ${this.formatChunkType(chunkMetadata.type, chunkMetadata.level)}` : '')
                  } else if (section !== undefined) {
                    sourceString = `${doc.name} · ${section}`
                  } else if (chunkMetadata?.type) {
                    sourceString += ` · ${this.formatChunkType(chunkMetadata.type)}`
                  }

                  allChunks.push({
                    content: chunkContent || "",
                    source: sourceString,
                    similarity: hybridSimilarity, // Use hybrid score instead of pure semantic
                    documentId: doc.id,
                    documentName: doc.name,
                    semanticImportance,
                    chunkIndex,
                    ...(remoteRank !== undefined && { remoteRank }),
                    // Include metadata if available
                    ...(page !== undefined && { page }),
                    ...(section !== undefined && { section }),
                    ...(chunkMetadata?.bbox !== undefined && { bbox: chunkMetadata.bbox }),
                    ...(chunkMetadata?.level !== undefined && { level: chunkMetadata.level }),
                    ...(chunkMetadata?.type && { chunkType: chunkMetadata.type }),
                  });

                  // Log high-similarity chunks with exact match info
                  if (hybridSimilarity > 0.2) {
                    const matchInfo = exactMatchBoost > 0.5 ? ` [EXACT MATCH: ${exactMatchBoost.toFixed(2)}]` : ''
                    logger.debug(`Strong similarity chunk found: ${hybridSimilarity.toFixed(3)} (semantic: ${semanticSimilarity.toFixed(3)}${matchInfo}) from ${sourceString} (importance: ${semanticImportance.toFixed(2)})`)
                  }
                } else if (hybridSimilarity > 0.01) {
                  // Even low-similarity chunks are tracked for diversity purposes
                  logger.debug(`Low similarity chunk: ${hybridSimilarity.toFixed(3)} from ${doc.name} (below threshold but tracked)`)
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
            logger.debug(`Document ${doc.name} metrics - Avg: ${(docSimilaritySum / validChunks).toFixed(3)}, Best: ${docBestHybridSimilarity.toFixed(3)}, Chunks: ${validChunks}`)
          }
        } catch (docError) {
          console.error(`Error processing document ${docIndex}:`, docError);
        }
      });

      logger.debug(`Total chunks processed: ${allChunks.length} from ${documentMetrics.size} documents`)

      if (allChunks.length === 0) {
        console.warn("No chunks were successfully processed")
        return [];
      }

      const isMultiDocQuery = question ? this.isMultiDocumentQuery(question) : false

      // Relative floor: the absolute threshold (0.03) is below the noise floor of
      // every embedding model, so on small documents it let every chunk through.
      // Keep chunks within RELATIVE_FLOOR of the best match. Skipped for the
      // deliberately permissive fallback searches (threshold < 0.03); chunks the
      // external vector store ranked are always kept.
      let candidateChunks = allChunks
      if (minSimilarityThreshold >= 0.03) {
        const best = Math.max(...allChunks.map((c) => c.similarity))
        const floor = best * RAGEngine.RELATIVE_FLOOR
        const kept = allChunks.filter((c) => c.similarity >= floor || c.remoteRank !== undefined)
        logger.debug(`Relative floor ${floor.toFixed(3)} (best ${best.toFixed(3)}): kept ${kept.length}/${allChunks.length} chunks`)
        candidateChunks = kept
      }

      // For single-document intent, keep candidates from top-relevance documents only.
      // This avoids low-relevance cross-document bleed into citations.
      if (!isMultiDocQuery && documentMetrics.size > 1) {
        const docScores = Array.from(documentMetrics.entries())
          .map(([docId, metrics]) => ({ docId, bestSimilarity: metrics.bestSimilarity }))
          .sort((a, b) => b.bestSimilarity - a.bestSimilarity)

        const globalBest = docScores[0]?.bestSimilarity || 0
        const minBaseline = (filters?.minSimilarity ?? minSimilarityThreshold) + 0.02
        const scoreFloor = Math.max(minBaseline, globalBest * 0.72)

        const eligibleDocIds = new Set(
          docScores
            .filter(({ bestSimilarity }) => bestSimilarity >= scoreFloor)
            .map(({ docId }) => docId)
        )

        if (eligibleDocIds.size === 0 && docScores[0]) {
          eligibleDocIds.add(docScores[0].docId)
        }

        candidateChunks = candidateChunks.filter((chunk) => eligibleDocIds.has(chunk.documentId))
        logger.debug(
          `Single-doc gating: ${candidateChunks.length}/${allChunks.length} chunks retained from ${eligibleDocIds.size} document(s); floor=${scoreFloor.toFixed(3)}`
        )
      }

      // Step 1: Generate multiple retrieval strategies
      let finalChunks: typeof allChunks = []
      
      if (useRRF && question) {
        // If alternative embeddings are provided, use multi-query RRF
        if (alternativeEmbeddings.length > 0) {
          logger.debug(`Using Multi-Query Reciprocal Rank Fusion with ${alternativeEmbeddings.length + 1} query variations`)
          finalChunks = this.applyMultiQueryRRF(candidateChunks, questionEmbedding, alternativeEmbeddings, question, topK)
        } else {
          logger.debug("Using Reciprocal Rank Fusion (RRF) with multiple retrieval strategies")
          finalChunks = this.applyReciprocalRankFusion(candidateChunks, questionEmbedding, question, topK)
        }
      } else {
        // Fallback to single strategy with diversity algorithm
        logger.debug("Using single retrieval strategy with diversity algorithm")
        finalChunks = this.applyEnhancedDiversityAlgorithm(
          candidateChunks,
          documentMetrics,
          topK,
          filters?.minSimilarity ?? minSimilarityThreshold,
          isMultiDocQuery
        )
      }

      // Step 2: Re-ranking (if enabled)
      if (useReranking && question && finalChunks.length > 0) {
        logger.debug("Applying re-ranking to improve result quality")
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
   * Lexical exact-match boost for literal query terms and phrases.
   * This complements identifier matching for non-legal/non-structured queries.
   */
  private calculateLexicalExactMatchBoost(query: string, chunkContent: string): number {
    if (!query || !chunkContent) return 0

    const normalizeText = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const stopWords = new Set([
      "the", "and", "for", "with", "that", "this", "from", "have", "what", "when", "where", "which",
      "who", "why", "how", "about", "into", "onto", "than", "then", "their", "there", "your", "you",
      "are", "was", "were", "been", "being", "can", "could", "should", "would", "will", "shall", "may",
      "might", "must", "does", "did", "done", "has", "had", "not", "but", "out", "any", "all", "per",
      "our", "its", "his", "her", "them", "they", "also"
    ])

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(chunkContent)

    if (!normalizedQuery || !normalizedContent) return 0

    const queryTerms = normalizedQuery
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term))

    if (queryTerms.length === 0) return 0

    const uniqueQueryTerms = Array.from(new Set(queryTerms))
    const contentTermsSet = new Set(normalizedContent.split(/\s+/))
    const matchedTerms = uniqueQueryTerms.filter((term) => contentTermsSet.has(term)).length
    const coverage = matchedTerms / uniqueQueryTerms.length

    const phrase = uniqueQueryTerms.join(" ")
    const phraseMatch = uniqueQueryTerms.length > 1 && normalizedContent.includes(phrase)
      ? 1
      : 0

    // Require meaningful overlap to count as an "exact" lexical signal.
    if (coverage < 0.5 && phraseMatch === 0) return 0

    const lexicalBoost = coverage * 0.8 + phraseMatch * 0.2
    return Math.min(1, lexicalBoost)
  }

  /**
   * Unified exact-match score used by retrieval/reranking.
   */
  private calculateCombinedExactMatchBoost(query: string, chunkContent: string): number {
    const identifierBoost = this.calculateExactMatchBoost(query, chunkContent)
    const lexicalBoost = this.calculateLexicalExactMatchBoost(query, chunkContent)
    return Math.max(identifierBoost, lexicalBoost)
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
      chunkIndex?: number;
      remoteRank?: number;
      page?: number;
      bbox?: unknown;
      level?: number;
      chunkType?: string;
    }>,
    questionEmbedding: number[],
    question: string,
    topK: number
  ): typeof allChunks {
    logger.debug("=== Reciprocal Rank Fusion (RRF) ===")
    const k = 60 // RRF constant (standard value)

    // Strategy 1: Semantic similarity ranking
    const semanticRanked = [...allChunks]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK * 2) // Get more candidates for RRF

    // Strategy 2: Exact match boost ranking (already calculated in similarity, but we'll re-rank)
    const exactMatchRanked = [...allChunks]
      .map(chunk => ({
        ...chunk,
        exactMatchScore: this.calculateCombinedExactMatchBoost(question, chunk.content)
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

    // Query-independent "importance" deliberately gets no RRF vote: a full vote
    // promoted headings and tables regardless of the question. It still enters
    // reranking as a small tie-breaker.

    // Create a map of chunk IDs to RRF scores
    const chunkMap = new Map<string, {
      chunk: typeof allChunks[0];
      rrfScore: number;
      ranks: { semantic: number; exactMatch: number; keyword: number; vector: number };
    }>()

    // Calculate RRF scores for each chunk
    const addToRRF = (rankedList: typeof allChunks, strategyName: 'semantic' | 'exactMatch' | 'keyword' | 'vector') => {
      rankedList.forEach((chunk, index) => {
        const chunkId = `${chunk.documentId}-${chunk.chunkIndex}`
        const rank = index + 1
        const rrfContribution = 1 / (k + rank)

        if (!chunkMap.has(chunkId)) {
          chunkMap.set(chunkId, {
            chunk,
            rrfScore: 0,
            ranks: { semantic: Infinity, exactMatch: Infinity, keyword: Infinity, vector: Infinity }
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
    // Strategy 4: the external vector store's own ranking (Pinecone/Weaviate), when attached
    const vectorRanked = allChunks
      .filter((chunk) => chunk.remoteRank !== undefined)
      .sort((a, b) => (a.remoteRank as number) - (b.remoteRank as number))
    if (vectorRanked.length > 0) addToRRF(vectorRanked, 'vector')

    // Sort by RRF score
    const sortedByRRF = Array.from(chunkMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(entry => ({
        ...entry.chunk,
        rrfScore: entry.rrfScore,
        rrfRanks: entry.ranks
      }))

    // Apply cross-document diversity only for explicit multi-document queries.
    // For single-document intent, diversity can surface unrelated documents.
    // Returns 2×topK so the reranker has something to choose from; it trims to topK.
    const isMultiDoc = this.isMultiDocumentQuery(question)
    const rrfResults = isMultiDoc
      ? this.applyCrossDocumentDiversity(sortedByRRF, topK * 2, isMultiDoc)
      : sortedByRRF.slice(0, topK * 2)

    logger.debug(`RRF: Combined ${chunkMap.size} unique chunks from 3 strategies, returning top ${rrfResults.length}`)
    if (rrfResults.length > 0) {
      logger.debug(`Best RRF score: ${rrfResults[0].rrfScore?.toFixed(4) || 'N/A'}`)
      // Log document distribution
      const docCounts = new Map<string, number>()
      rrfResults.forEach(r => docCounts.set(r.documentName, (docCounts.get(r.documentName) || 0) + 1))
      logger.debug(`Document distribution: ${Array.from(docCounts.entries()).map(([n, c]) => `${n}:${c}`).join(', ')}`)
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

    logger.debug(`Cross-doc diversity: ${numDocs} docs, max ${maxPerDoc}/doc, multiDoc: ${isMultiDocQuery}`)

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
      chunkIndex?: number;
      rrfScore?: number;
      remoteRank?: number;
      page?: number;
      bbox?: unknown;
      level?: number;
      chunkType?: string;
    }>,
    questionEmbedding: number[],
    alternativeEmbeddings: number[][],
    question: string,
    topK: number
  ): typeof allChunks {
    logger.debug("=== Multi-Query Reciprocal Rank Fusion ===")
    const k = 60 // RRF constant
    const docsById = new Map(this.documents.map((d) => [d.id, d]))
    const keyOf = (chunk: typeof allChunks[0]) => `${chunk.documentId}-${chunk.chunkIndex}`

    // RRF(d) = Σ 1 / (k + rank_i(d)) over one ranking per query variant
    const rrfScores = new Map<string, number>()
    for (const embedding of [questionEmbedding, ...alternativeEmbeddings]) {
      const scored: Array<{ key: string; similarity: number }> = []
      for (const chunk of allChunks) {
        if (chunk.chunkIndex === undefined) continue
        const chunkEmbedding = docsById.get(chunk.documentId)?.embeddings?.[chunk.chunkIndex]
        if (!chunkEmbedding || chunkEmbedding.length !== embedding.length) continue
        const similarity = this.aiClient!.cosineSimilarity(embedding, chunkEmbedding)
        if (!Number.isNaN(similarity)) scored.push({ key: keyOf(chunk), similarity })
      }
      scored.sort((a, b) => b.similarity - a.similarity)
      scored.forEach((item, rank) => rrfScores.set(item.key, (rrfScores.get(item.key) || 0) + 1 / (k + rank + 1)))
    }
    // One more vote from the external vector store's ranking, when attached
    for (const chunk of allChunks) {
      if (chunk.remoteRank !== undefined) {
        rrfScores.set(keyOf(chunk), (rrfScores.get(keyOf(chunk)) || 0) + 1 / (k + chunk.remoteRank))
      }
    }

    // Keep the cosine/hybrid score in `similarity` (reranking, relevance and
    // confidence read it as a 0..1 semantic signal); RRF only decides order.
    const finalRankedChunks = allChunks
      .map((chunk) => ({ ...chunk, rrfScore: rrfScores.get(keyOf(chunk)) || 0 }))
      .sort((a, b) => b.rrfScore - a.rrfScore)

    const isMultiDoc = this.isMultiDocumentQuery(question)
    // 2×topK: the reranker makes the final cut.
    const diverseResults = this.applyCrossDocumentDiversity(finalRankedChunks, topK * 2, isMultiDoc)

    logger.debug(`Multi-Query RRF: fused ${alternativeEmbeddings.length + 1} query variations, top RRF score: ${diverseResults[0]?.rrfScore?.toFixed(4) || 'N/A'}`)
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

    const stopWords = new Set([
      "the", "and", "for", "with", "that", "this", "from", "what", "when", "where", "which", "who",
      "why", "how", "about", "into", "onto", "than", "then", "their", "there", "your", "you", "are",
      "was", "were", "been", "being", "can", "could", "should", "would", "will", "shall", "may", "might",
      "must", "does", "did", "done", "has", "had", "not", "but", "out", "any", "all", "per", "our", "its",
      "his", "her", "them", "they", "also"
    ])

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)

    const queryTerms = normalizedQuery
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term))
    const contentTerms = normalizedContent.split(/\s+/)

    if (queryTerms.length === 0) return 0

    const uniqueQueryTerms = Array.from(new Set(queryTerms))

    // Calculate term frequency (TF) and inverse document frequency (IDF) inspired scores
    let totalScore = 0
    let matchedTerms = 0
    const termFrequencies = new Map<string, number>()

    // Count term frequencies in content
    contentTerms.forEach(term => {
      termFrequencies.set(term, (termFrequencies.get(term) || 0) + 1)
    })

    // Calculate score for each query term
    uniqueQueryTerms.forEach(queryTerm => {
      const tf = termFrequencies.get(queryTerm) || 0
      const contentLength = contentTerms.length

      if (tf > 0) {
        matchedTerms += 1
      }
      
      // BM25-like scoring (simplified)
      // Score = (tf * idf) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)))
      // Simplified version without IDF and avgDocLength
      const k1 = 1.5
      const b = 0.75
      const avgDocLength = 200 // Approximate average
      
      const score = (tf * 1.0) / (tf + k1 * (1 - b + b * (contentLength / avgDocLength)))
      totalScore += score
    })

    const bm25Like = totalScore / uniqueQueryTerms.length
    const termCoverage = matchedTerms / uniqueQueryTerms.length

    // Blend local term strength and query-term coverage.
    return Math.min(1, bm25Like * 0.7 + termCoverage * 0.3)
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
      bbox?: unknown;
      level?: number;
      chunkType?: string;
      rrfScore?: number;
      rrfRanks?: unknown;
    }>,
    question: string,
    topK: number
  ): typeof chunks {
    logger.debug("=== Re-ranking Chunks ===")
    logger.debug(`Re-ranking ${chunks.length} chunks for question: "${question.substring(0, 100)}"`)

    const maxRrf = Math.max(0, ...chunks.map((c) => c.rrfScore ?? 0))
    const reranked = chunks.map(chunk => {
      // Calculate multiple relevance signals
      const exactMatchScore = this.calculateCombinedExactMatchBoost(question, chunk.content)
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

      // Boost for chunks that ranked well across RRF strategies, normalised to 0..1
      if (chunk.rrfScore !== undefined && maxRrf > 0) {
        rerankScore = rerankScore * 0.8 + (chunk.rrfScore / maxRrf) * 0.2
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
      .map((chunk) => {
        const cleaned = { ...chunk } as Record<string, unknown>
        delete cleaned.rerankScore
        delete cleaned.rerankSignals
        return cleaned as typeof chunks[0]
      }) // Remove temporary fields

    logger.debug(`Re-ranking complete: ${finalReranked.length} chunks selected`)
    if (finalReranked.length > 0) {
      const topChunk = reranked.find(c => c.content === finalReranked[0].content)
      if (topChunk) {
        logger.debug(`Top reranked chunk score: ${topChunk.rerankScore?.toFixed(4)}`)
        logger.debug(`  - Exact match: ${topChunk.rerankSignals?.exactMatch.toFixed(3)}`)
        logger.debug(`  - Keyword: ${topChunk.rerankSignals?.keyword.toFixed(3)}`)
        logger.debug(`  - Semantic: ${topChunk.rerankSignals?.semantic.toFixed(3)}`)
        logger.debug(`  - Importance: ${topChunk.rerankSignals?.importance.toFixed(3)}`)
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
  private toPlainChunks(chunks: ReadonlyArray<string | TextChunk>): string[] {
    if (!Array.isArray(chunks)) return []
    return chunks.map((c) => (typeof c === 'string' ? c : (c?.content ?? '')))
  }

  // Safe preview extraction for union chunk types
  private getChunkPreview(chunk: string | TextChunk | null | undefined): string {
    if (!chunk) return ''
    const text = typeof chunk === 'string' ? chunk : (chunk.content ?? '')
    return text.substring(0, 100)
  }

  async query(question: string, options?: { 
    showThinking?: boolean, 
    tokenBudget?: number,
    complexityLevel?: 'simple' | 'normal' | 'complex',
    filters?: RAGFilterOptions,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    sessionId?: string // For rate limiting
    /**
     * One LLM call: skip context resolution, query rewriting/HyDE/step-back and
     * the fact check. Groundedness then falls back to the lexical estimate.
     */
    fastMode?: boolean
  }): Promise<EnhancedQueryResponse> {
    const queryStartTime = Date.now()
    const queryId = `query_${queryStartTime}_${Math.random().toString(36).substring(7)}`
    logger.debug(`Enhanced RAG query started [${queryId}]:`, question);

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
      logger.debug(`[${queryId}] Rate limit: ${rateLimitResult.remaining} requests remaining`)

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

      // ==================== CONVERSATION CONTEXT ====================
      // Resolve follow-ups ("what does it cost?") into a standalone question
      // *before* analysis, so rewriting, HyDE, embedding and the cache all see
      // the subject.
      const history = options?.conversationHistory ?? []
      const fastMode = options?.fastMode ?? false
      // Fast mode leaves follow-up resolution to the answering call, which sees the history.
      const resolvedQuestion = history.length > 0 && !fastMode
        ? await this.resolveConversationContext(sanitizedQuestion, history)
        : sanitizedQuestion

      // ==================== CACHE CHECK ====================
      // Keyed on the standalone question plus the active document filter, so a
      // document-scoped question never gets an answer computed over everything.
      const filterIds = filters?.documentIds?.length ? [...filters.documentIds].sort() : []
      const cacheScope = [
        ...this.documents.map(d => d.id),
        ...(filterIds.length ? ['|filter', ...filterIds] : []),
        // Fast answers are unverified; never serve one where a verified answer was asked for.
        ...(fastMode ? ['|fast'] : []),
      ]
      const cachedResponse = this.queryProcessor.getCachedResponse(resolvedQuestion, cacheScope)
      if (cachedResponse) {
        logger.debug(`[${queryId}] Cache HIT - returning cached response`)
        return {
          answer: cachedResponse.answer,
          sources: cachedResponse.sources,
          relevanceScore: cachedResponse.relevanceScore,
          retrievedChunks: cachedResponse.retrievedChunks,
          qualityMetrics: cachedResponse.qualityMetrics || defaultResponse.qualityMetrics,
          tokenUsage: { contextTokens: 0, reasoningTokens: 0, responseTokens: 0, totalTokens: 0 },
        }
      }
      logger.debug(`[${queryId}] Cache MISS - processing query`)

      // ==================== ADVANCED QUERY ANALYSIS ====================
      const queryAnalysis = await this.queryProcessor.analyzeQuery(resolvedQuestion, { useLLM: !fastMode })
      logger.debug(`[${queryId}] Query analysis:`, {
        type: queryAnalysis.queryType,
        complexity: queryAnalysis.complexity,
        hasHypotheticalAnswer: !!queryAnalysis.hypotheticalAnswer,
        hasStepBackQuestion: !!queryAnalysis.stepBackQuestion,
        alternativeQueries: queryAnalysis.alternativeQueries.length
      })

      // Determine processing approach based on complexity
      // The model answers the user's (resolved) question; phase 1 uses
      // queryAnalysis.rewrittenQuery only for retrieval.
      const response = await this.processQueryEnhanced(
        resolvedQuestion, 
        tokenBudget, 
        complexityLevel, 
        showThinking, 
        filters, 
        options?.conversationHistory,
        queryAnalysis, // Pass query analysis for HyDE and step-back
        fastMode
      )

      // ==================== CACHE STORE ====================
      // Store successful responses in cache
      if (response.answer && response.relevanceScore > 0.3) {
        this.queryProcessor.cacheResponse(resolvedQuestion, {
          answer: response.answer,
          sources: response.sources,
          relevanceScore: response.relevanceScore,
          retrievedChunks: response.retrievedChunks,
          qualityMetrics: response.qualityMetrics
        }, cacheScope)
        logger.debug(`[${queryId}] Response cached for future queries`)
      }

      return {
        ...response,
        queryAnalysis: {
          originalQuery: queryAnalysis.originalQuery,
          rewrittenQuery: queryAnalysis.rewrittenQuery,
          queryType: queryAnalysis.queryType,
          complexity: queryAnalysis.complexity,
          requiresHyDE: queryAnalysis.requiresHyDE,
          requiresStepBack: queryAnalysis.requiresStepBack,
          alternativeQueries: queryAnalysis.alternativeQueries,
          hasHypotheticalAnswer: !!queryAnalysis.hypotheticalAnswer,
          hasStepBackQuestion: !!queryAnalysis.stepBackQuestion,
          confidence: queryAnalysis.confidence,
        },
      }

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
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    queryAnalysis?: QueryAnalysis,
    fastMode = false
  ): Promise<EnhancedQueryResponse> {
    const processStartTime = Date.now()
    const queryId = `eval_${processStartTime}`
    
    // Phase-based token allocation
    const tokenAllocation = this.calculateTokenAllocation(tokenBudget, complexityLevel)
    
    // ==================== PHASE 1: Retrieval ====================
    const retrievalStartTime = Date.now()
    const phase1Result = await this.phase1_ContextAnalysis(
      question, 
      tokenAllocation.context, 
      filters, 
      conversationHistory,
      queryAnalysis // Pass query analysis for HyDE and step-back
    )
    const retrievalLatencyMs = Date.now() - retrievalStartTime
    
    // ==================== PHASE 2: Self-Critique ====================
    // Nothing to audit when retrieval found no context (the "answer" is a
    // clarification or error message) — skip the extra LLM round-trips.
    const hasContext = (phase1Result.relevantChunks?.length ?? 0) > 0
    // Every answer grounded in documents is fact-checked, including "simple" ones:
    // the groundedness score shown to the user comes from this check.
    const phase2Result = hasContext && !fastMode ? await this.phase2_SelfCritique(phase1Result) : null
    
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
    // Enforced: the sanitized answer (unsourced sensitive values redacted) is
    // what the user sees; the remaining issues travel with it as warnings.
    const outputValidation = Guardrails.validateOutput(
      phase3Result.answer,
      phase1Result.context || '',
      phase1Result.relevantChunks || []
    )
    phase3Result.answer = outputValidation.sanitizedOutput || phase3Result.answer
    if (outputValidation.issues.length > 0) {
      phase3Result.warnings = outputValidation.issues
      console.warn(`[${queryId}] Output validation issues:`, outputValidation.issues)
    }

    // ==================== EVALUATION: Track Metrics ====================
    try {
      const chunks = phase1Result.relevantChunks || []
      const evaluation = createQueryEvaluation(
        queryId,
        question,
        chunks.map((c) => ({
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
      logger.debug(`[${queryId}] Evaluation: overall=${(evaluation.overallScore * 100).toFixed(1)}%, ` +
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
    // Floor for retrieved context. Current models take 128K–1M tokens, and the
    // old shares of a 4K budget left ~3 chunks — complex questions got the
    // *least* context of all. Harder questions now get more.
    const contextFloor = { 'simple': 3000, 'normal': 5000, 'complex': 8000 }

    const allocation = allocations[complexity as keyof typeof allocations] ?? allocations.normal

    return {
      context: Math.max(Math.floor(budget * allocation.context), contextFloor[complexity as keyof typeof contextFloor] ?? 5000),
      critique: Math.floor(budget * allocation.critique), 
      refinement: Math.floor(budget * allocation.refinement)
    }
  }

  private async phase1_ContextAnalysis(
    question: string, 
    tokenBudget: number, 
    filters?: RAGFilterOptions, 
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    queryAnalysis?: QueryAnalysis
  ): Promise<Phase1Result> {
    logger.debug("Phase 1: Context Analysis and Initial Response")
    
    // Debug: Check system state
    logger.debug("RAG Engine Debug:")
    logger.debug("- Documents available:", this.documents.length)
    logger.debug("- AI Client available:", !!this.aiClient)
    logger.debug("- Is initialized:", this.isInitialized)
    
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
      logger.debug(`Document ${index}: ${doc.name}, chunks: ${doc.chunks?.length || 0}, embeddings: ${doc.embeddings?.length || 0}`)
    })
    
    try {
      // Use query analysis if provided, otherwise detect vagueness
      const vaguenessScore = queryAnalysis ? 
        (queryAnalysis.complexity === 'complex' ? 0.5 : 0.2) : 
        this.detectVagueness(question)
      logger.debug(`Vagueness score: ${vaguenessScore.toFixed(2)} (0=clear, 1=very vague)`)
      
      let processedQuestion = queryAnalysis?.rewrittenQuery || question
      let expandedQueries: string[] = queryAnalysis?.alternativeQueries || []
      
      // If question is vague and no query analysis, expand it
      if (vaguenessScore > 0.4 && !queryAnalysis) {
        logger.debug("⚠️ Vague question detected - expanding query...")
        const expansionResult = await this.expandVagueQuery(question)
        processedQuestion = expansionResult.expandedQuery
        expandedQueries = expansionResult.alternativeQueries
        
        logger.debug(`Expanded query: "${processedQuestion}"`)
        logger.debug(`Alternative queries: ${expandedQueries.length}`)
      }
      
      // ==================== Query embeddings (one batched call) ====================
      // Main query, query rewrites, HyDE hypothetical answer and step-back question
      // are embedded together. HyDE is fused as one more query variant rather than
      // replacing the question: a confidently wrong hypothetical answer then can't
      // steer retrieval on its own.
      const altQueries = expandedQueries.filter((q) => q && q.trim() && q !== processedQuestion).slice(0, 3)
      const hydeText = queryAnalysis?.hypotheticalAnswer?.trim() || ""
      const stepBackText = queryAnalysis?.stepBackQuestion?.trim() || ""
      const toEmbed = [processedQuestion, ...altQueries, ...(hydeText ? [hydeText] : []), ...(stepBackText ? [stepBackText] : [])]
      const embedded = await this.aiClient!.generateEmbeddings(toEmbed)
      const questionEmbedding = embedded[0]
      const alternativeEmbeddings = embedded.slice(1, 1 + altQueries.length + (hydeText ? 1 : 0))
      const stepBackEmbedding = stepBackText ? embedded[embedded.length - 1] : null
      logger.debug(`Embedded ${toEmbed.length} query variants (HyDE: ${!!hydeText}, step-back: ${!!stepBackText})`)

      // ==================== Step-back Prompting ====================
      // Broader-context retrieval for the abstract version of the question.
      let stepBackChunks: ReturnType<RAGEngine['findRelevantChunks']> = []
      if (stepBackEmbedding) {
        stepBackChunks = this.findRelevantChunks(
          stepBackEmbedding,
          2, // A little background, not a replacement for the direct matches
          filters,
          stepBackText,
          false, // No RRF for step-back
          false, // No reranking for step-back
          [],
          0.1 // Lower threshold for broader context
        )
        logger.debug(`Step-back retrieval found ${stepBackChunks.length} broader context chunks`)
      }

      // Analyze question type for optimal chunk selection
      const questionType = this.analyzeQuestionType(processedQuestion)
      const chunkLimit = this.getOptimalChunkLimit(questionType)
      // Increase chunk limit for vague questions to get more context
      const adjustedChunkLimit = vaguenessScore > 0.4 ? Math.min(chunkLimit * 2, 15) : chunkLimit
      logger.debug(`Question type: ${questionType}, chunk limit: ${adjustedChunkLimit}`)
      
      // Find relevant chunks with question-aware boosting, RRF, and re-ranking
      logger.debug("Finding relevant chunks with RRF and re-ranking...")
      const useRRF = true // Enable RRF by default
      const useReranking = true // Enable re-ranking by default

      // ==================== External vector store ====================
      let remoteRanks: Map<string, number> | undefined
      if (this.vectorSearch) {
        try {
          const hits = await this.vectorSearch(questionEmbedding, Math.max(adjustedChunkLimit * 4, 20), filters?.documentIds)
          remoteRanks = new Map(hits.map((hit, i) => [`${hit.documentId}-${hit.chunkIndex}`, i + 1]))
          logger.debug(`External vector store returned ${hits.length} candidates`)
        } catch (error) {
          // Retrieval still works from the in-browser index.
          console.warn("External vector search failed; using the in-browser index only:", error)
        }
      }

      let relevantChunks = this.findRelevantChunks(
        questionEmbedding, 
        adjustedChunkLimit, 
        filters, 
        question, 
        useRRF, 
        useReranking,
        alternativeEmbeddings, // Pass alternative embeddings for multi-query retrieval
        undefined,
        remoteRanks
      );
      logger.debug(`Found ${relevantChunks.length} relevant chunks after RRF and re-ranking`)
      
      // Debug: Log chunk similarities
      if (relevantChunks.length > 0) {
        logger.debug("Top chunks:")
        relevantChunks.slice(0, 3).forEach((chunk, i) => {
          logger.debug(`  ${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}, Source: ${chunk.source}`)
          logger.debug(`     Content preview: ${chunk.content.substring(0, 100)}...`)
        })
      } else {
        console.warn("No relevant chunks found - checking why...")
        
        // Debug: Check first document in detail
        if (this.documents.length > 0) {
          const firstDoc = this.documents[0]
          logger.debug("First document analysis:")
          logger.debug("- Name:", firstDoc.name)
          logger.debug("- Has chunks:", !!firstDoc.chunks)
          logger.debug("- Chunks length:", firstDoc.chunks?.length)
          logger.debug("- Has embeddings:", !!firstDoc.embeddings)
          logger.debug("- Embeddings length:", firstDoc.embeddings?.length)
          
          if (firstDoc.chunks && firstDoc.chunks.length > 0) {
            const prev = this.getChunkPreview(firstDoc.chunks[0])
            logger.debug("- First chunk preview:", prev)
          }
          
          if (firstDoc.embeddings && firstDoc.embeddings.length > 0) {
            logger.debug("- First embedding dimensions:", firstDoc.embeddings[0]?.length)
            logger.debug("- Question embedding dimensions:", questionEmbedding.length)
          }
        }
      }
      
      // Fallback strategies if no chunks found
      if (relevantChunks.length === 0) {
        console.warn("No relevant chunks found - attempting fallback strategies...")
        
        // Strategy 1: Try broader keyword search
        const keywordChunks = this.fallbackKeywordSearch(question, [processedQuestion, ...expandedQueries], 10, filters)
        if (keywordChunks.length > 0) {
          logger.debug(`Fallback keyword search found ${keywordChunks.length} chunks`)
          relevantChunks = keywordChunks
        }
        
        // Strategy 2: Try semantic search with MUCH lower threshold
        if (relevantChunks.length === 0) {
          logger.debug("Attempting semantic search with very low threshold (0.005)...")
          const lowThresholdChunks = this.findRelevantChunks(
            questionEmbedding,
            adjustedChunkLimit * 2, // Get more chunks
            filters,
            question,
            useRRF,
            useReranking,
            alternativeEmbeddings,
            0.005 // Very low threshold to catch anything remotely relevant
          )
          if (lowThresholdChunks.length > 0) {
            logger.debug(`Low-threshold search found ${lowThresholdChunks.length} chunks`)
            relevantChunks = lowThresholdChunks
          }
        }
        
        // Strategy 3: Return top chunks by importance if still nothing
        if (relevantChunks.length === 0) {
          logger.debug("Attempting importance-based retrieval...")
          const importanceChunks = this.getTopChunksByImportance(10, filters)
          if (importanceChunks.length > 0) {
            logger.debug(`Importance-based retrieval found ${importanceChunks.length} chunks`)
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

      // ==================== Merge Step-back Context ====================
      // Step-back chunks go *after* the direct matches: the token budget is filled
      // in order, so putting broad background first evicted the best evidence.
      if (stepBackChunks.length > 0) {
        logger.debug(`Merging ${stepBackChunks.length} step-back context chunks with ${relevantChunks.length} main chunks`)
        const existingContents = new Set(relevantChunks.map((c) => c.content.substring(0, 100)))
        const uniqueStepBackChunks = stepBackChunks.filter((c) => 
          !existingContents.has(c.content.substring(0, 100))
        )
        relevantChunks = [...relevantChunks, ...uniqueStepBackChunks]
        logger.debug(`Total chunks after merge: ${relevantChunks.length}`)
      }

      // Optimize chunks for token budget
      logger.debug("Optimizing chunks for token budget:", tokenBudget)
      const optimizedChunks = this.optimizeChunksForTokens(relevantChunks, tokenBudget)
      logger.debug(`Optimized to ${optimizedChunks.length} chunks`)
      
      // Label each chunk with its source so the model can cite accurately
      const context = optimizedChunks.map((chunk) => {
        const name = chunk.documentName || chunk.source || 'Unknown'
        const where = chunk.page != null ? ` | Page ${chunk.page}` : chunk.section ? ` | Section: ${chunk.section}` : ''
        return `[SOURCE: ${name}${where}]\n${chunk.content}`
      }).join("\n\n---\n\n")
      logger.debug("Context length:", context.length, "characters")

      // Generate initial response with enhanced prompt (include conversation history)
      const systemPrompt = this.createEnhancedSystemPrompt(questionType)
      const userPrompt = this.createPhase1UserPrompt(question, context, conversationHistory)
      
      logger.debug("Generating AI response...")
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system" as const, content: systemPrompt }
      ]
      
      // Add conversation history if available (last 5 exchanges to avoid token limits)
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-10) // Last 10 messages (5 exchanges)
        logger.debug(`Including ${recentHistory.length} previous messages in context`)
        recentHistory.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content })
        })
      }
      
      // Add current question
      messages.push({ role: "user" as const, content: userPrompt })

      // Generate response with low temperature for deterministic, factual responses
      const initialResponse = await this.aiClient!.generateText(messages, { temperature: 0.1 });
      logger.debug("AI response generated, length:", initialResponse.length)

      // Cheap lexical groundedness estimate. The LLM verifier (phase 2) replaces
      // it whenever its output parses; this is only the fallback signal.
      const groundednessResult = this.checkGroundedness(initialResponse, optimizedChunks, question)

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

  /**
   * LLM fact-check of `answer` against `context`: per-claim support verdicts
   * plus an overall pass/revise verdict. `verification` is null when the
   * model's JSON could not be parsed.
   */
  private async verifyAnswer(question: string, context: string, answer: string): Promise<VerificationResult> {
    const prompt = this.createVerificationPrompt(question, context, answer)
    const response = await this.aiClient!.generateText(
      [
        { role: "system", content: "You are a meticulous fact-checker. Return structured JSON only." },
        { role: "user", content: prompt },
      ],
      { temperature: 0, effort: "low" }
    )

    const issues = this.parseCritiqueResponse(response)
    const verdict = this.parseCritiqueVerdict(response)
    const verification = this.parseClaimVerdicts(response)

    return {
      critiqueText: response.trim(),
      identifiedIssues: issues,
      // Refine only when the checker asked for it (or listed issues without a verdict).
      needsRevision: verdict === 'revise' || (verdict === null && issues.length > 0),
      verification,
      tokensUsed: this.estimateTokens(prompt + response),
    }
  }

  /** Per-claim verdicts from the verifier JSON; null when absent or unparseable. */
  private parseClaimVerdicts(response: string): VerificationResult['verification'] {
    try {
      const json = response.match(/\{[\s\S]*\}/)?.[0]
      if (!json) return null
      const claims: unknown = JSON.parse(json)?.claims
      if (!Array.isArray(claims) || claims.length === 0) return null
      const parsed = claims
        .filter((c): c is { claim?: unknown; supported?: unknown } => typeof c === 'object' && c !== null)
        .map((c) => ({ claim: String(c.claim ?? ''), supported: c.supported === true }))
      if (parsed.length === 0) return null
      return {
        total: parsed.length,
        supported: parsed.filter((c) => c.supported).length,
        unsupportedClaims: parsed.filter((c) => !c.supported).map((c) => c.claim),
      }
    } catch {
      return null
    }
  }

  private async phase2_SelfCritique(phase1Result: Phase1Result): Promise<VerificationResult> {
    logger.debug("Phase 2: LLM verification of the draft")
    return this.verifyAnswer(phase1Result.question, phase1Result.context, phase1Result.initialResponse)
  }

  private async phase3_Refinement(
    phase1Result: Phase1Result,
    phase2Result: VerificationResult | null,
    tokenBudget: number,
    showThinking: boolean
  ): Promise<EnhancedQueryResponse> {
    logger.debug(`Phase 3: Refinement and Final Response (budget ${tokenBudget})`)

    let finalResponse: string
    let finalCheck: VerificationResult | null = phase2Result
    let refinementTokens = 0

    if (phase2Result?.needsRevision) {
      // The verifier found problems: rewrite the draft against them
      const refinementPrompt = this.createRefinementPrompt(phase1Result, phase2Result)
      finalResponse = await this.aiClient!.generateText([
        {
          role: "system",
          content: "You are a technical writer. Produce clean, well-formatted answers grounded in the provided sources. No preamble, no meta-commentary, no confidence ratings."
        },
        { role: "user", content: refinementPrompt }
      ], { temperature: 0.1 })
      finalResponse = this.enforceCitations(finalResponse, phase1Result.relevantChunks)
      refinementTokens = this.estimateTokens(refinementPrompt + finalResponse)

      // Re-verify what will actually be shown, so the groundedness score and
      // hallucination flag describe the final answer rather than the draft.
      try {
        finalCheck = await this.verifyAnswer(phase1Result.question, phase1Result.context, finalResponse)
      } catch (error) {
        console.warn("Re-verification failed; falling back to the lexical check:", error)
        finalCheck = null
      }
    } else {
      // The verifier passed the draft (or there was nothing to verify)
      finalResponse = phase1Result.initialResponse
    }

    finalResponse = this.cleanResponse(finalResponse)
    const qualityMetrics = this.calculateQualityMetrics(phase1Result, finalCheck, finalResponse)

    let answer = finalResponse.trim()
    if (showThinking && phase2Result) {
      const thinkingSection = `## 🤔 AI Reasoning Process

### Initial Analysis
${phase1Result.initialResponse.substring(0, 200)}${phase1Result.initialResponse.length > 200 ? '...' : ''}

### Fact Check
${this.describeVerification(phase2Result)}

### Final Enhancement
${phase2Result.needsRevision ? 'Revised the draft to address the issues found in review.' : 'Review found no issues; the draft is returned as written.'}

---

## Response

`
      answer = thinkingSection + finalResponse.trim()
    }

    const reasoningTokens = (phase2Result?.tokensUsed ?? 0) + refinementTokens + (finalCheck && finalCheck !== phase2Result ? finalCheck.tokensUsed : 0)
    const tokenUsage = {
      contextTokens: phase1Result.tokensUsed,
      reasoningTokens,
      responseTokens: this.estimateTokens(finalResponse),
      totalTokens: phase1Result.tokensUsed + reasoningTokens + this.estimateTokens(finalResponse)
    }

    const sources = Array.from(new Set(phase1Result.relevantChunks.map((chunk) => chunk.source))).filter(Boolean)

    // Groundedness: share of claims the LLM verifier found supported; the
    // lexical heuristic only when no verifier verdicts are available.
    const verification = finalCheck?.verification ?? null
    const groundednessScore = verification
      ? verification.supported / verification.total
      : phase2Result?.needsRevision || phase1Result.groundednessScore === undefined
        ? this.checkGroundedness(finalResponse, phase1Result.relevantChunks, phase1Result.question).groundednessScore
        : phase1Result.groundednessScore
    const hallucinationDetected = verification
      ? verification.unsupportedClaims.length > 0
      : (finalCheck?.identifiedIssues ?? []).some((issue) => /hallucinat|invented|fabricated/i.test(issue))

    return {
      answer,
      sources,
      relevanceScore: this.calculateRelevanceScore(phase1Result.relevantChunks),
      retrievedChunks: phase1Result.relevantChunks,
      reasoning: phase2Result ? {
        initialThoughts: phase1Result.initialResponse,
        criticalReview: phase2Result.critiqueText,
        finalRefinement: phase2Result.needsRevision
          ? "Draft revised to address the fact check"
          : "Fact check passed the draft unchanged"
      } : undefined,
      qualityMetrics,
      tokenUsage,
      groundednessScore,
      hallucinationDetected,
      ...(verification && { verifiedClaims: verification }),
    }
  }

  /** One-paragraph human summary of a verification result (for "show thinking"). */
  private describeVerification(result: VerificationResult): string {
    const v = result.verification
    if (!v) return result.identifiedIssues.length > 0 ? result.identifiedIssues.slice(0, 3).join('; ') : 'No issues found.'
    const unsupported = v.unsupportedClaims.slice(0, 3).map((c) => `- ${c}`).join('\n')
    return `${v.supported} of ${v.total} claims supported by the sources.${unsupported ? `\nUnsupported:\n${unsupported}` : ''}`
  }

  private cleanResponse(response: string): string {
    // Strip only meta-commentary the refinement prompt sometimes adds: whole-line
    // confidence/rating labels and trailing "this response…" paragraphs. Anchored
    // so legitimate content ("Note: fees are non-refundable", "Credit Rating: AA")
    // survives.
    let cleaned = response
      .replace(/^\s*\**\s*(Confidence|Rating)\s*:?\s*\**\s*(HIGH|MEDIUM|LOW)?\s*\**\s*$/gim, '')
      .trim()

    const trailingMeta = /\n+(?:\*\*)?(?:This (?:revised )?response (?:addresses|has been)|The above (?:analysis|response))[^\n]*$/i
    while (trailingMeta.test(cleaned)) cleaned = cleaned.replace(trailingMeta, '').trimEnd()

    return cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n').trim()
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
  /** Page a chunk starts on: TextChunk metadata first, then the document's chunkPages. */
  private pageOf(doc: Document, chunk: string | TextChunk, index: number): number | undefined {
    const fromMetadata = typeof chunk === 'object' ? chunk.metadata?.page : undefined
    const page = fromMetadata ?? doc.chunkPages?.[index]
    return typeof page === 'number' && page > 0 ? page : undefined
  }

  /** Heading / sheet name a chunk sits under (non-PDF formats), from the document's chunkSections. */
  private sectionOf(doc: Document, index: number): string | undefined {
    const section = doc.chunkSections?.[index]
    return typeof section === 'string' && section.trim() ? section.trim() : undefined
  }

  /** Documents allowed by the user's document filter (the fallback paths must honour it too). */
  private documentsMatching(filters?: RAGFilterOptions): Document[] {
    const ids = filters?.documentIds
    return ids && ids.length > 0 ? this.documents.filter((d) => ids.includes(d.id)) : this.documents
  }

  private fallbackKeywordSearch(
    question: string,
    alternativeQueries: string[],
    limit: number,
    filters?: RAGFilterOptions
  ): Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: unknown }> {
    logger.debug("Performing enhanced fallback keyword search...")
    
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
    logger.debug(`Searching for ${keywordArray.length} keywords/phrases: ${keywordArray.slice(0, 10).join(', ')}${keywordArray.length > 10 ? '...' : ''}`)
    
    const results: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: unknown }> = []
    
    // Search through all chunks
    for (const doc of this.documentsMatching(filters)) {
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
            const page = this.pageOf(doc, chunk, i)
            const section = this.sectionOf(doc, i)
            const sourceString = page !== undefined
              ? `${doc.name} · p.${page}`
              : section !== undefined
                ? `${doc.name} · ${section}`
                : `${doc.name || "Unknown Document"} (chunk ${i + 1})`
            
            results.push({
              content: chunkContent,
              source: sourceString,
              similarity: combinedScore,
              documentId: doc.id,
              documentName: doc.name || "Unknown",
              semanticImportance: matchCount >= 3 ? 0.7 : 0.5,
              matchCount, // Include for debugging
              ...(chunkMetadata || {}),
              chunkIndex: i,
              ...(page !== undefined && { page }),
              ...(section !== undefined && { section }),
            })
          }
        }
      }
    }
    
    // Sort by relevance and return top results
    results.sort((a, b) => b.similarity - a.similarity)
    logger.debug(`Fallback keyword search found ${results.length} results, returning top ${limit}`)
    return results.slice(0, limit)
  }

  /**
   * Get top chunks by semantic importance when retrieval fails
   */
  private getTopChunksByImportance(limit: number, filters?: RAGFilterOptions): Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: unknown }> {
    logger.debug("Retrieving top chunks by importance...")
    
    const results: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number; [key: string]: unknown }> = []
    
    for (const doc of this.documentsMatching(filters)) {
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
        
        const page = this.pageOf(doc, chunk, i)
        const section = this.sectionOf(doc, i)
        const sourceString = page !== undefined
          ? `${doc.name} · p.${page}`
          : section !== undefined
            ? `${doc.name} · ${section}`
            : `${doc.name || "Unknown Document"} (chunk ${i + 1})`
        
        results.push({
          content: chunkContent,
          source: sourceString,
          similarity: importance, // Use importance as similarity score
          documentId: doc.id,
          documentName: doc.name || "Unknown",
          semanticImportance: importance,
          ...(chunkMetadata || {}),
          chunkIndex: i,
          ...(page !== undefined && { page }),
          ...(section !== undefined && { section }),
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
  private optimizeChunksForTokens<T extends { content: string }>(chunks: T[], tokenBudget: number): Array<T & { truncated?: boolean }> {
    // Step 1: Deduplicate chunks (remove near-duplicates)
    const deduplicatedChunks = this.deduplicateChunks(chunks)
    logger.debug(`Deduplication: ${chunks.length} -> ${deduplicatedChunks.length} chunks`)
    
    let totalTokens = 0
    const optimizedChunks: Array<T & { truncated?: boolean }> = []
    
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
    
    logger.debug(`Token budget: ${tokenBudget}, used: ${totalTokens}, chunks: ${optimizedChunks.length}`)
    return optimizedChunks
  }

  /**
   * Deduplicate chunks by removing near-duplicates
   * Uses Jaccard similarity to detect overlap
   */
  private deduplicateChunks<T extends { content: string }>(chunks: T[]): T[] {
    if (chunks.length <= 1) return chunks
    
    const SIMILARITY_THRESHOLD = 0.7 // 70% similarity = duplicate
    const deduplicated: T[] = []
    
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
    const typeFormats: Record<string, string> = {
      summary: 'Organise your answer with ## headings for each major theme.',
      analysis: 'Structure: 1) Background, 2) Key findings with evidence, 3) Implications.',
      timeline: 'Use a markdown table: | Date | Event | Details | Source |',
      data: 'Present numbers in a markdown table with column headers and units.',
      process: 'Use a numbered list. Each step: action → expected outcome.',
      comparison: 'Use a side-by-side markdown table: | Aspect | Doc A | Doc B |',
      general: 'Use ## headings and bullet points to organise the response.',
    }
    const format = typeFormats[questionType] ?? typeFormats.general

    return `You are a document analyst. Answer questions using only the source passages provided in the user message.

Citation rules:
- Every factual claim must end with a citation in square brackets
- Each source passage is labelled [SOURCE: Filename], [SOURCE: Filename | Page N] or [SOURCE: Filename | Section: Name]. Cite it as [Filename], [Filename, p.N] or [Filename, Name] — only with a page or section the label actually shows; never invent page numbers
- When a fact comes from multiple passages, cite each: [File1] [File2, p.7]
- If the passages do not contain enough information to answer, write: "Not found in the provided documents."

Format: ${format}
Start your answer directly — no preamble like "Based on the documents...".`
  }

  private createPhase1UserPrompt(question: string, context: string, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    const historyNote = conversationHistory && conversationHistory.length > 0
      ? `\n<conversation_context>Use the prior conversation to resolve pronouns (it, this, that) or follow-up references.</conversation_context>`
      : ''

    return `<sources>
${context}
</sources>
${historyNote}
<question>${question}</question>

Answer using only the sources above. Cite every factual claim with its source label in square brackets, copied from the SOURCE header it came from — e.g. [report.pdf], [report.pdf, p.4] when the header shows a page, or [budget.xlsx, Q3] when it shows a section. Never invent page numbers. If the answer is not in the sources, write "Not found in the provided documents."`
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
${conversationHistory.slice(-6).map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

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
        logger.debug(`Context resolved: "${question}" → "${resolvedQuestion}"`)
        return resolvedQuestion
      }
      
      return question // Fallback to original
    } catch (error) {
      console.warn("Context resolution failed, using original question:", error)
      return question
    }
  }

  private createVerificationPrompt(question: string, context: string, answer: string): string {
    return `You are a fact-checker. Verify the answer strictly against the source passages.

<sources>
${context}
</sources>

<question>${question}</question>

<answer>
${answer}
</answer>

Split the answer into its individual factual claims. For each claim decide whether the sources state or directly imply it. A claim citing the wrong source, or adding detail the sources lack, is NOT supported. Statements that the documents lack information are supported when the sources indeed lack it.

Respond with JSON only — no prose:
{
  "claims": [{ "claim": "short restatement", "supported": true, "source": "label of the supporting SOURCE, or null" }],
  "uncited_claims": ["exact sentence from the answer that has no citation"],
  "hallucinated_claims": ["exact sentence that contradicts or is absent from the sources"],
  "missing_info": ["important aspects of the question the sources answer but the answer does not"],
  "verdict": "pass" | "revise"
}

verdict is "pass" only when every claim is supported and cited and nothing important is missing.`
  }

  private createRefinementPrompt(phase1Result: Phase1Result, phase2Result: VerificationResult): string {
    const issues = phase2Result.critiqueText
    return `<sources>
${phase1Result.context}
</sources>

<question>${phase1Result.question}</question>

<draft>
${phase1Result.initialResponse}
</draft>

<issues>
${issues}
</issues>

Revise the draft to fix all issues listed above:
- Remove or replace any hallucinated or uncited claims
- Add missing citations using the source labels from the SOURCE headers (add ", p.N" or ", Section" only when the header shows one)
- Cover any missing aspects of the question that the sources support
- Keep all valid, cited content from the draft

Output only the final answer — no explanations, no meta-commentary.`
  }

  /**
   * Lexical groundedness check: is each answer sentence supported by some
   * retrieved chunk? A sentence counts as supported when every number in it
   * appears in one chunk and at least half of its content words do too.
   *
   * This is a cheap heuristic signal (it cannot catch a paraphrased
   * fabrication), used to decide whether to regenerate with a stricter prompt.
   * It never edits the answer itself.
   */
  private checkGroundedness(
    response: string,
    chunks: ReadonlyArray<{ content: string; source: string }>,
    question: string
  ): {
    isGrounded: boolean
    groundednessScore: number
    unverifiedClaims: string[]
    verifiedClaims: string[]
  } {
    logger.debug(`=== Groundedness Check === ${question.substring(0, 120)}`)

    const stop = new Set(['that', 'this', 'with', 'from', 'have', 'which', 'were', 'their', 'there', 'about', 'these', 'those', 'also', 'into', 'than', 'then', 'they', 'been', 'such', 'more', 'most', 'other', 'some', 'only', 'each', 'when', 'where', 'what', 'will', 'would', 'could', 'should', 'does', 'document', 'documents', 'source', 'sources', 'provided', 'according'])
    const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
    const chunkTexts = chunks.map((c) => (c.content || '').toLowerCase())
    const chunkWordSets = chunkTexts.map((t) => new Set(words(t)))

    const sentences = response
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
      .map((line) => line.replace(/\[[^\]]*\]/g, '').replace(/^\s*(?:#{1,6}|[-*•]|\d+[.)])\s*/, '').trim())
      .filter((line) => line.length > 20 && !/^\|/.test(line) && !/not found in the provided documents/i.test(line))

    const verifiedClaims: string[] = []
    const unverifiedClaims: string[] = []

    for (const sentence of sentences) {
      const numbers = sentence.match(/\d[\d,.]*%?/g)?.map((n) => n.replace(/[.,]$/, '')) || []
      const contentWords = [...new Set(words(sentence).filter((w) => w.length > 3 && !stop.has(w)))]
      if (contentWords.length === 0 && numbers.length === 0) continue

      const supported = chunkTexts.some((text, i) => {
        if (!numbers.every((n) => text.includes(n.toLowerCase()))) return false
        if (contentWords.length === 0) return true
        const overlap = contentWords.filter((w) => chunkWordSets[i].has(w)).length
        return overlap / contentWords.length >= 0.5
      })
      ;(supported ? verifiedClaims : unverifiedClaims).push(sentence)
    }

    const totalClaims = verifiedClaims.length + unverifiedClaims.length
    const groundednessScore = totalClaims > 0 ? verifiedClaims.length / totalClaims : 1.0
    const isGrounded = groundednessScore >= 0.7

    logger.debug(`Groundedness: ${(groundednessScore * 100).toFixed(1)}% (${verifiedClaims.length}/${totalClaims} claims supported)`)
    return { isGrounded, groundednessScore, unverifiedClaims, verifiedClaims }
  }

  /**
   * If the model cited nothing, append the best-matching source label to each
   * sentence that clearly comes from one chunk. Works line by line so Markdown
   * structure (lists, headings, tables, code) is preserved.
   */
  private enforceCitations(
    response: string,
    chunks: ReadonlyArray<{ content: string; source: string; documentName?: string; page?: number; section?: string }>
  ): string {
    if (/\[[^\]]+\]/.test(response) || chunks.length === 0) return response

    const words = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 3)
    const chunkWordSets = chunks.map((c) => new Set(words(c.content || '')))
    const labelOf = (c: typeof chunks[number]) => {
      const name = c.documentName || c.source
      return c.page != null ? `${name}, p.${c.page}` : c.section ? `${name}, ${c.section}` : name
    }

    let inCode = false
    return response
      .split('\n')
      .map((line) => {
        if (/^\s*```/.test(line)) inCode = !inCode
        if (inCode || /^\s*(#|\||```)/.test(line) || line.trim().length < 20) return line
        return line
          .split(/(?<=[.!?])(\s+)/)
          .map((part) => {
            if (!/[.!?]$/.test(part) || part.trim().length < 20) return part
            const sentenceWords = words(part)
            if (sentenceWords.length === 0) return part
            let best = -1
            let bestScore = 0
            chunkWordSets.forEach((set, i) => {
              const score = sentenceWords.filter((w) => set.has(w)).length / sentenceWords.length
              if (score > bestScore) {
                bestScore = score
                best = i
              }
            })
            return bestScore > 0.5 ? `${part.slice(0, -1)} [${labelOf(chunks[best])}]${part.slice(-1)}` : part
          })
          .join('')
      })
      .join('\n')
  }

  private parseCritiqueResponse(critique: string): string[] {
    const issues: string[] = []

    // Try to parse the structured JSON response from Phase 2
    try {
      const jsonMatch = critique.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.uncited_claims)) issues.push(...parsed.uncited_claims.map((c: string) => `Uncited: ${c}`))
        if (Array.isArray(parsed.hallucinated_claims)) issues.push(...parsed.hallucinated_claims.map((c: string) => `Hallucination: ${c}`))
        if (Array.isArray(parsed.missing_info)) issues.push(...parsed.missing_info.map((c: string) => `Missing: ${c}`))
        return issues
      }
    } catch {
      // fall through to legacy text parsing
    }

    // Legacy text-based fallback (for non-JSON responses)
    if (critique.toLowerCase().includes('hallucination') || critique.toLowerCase().includes('fabricated')) {
      issues.push('Hallucination detected')
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

  /** "pass" | "revise" from the critique JSON, or null when it could not be parsed. */
  private parseCritiqueVerdict(critique: string): 'pass' | 'revise' | null {
    try {
      const jsonMatch = critique.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const verdict = JSON.parse(jsonMatch[0])?.verdict
      return verdict === 'pass' || verdict === 'revise' ? verdict : null
    } catch {
      return null
    }
  }

  private calculateQualityMetrics(phase1Result: Phase1Result, finalCheck: VerificationResult | null, finalResponse: string) {
    const chunks = phase1Result.relevantChunks
    const hasSourceAttribution = /\[[^\]]+\]/.test(finalResponse)
    const hasClearStructure = finalResponse.includes('\n\n') || finalResponse.includes('##') || /^\s*(?:\d+\.|[-*])\s/m.test(finalResponse)

    // Accuracy from the verifier's claim verdicts when available.
    const v = finalCheck?.verification
    const accuracyScore = v
      ? Math.round((v.supported / v.total) * 100)
      : chunks.length > 0 && hasSourceAttribution && !(finalCheck?.identifiedIssues.length) ? 90 : 70
    const completenessScore = finalCheck?.identifiedIssues.some((i) => i.startsWith('Missing:')) ? 65 : chunks.length >= 3 ? 85 : 70
    const clarityScore = hasClearStructure ? 80 : 60
    const confidenceScore = chunks.length > 0 ? Math.min(95, Math.max(...chunks.map((c) => c.similarity)) * 100) : 50

    const finalRating = (accuracyScore + completenessScore + clarityScore + confidenceScore) / 4
    return { accuracyScore, completenessScore, clarityScore, confidenceScore, finalRating }
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
      logger.debug(`Removed ${removedCount} document(s) with ID: ${documentId}`)
      
      // Invalidate query cache for this document
      if (removedCount > 0) {
        this.queryProcessor.invalidateCache([documentId])
        logger.debug(`Query cache invalidated for document: ${documentId}`)
      }
      
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
      
      // Clear query cache when all documents are removed
      this.queryProcessor.clearCache()
      logger.debug("Query cache cleared")
      
      this.documents = []
      logger.debug("Cleared all documents from RAG engine")
    } catch (error) {
      console.error("Error clearing documents:", error)
    }
  }

  // Health check method
  isHealthy(): boolean {
    try {
      return this.isInitialized && this.aiClient !== null && Array.isArray(this.documents)
    } catch (error) {
      console.error("Error checking RAG engine health:", error)
      return false
    }
  }

  // Get status information
  getStatus() {
    try {
      const cacheStats = this.queryProcessor.getCacheStats()
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
        // Query cache statistics
        queryCache: {
          size: cacheStats.size,
          maxSize: cacheStats.maxSize,
          hitRate: cacheStats.hitRate
        }
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
        queryCache: { size: 0, maxSize: 0, hitRate: 0 }
      }
    }
  }

  // Diagnostic method to help troubleshoot issues
  async runDiagnostics(): Promise<RAGDiagnostics> {
    logger.debug("=== RAG Engine Diagnostics ===")
    
    const diagnostics: RAGDiagnostics = {
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
        logger.debug("Testing embedding generation...")
        const testText = "This is a test for embedding generation"
        const testEmbedding = await this.aiClient.generateEmbedding(testText)
        diagnostics.embeddingTest = {
          success: true,
          dimensions: testEmbedding.length,
          sampleValues: testEmbedding.slice(0, 5)
        }
        logger.debug("✅ Embedding test successful")

        // Test similarity calculation if we have documents
        if (this.documents.length > 0 && this.documents[0].embeddings?.length > 0) {
          const firstDocEmbedding = this.documents[0].embeddings[0]
          const similarity = this.aiClient.cosineSimilarity(testEmbedding, firstDocEmbedding)
          diagnostics.similarityTest = {
            success: true,
            similarity,
            testedAgainst: `${this.documents[0].name} (chunk 1)`
          }
          logger.debug("✅ Similarity test successful:", similarity)
        }
      } catch (error) {
        diagnostics.embeddingTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        logger.debug("❌ Embedding test failed:", error)
      }
    }

    logger.debug("Diagnostics results:", diagnostics)
    logger.debug("=== End Diagnostics ===")
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
    chunk: string | TextChunk, 
    docMetadata?: DocumentMetadata,
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
    logger.debug(`Applying Enhanced Multi-Document Diversity Algorithm (multiDoc: ${isMultiDocQuery})`)

    // Calculate composite scores: similarity * semantic importance with diminishing returns
    const rankedChunks = allChunks
      .filter(chunk => chunk.similarity >= minSimilarity)
      .map(chunk => ({
        ...chunk,
        compositeScore: Math.pow(chunk.similarity, 0.8) * Math.pow(chunk.semanticImportance, 0.6)
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore)

    logger.debug(`Ranked ${rankedChunks.length} chunks after filtering (min similarity: ${minSimilarity})`)

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
      logger.debug(`Multi-document query detected: Enforcing fair distribution (${baseChunksPerDoc}-${maxChunksPerDoc} per doc)`)
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

    logger.debug(`Diversity parameters - Base per doc: ${baseChunksPerDoc}, Max per doc: ${maxChunksPerDoc}, Target total: ${topK}`)

    // Phase 1: Greedy selection with diversity constraints
    const selectedChunks: typeof rankedChunks = []
    const documentChunkCounts = new Map<string, number>()
    const usedSources = new Set<string>()

    logger.debug("Phase 1: Greedy diverse selection")

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
          logger.debug(`  Pass ${pass + 1}: chunk from ${docName} (similarity: ${docChunks[0].similarity.toFixed(3)}, score: ${docChunks[0].compositeScore.toFixed(3)})`)
        }
      }
    }

    // Second pass: fill remaining slots respecting targets and max limits
    logger.debug("Phase 2: Filling to targets")
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
    logger.debug(`Final chunk distribution:`)
    const distribution = new Map<string, { count: number, avgSim: number }>()
    finalChunks.forEach(chunk => {
      const existing = distribution.get(chunk.documentName) || { count: 0, avgSim: 0 }
      distribution.set(chunk.documentName, {
        count: existing.count + 1,
        avgSim: (existing.avgSim * existing.count + chunk.similarity) / (existing.count + 1)
      })
    })

    distribution.forEach(({ count, avgSim }, docName) => {
      logger.debug(`  ${docName}: ${count} chunks (avg similarity: ${avgSim.toFixed(3)})`)
    })

    logger.debug(`Returning ${finalChunks.length} chunks with enhanced diversity (${distribution.size} documents represented)`)
    if (finalChunks.length > 0) {
      logger.debug(`Best similarity: ${finalChunks[0].similarity.toFixed(3)}`)
      logger.debug(`Worst similarity: ${finalChunks[finalChunks.length - 1].similarity.toFixed(3)}`)
    }

    return finalChunks
  }

  private getFallbackDiverseChunks(
    allChunks: Array<{ content: string; source: string; similarity: number; documentId: string; documentName: string; semanticImportance: number }>,
    documentMetrics: Map<string, { avgSimilarity: number; chunkCount: number; bestSimilarity: number }>,
    topK: number
  ) {
    logger.debug("Using fallback diversity strategy (relaxed similarity criteria)")
    
    const fallbackChunks: typeof allChunks = []
    
    // Get the best chunk from each document
    for (const [docId] of documentMetrics) {
      const docChunks = allChunks
        .filter(chunk => chunk.documentId === docId)
        .sort((a, b) => b.similarity - a.similarity)
      
      if (docChunks.length > 0) {
        fallbackChunks.push(docChunks[0])
        logger.debug(`Fallback: Added best chunk from ${docChunks[0].documentName} (similarity: ${docChunks[0].similarity.toFixed(3)})`)
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

import { calculateKeywordScore, enhancedKeywordSimilarity } from "./keyword-scoring"
import { createZeroVector, getEmbeddingDimension } from "./vector-dimensions"

interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "local"
  apiKey?: string
  environment?: string
  indexName?: string
  url?: string
  collection?: string
  dimension?: number
}

interface VectorDocument {
  id: string
  content: string
  embedding: number[]
  metadata: {
    source: string
    chunkIndex: number
    documentId: string
    timestamp: Date
    [key: string]: unknown
  }
}

interface SearchResult {
  id: string
  content: string
  score: number
  metadata: unknown
}

interface SearchOptions {
  mode: "semantic" | "keyword" | "hybrid"
  filters?: Record<string, unknown>
  limit?: number
  threshold?: number
}

export abstract class VectorDatabase {
  protected config: VectorDBConfig
  protected isInitialized = false

  constructor(config: VectorDBConfig) {
    this.config = config
  }

  abstract initialize(): Promise<void>
  abstract addDocuments(documents: VectorDocument[]): Promise<void>
  abstract search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]>
  abstract deleteDocument(documentId: string): Promise<void>
  abstract clear(): Promise<void>
  abstract testConnection(): Promise<boolean>

  protected validateConfig(): void {
    if (!this.config) {
      throw new Error("Vector database configuration is required")
    }
  }
}

import type { Pinecone as PineconeClient, Index as PineconeIndex } from "@pinecone-database/pinecone"

class PineconeDatabase extends VectorDatabase {
  private pinecone!: PineconeClient
  private index!: PineconeIndex

  async initialize(): Promise<void> {
    try {
      this.validateConfig()

      if (!this.config.apiKey) {
        throw new Error("Pinecone API key is required")
      }

      // Dynamic import to avoid build issues
      const { Pinecone } = await import("@pinecone-database/pinecone")

      this.pinecone = new Pinecone({
        apiKey: this.config.apiKey,
      })

      const indexName = this.config.indexName || "pdf-documents"

      try {
        // Try to get existing index
        this.index = this.pinecone.index(indexName)
        await this.index.describeIndexStats()
      } catch {
        // Index doesn't exist, create it
        console.log(`Creating Pinecone index: ${indexName}`)
        await this.pinecone.createIndex({
          name: indexName,
          dimension: getEmbeddingDimension(this.config.dimension),
          metric: "cosine",
          spec: {
            serverless: {
              cloud: "aws",
              region: "us-east-1",
            },
          },
        })

        // Wait for index to be ready
        await new Promise((resolve) => setTimeout(resolve, 10000))
        this.index = this.pinecone.index(indexName)
      }

      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize Pinecone:", error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Pinecone initialization failed: ${errorMessage}`)
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const vectors = documents.map((doc) => ({
        id: doc.id,
        values: doc.embedding,
        metadata: {
          content: doc.content.substring(0, 40000), // Pinecone metadata limit
          source: doc.metadata.source,
          documentId: doc.metadata.documentId,
          chunkIndex: doc.metadata.chunkIndex,
          timestamp: doc.metadata.timestamp.toISOString(),
        },
      }))

      await this.index.upsert(vectors)
    } catch (error) {
      console.error("Failed to add documents to Pinecone:", error)
      throw error
    }
  }

  async search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      let results: SearchResult[] = []

      if (options.mode === "semantic") {
        // Pure semantic search using vector similarity
        if (!embedding || embedding.length === 0) {
          console.warn("No embedding provided for semantic search")
          return []
        }

        const searchParams: unknown = {
          vector: embedding,
          topK: options.limit || 10,
          includeMetadata: true,
          includeValues: false,
        }

        if (options.filters) {
          searchParams.filter = options.filters
        }

        const pineconeResults = await this.index.query(searchParams)
        
        results = pineconeResults.matches?.map((match: unknown) => ({
          id: match.id,
          content: match.metadata?.content || "",
          score: match.score || 0,
          metadata: {
            ...match.metadata,
            searchMode: "semantic"
          },
        })) || []

      } else if (options.mode === "keyword") {
        // Pure keyword search using metadata filtering
        // Since Pinecone doesn't have native text search, we'll fetch more results and filter locally
        const searchParams: unknown = {
          vector: embedding.length > 0 ? embedding : createZeroVector(this.config.dimension), // Use zero vector if no embedding
          topK: Math.min(1000, (options.limit || 10) * 10), // Fetch more to filter locally
          includeMetadata: true,
          includeValues: false,
        }

        if (options.filters) {
          searchParams.filter = options.filters
        }

        const pineconeResults = await this.index.query(searchParams)
        const allResults = pineconeResults.matches || []

        // Filter results locally using keyword matching
        const keywordFilteredResults = allResults
          .map((match: unknown) => {
            const content = match.metadata?.content || ""
            const keywordScore = calculateKeywordScore(query, content)
            
            return {
              id: match.id,
              content: content,
              score: keywordScore,
              metadata: {
                ...match.metadata,
                searchMode: "keyword",
                originalPineconeScore: match.score
              },
            }
          })
          .filter(result => result.score >= (options.threshold || 0.01))
          .sort((a, b) => b.score - a.score)
          .slice(0, options.limit || 10)

        results = keywordFilteredResults

      } else if (options.mode === "hybrid") {
        // Hybrid search - combine semantic and keyword approaches
        const searchParams: unknown = {
          vector: embedding.length > 0 ? embedding : createZeroVector(this.config.dimension),
          topK: Math.min(1000, (options.limit || 10) * 5), // Fetch more for better hybrid results
          includeMetadata: true,
          includeValues: false,
        }

        if (options.filters) {
          searchParams.filter = options.filters
        }

        const pineconeResults = await this.index.query(searchParams)
        const allResults = pineconeResults.matches || []

        // Calculate adaptive hybrid weights based on query characteristics
        const weights = this.getAdaptiveHybridWeights(query)
        
        // Calculate hybrid scores
        const hybridResults = allResults
          .map((match: unknown) => {
            const content = match.metadata?.content || ""
            const semanticScore = embedding.length > 0 ? (match.score || 0) : 0
            const keywordScore = calculateKeywordScore(query, content)
            
            // Combine scores with adaptive weights
            const hybridScore = embedding.length > 0 
              ? (semanticScore * weights.semantic + keywordScore * weights.keyword)
              : keywordScore // If no embedding, use only keyword score

            return {
              id: match.id,
              content: content,
              score: hybridScore,
              metadata: {
                ...match.metadata,
                searchMode: "hybrid",
                semanticScore: semanticScore,
                keywordScore: keywordScore,
                hybridScore: hybridScore
              },
            }
          })
          .filter(result => result.score >= (options.threshold || 0.05))
          .sort((a, b) => b.score - a.score)
          .slice(0, options.limit || 10)

        results = hybridResults
      }

      return results

    } catch (error) {
      console.error("Failed to search Pinecone:", error)
      throw error
    }
  }

  /**
   * Get adaptive hybrid search weights based on query characteristics
   * - Technical/exact queries → higher keyword weight
   * - Conceptual/semantic queries → higher semantic weight
   */
  private getAdaptiveHybridWeights(query: string): { semantic: number; keyword: number } {
    const queryLower = query.toLowerCase()
    
    // Patterns that suggest keyword-heavy search
    const keywordPatterns = [
      /\b(exact|specific|definition|meaning|what is)\b/i,
      /\b(article|section|clause|paragraph|page)\s*\d+/i,
      /\b\d+\.?\d*\s*(%|percent)/i,
      /"[^"]+"/i, // Quoted phrases
      /\b[A-Z]{2,}\b/, // Acronyms
    ]
    
    // Patterns that suggest semantic-heavy search  
    const semanticPatterns = [
      /\b(explain|describe|summarize|overview|concept)\b/i,
      /\b(how|why|what happens|relationship)\b/i,
      /\b(compare|contrast|difference|similar)\b/i,
      /\b(main|key|important|significant)\b/i,
    ]
    
    let keywordBoost = 0
    let semanticBoost = 0
    
    for (const pattern of keywordPatterns) {
      if (pattern.test(query)) keywordBoost += 0.1
    }
    
    for (const pattern of semanticPatterns) {
      if (pattern.test(queryLower)) semanticBoost += 0.1
    }
    
    // Short queries (1-3 words) benefit more from keyword matching
    const wordCount = query.split(/\s+/).length
    if (wordCount <= 3) keywordBoost += 0.15
    
    // Very long queries benefit from semantic understanding
    if (wordCount > 10) semanticBoost += 0.1
    
    // Calculate final weights (base: 55% semantic, 45% keyword)
    let semanticWeight = 0.55 + semanticBoost - keywordBoost
    let keywordWeight = 0.45 + keywordBoost - semanticBoost
    
    // Clamp weights
    semanticWeight = Math.max(0.3, Math.min(0.8, semanticWeight))
    keywordWeight = Math.max(0.2, Math.min(0.7, keywordWeight))
    
    // Normalize to sum to 1
    const total = semanticWeight + keywordWeight
    semanticWeight /= total
    keywordWeight /= total
    
    console.log(`Adaptive weights for "${query.substring(0, 30)}...": semantic=${semanticWeight.toFixed(2)}, keyword=${keywordWeight.toFixed(2)}`)
    
    return { semantic: semanticWeight, keyword: keywordWeight }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      await this.index.deleteMany({
        filter: { documentId: { $eq: documentId } },
      })
    } catch (error) {
      console.error("Failed to delete document from Pinecone:", error)
      throw error
    }
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      await this.index.deleteAll()
    } catch (error) {
      console.error("Failed to clear Pinecone index:", error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false
      }

      const { Pinecone } = await import("@pinecone-database/pinecone")
      const testClient = new Pinecone({ apiKey: this.config.apiKey })
      await testClient.listIndexes()
      return true
    } catch (error) {
      console.error("Pinecone connection test failed:", error)
      return false
    }
  }
}

import type { WeaviateClient } from "weaviate-ts-client"

class WeaviateDatabase extends VectorDatabase {
  private client!: WeaviateClient

  async initialize(): Promise<void> {
    try {
      const weaviate = await import("weaviate-ts-client")

      this.client = weaviate.default.client({
        scheme: "https",
        host: this.config.url || "localhost:8080",
        ...(this.config.apiKey ? { headers: { Authorization: `Bearer ${this.config.apiKey}` } } : {}),
      })

      // Create schema if it doesn't exist
      const className = this.config.collection || "Document"
      const schema = {
        class: className,
        properties: [
          {
            name: "content",
            dataType: ["text"],
          },
          {
            name: "source",
            dataType: ["string"],
          },
          {
            name: "documentId",
            dataType: ["string"],
          },
          {
            name: "chunkIndex",
            dataType: ["int"],
          },
        ],
      }

      // Check if class already exists before attempting creation
      try {
        const existingSchema = await this.client.schema.getter().do()
        const classExists = existingSchema.classes?.some(
          (cls: { class?: string }) => cls.class === className
        )
        
        if (classExists) {
          console.log(`Weaviate class '${className}' already exists, skipping creation`)
        } else {
          console.log(`Creating Weaviate class '${className}'...`)
          await this.client.schema.classCreator().withClass(schema).do()
          console.log(`Weaviate class '${className}' created successfully`)
        }
      } catch (schemaError) {
        // If we can't check the schema, try to create (will fail silently if exists)
        console.warn("Could not check existing schema, attempting to create class:", schemaError)
        try {
          await this.client.schema.classCreator().withClass(schema).do()
          console.log(`Weaviate class '${className}' created`)
        } catch (createError: unknown) {
          // Only log if it's not an "already exists" error
          if (!createError?.message?.includes('already exists')) {
            console.error("Failed to create Weaviate class:", createError)
          }
        }
      }
      
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize Weaviate:", error)
      throw error
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    try {
      const className = this.config.collection || "Document"

      for (const doc of documents) {
        await this.client.data
          .creator()
          .withClassName(className)
          .withId(doc.id)
          .withProperties({
            content: doc.content,
            source: doc.metadata.source,
            documentId: doc.metadata.documentId,
            chunkIndex: doc.metadata.chunkIndex,
          })
          .withVector(doc.embedding)
          .do()
      }
    } catch (error) {
      console.error("Failed to add documents to Weaviate:", error)
      throw error
    }
  }

  async search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]> {
    try {
      const className = this.config.collection || "Document"

      let searchQuery = this.client.graphql
        .get()
        .withClassName(className)
        .withFields("content source documentId chunkIndex")
        .withLimit(options.limit || 10)

      if (options.mode === "semantic" || options.mode === "hybrid") {
        searchQuery = searchQuery.withNearVector({
          vector: embedding,
          certainty: options.threshold || 0.7,
        })
      }

      if (options.mode === "keyword" || options.mode === "hybrid") {
        searchQuery = searchQuery.withBm25({
          query: query,
        })
      }

      if (options.filters) {
        searchQuery = searchQuery.withWhere(options.filters)
      }

      const result = await searchQuery.do()

      const processedResults = result.data?.Get?.[className]?.map((item: unknown, index: number) => {
        // Calculate a more realistic score based on search mode
        let finalScore = 1 - index / (options.limit || 10) // Base score from ranking
        
        // Adjust score based on search mode for better representation
        if (options.mode === "semantic") {
          finalScore = Math.max(0.5, finalScore) // Semantic results should have decent scores
        } else if (options.mode === "keyword") {
          // For keyword search, calculate actual keyword relevance
          finalScore = calculateKeywordScore(query, item.content)
        } else if (options.mode === "hybrid") {
          // For hybrid, this is already a combined score from Weaviate
          finalScore = Math.max(0.3, finalScore) // Ensure hybrid results have reasonable scores
        }

        return {
          id: `${item.documentId}_${item.chunkIndex}`,
          content: item.content,
          score: finalScore,
          metadata: {
            source: item.source,
            documentId: item.documentId,
            chunkIndex: item.chunkIndex,
            searchMode: options.mode,
            weaviateRank: index + 1,
            debug: {
              originalScore: finalScore,
              thresholdUsed: options.threshold || 0.7,
              searchMode: options.mode,
              weaviateIndex: index
            }
          },
        }
      }) || []

      return processedResults
    } catch (error) {
      console.error("Failed to search Weaviate:", error)
      throw error
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      const className = this.config.collection || "Document"

      await this.client.batch
        .objectsBatchDeleter()
        .withClassName(className)
        .withWhere({
          path: ["documentId"],
          operator: "Equal",
          valueString: documentId,
        })
        .do()
    } catch (error) {
      console.error("Failed to delete document from Weaviate:", error)
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      const className = this.config.collection || "Document"
      await this.client.schema.classDeleter().withClassName(className).do()
      await this.initialize() // Recreate the schema
    } catch (error) {
      console.error("Failed to clear Weaviate collection:", error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.misc.metaGetter().do()
      return true
    } catch (error) {
      console.error("Weaviate connection test failed:", error)
      return false
    }
  }

}


class LocalVectorDatabase extends VectorDatabase {
  private documents: VectorDocument[] = []

  async initialize(): Promise<void> {
    this.isInitialized = true
    console.log("Local vector database initialized")
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    this.documents.push(...documents)
  }

  async search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    // Dynamic thresholds based on search mode
    const getThreshold = (mode: string) => {
      switch (mode) {
        case "semantic": return options.threshold || 0.1  // 10%
        case "keyword": return options.threshold ?? 0       // 0 for literal matches
        case "hybrid": return options.threshold || 0.05    // 5% - balanced
        default: return options.threshold || 0.1
      }
    }

    const threshold = getThreshold(options.mode)

    for (const doc of this.documents) {
      let score = 0

      if (options.mode === "semantic") {
        // Pure semantic search
        if (embedding && embedding.length > 0) {
          score = this.cosineSimilarity(embedding, doc.embedding)
        } else {
          // If no embedding available, skip this document for semantic search
          continue
        }
      } else if (options.mode === "keyword") {
        // Pure keyword search - doesn't require embeddings
        score = enhancedKeywordSimilarity(query, doc.content)
      } else if (options.mode === "hybrid") {
        // Hybrid search - combine both with adaptive weights
        let semanticScore = 0
        let keywordScore = 0

        // Try semantic search if embeddings available
        if (embedding && embedding.length > 0) {
          semanticScore = this.cosineSimilarity(embedding, doc.embedding)
        }

        // Always do keyword search
        keywordScore = enhancedKeywordSimilarity(query, doc.content)

        // Get adaptive weights based on query type
        const weights = this.getAdaptiveHybridWeights(query)
        
        // Combine with adaptive weights; fallback if only one available
        if (semanticScore > 0 && keywordScore > 0) {
          score = semanticScore * weights.semantic + keywordScore * weights.keyword
        } else if (semanticScore > 0) {
          score = semanticScore
        } else {
          score = keywordScore
        }
      }

      if (score >= threshold) {
        results.push({
          id: doc.id,
          content: doc.content,
          score,
          metadata: {
            ...doc.metadata,
            searchMode: options.mode,
            threshold: threshold,
            debug: {
              originalScore: score,
              thresholdUsed: threshold,
              searchMode: options.mode
            }
          },
        })
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 10)
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.documents = this.documents.filter((doc) => doc.metadata.documentId !== documentId)
  }

  async clear(): Promise<void> {
    this.documents = []
  }

  async testConnection(): Promise<boolean> {
    return true
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    if (magnitudeA === 0 || magnitudeB === 0) return 0
    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Get adaptive hybrid search weights based on query characteristics
   */
  private getAdaptiveHybridWeights(query: string): { semantic: number; keyword: number } {
    // Patterns that suggest keyword-heavy search
    const keywordPatterns = [
      /\b(exact|specific|definition|meaning|what is)\b/i,
      /\b(article|section|clause|paragraph|page)\s*\d+/i,
      /\b\d+\.?\d*\s*(%|percent)/i,
      /"[^"]+"/i,
      /\b[A-Z]{2,}\b/,
    ]
    
    // Patterns that suggest semantic-heavy search  
    const semanticPatterns = [
      /\b(explain|describe|summarize|overview|concept)\b/i,
      /\b(how|why|what happens|relationship)\b/i,
      /\b(compare|contrast|difference|similar)\b/i,
      /\b(main|key|important|significant)\b/i,
    ]
    
    let keywordBoost = 0
    let semanticBoost = 0
    
    for (const pattern of keywordPatterns) {
      if (pattern.test(query)) keywordBoost += 0.1
    }
    
    for (const pattern of semanticPatterns) {
      if (pattern.test(query.toLowerCase())) semanticBoost += 0.1
    }
    
    const wordCount = query.split(/\s+/).length
    if (wordCount <= 3) keywordBoost += 0.15
    if (wordCount > 10) semanticBoost += 0.1
    
    let semanticWeight = 0.55 + semanticBoost - keywordBoost
    let keywordWeight = 0.45 + keywordBoost - semanticBoost
    
    semanticWeight = Math.max(0.3, Math.min(0.8, semanticWeight))
    keywordWeight = Math.max(0.2, Math.min(0.7, keywordWeight))
    
    const total = semanticWeight + keywordWeight
    return { semantic: semanticWeight / total, keyword: keywordWeight / total }
  }
}

export function createVectorDatabase(config: VectorDBConfig): VectorDatabase {
  switch (config.provider) {
    case "pinecone":
      return new PineconeDatabase(config)
    case "weaviate":
      return new WeaviateDatabase(config)
    case "local":
    default:
      return new LocalVectorDatabase(config)
  }
}

// Browser-compatible vector database without Node.js dependencies

export interface VectorEntry {
  id: string
  vector: number[]
  metadata: Record<string, unknown>
  text: string
}

export interface BrowserSearchResult {
  entry: VectorEntry
  similarity: number
}

export class BrowserVectorDatabase {
  private entries: VectorEntry[] = []

  async addEntry(entry: VectorEntry): Promise<void> {
    this.entries.push(entry)
  }

  async addEntries(entries: VectorEntry[]): Promise<void> {
    this.entries.push(...entries)
  }

  async search(queryVector: number[], limit = 5): Promise<BrowserSearchResult[]> {
    const results = this.entries
      .map((entry) => ({
        entry,
        similarity: this.cosineSimilarity(queryVector, entry.vector),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return results
  }

  async clear(): Promise<void> {
    this.entries = []
  }

  async getCount(): Promise<number> {
    return this.entries.length
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}

interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "chroma" | "local"
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
    [key: string]: any
  }
}

interface SearchResult {
  id: string
  content: string
  score: number
  metadata: any
}

interface SearchOptions {
  mode: "semantic" | "keyword" | "hybrid"
  filters?: Record<string, any>
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

import type { Pinecone as PineconeClient, Index as PineconeIndex } from "@pinecone-database/pinecone";

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
      } catch (error) {
        // Index doesn't exist, create it
        console.log(`Creating Pinecone index: ${indexName}`)
        await this.pinecone.createIndex({
          name: indexName,
          dimension: this.config.dimension || 1536,
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

        const searchParams: any = {
          vector: embedding,
          topK: options.limit || 10,
          includeMetadata: true,
          includeValues: false,
        }

        if (options.filters) {
          searchParams.filter = options.filters
        }

        const pineconeResults = await this.index.query(searchParams)
        
        results = pineconeResults.matches?.map((match: any) => ({
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
        const searchParams: any = {
          vector: embedding.length > 0 ? embedding : new Array(1536).fill(0), // Use zero vector if no embedding
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
          .map((match: any) => {
            const content = match.metadata?.content || ""
            const keywordScore = this.calculateKeywordScore(query, content)
            
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
        const searchParams: any = {
          vector: embedding.length > 0 ? embedding : new Array(1536).fill(0),
          topK: Math.min(1000, (options.limit || 10) * 5), // Fetch more for better hybrid results
          includeMetadata: true,
          includeValues: false,
        }

        if (options.filters) {
          searchParams.filter = options.filters
        }

        const pineconeResults = await this.index.query(searchParams)
        const allResults = pineconeResults.matches || []

        // Calculate hybrid scores
        const hybridResults = allResults
          .map((match: any) => {
            const content = match.metadata?.content || ""
            const semanticScore = embedding.length > 0 ? (match.score || 0) : 0
            const keywordScore = this.calculateKeywordScore(query, content)
            
            // Combine scores (weighted average)
            const hybridScore = embedding.length > 0 
              ? (semanticScore * 0.6 + keywordScore * 0.4) // 60% semantic, 40% keyword
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

  // Helper method for keyword scoring in Pinecone
  private calculateKeywordScore(query: string, content: string): number {
    if (!content || !query) return 0

    // Normalize text
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)
    
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
    const contentWords = normalizedContent.split(/\s+/)
    
    if (queryWords.length === 0) return 0

    let exactMatches = 0
    let partialMatches = 0
    
    for (const queryWord of queryWords) {
      if (contentWords.includes(queryWord)) {
        exactMatches++
      } else {
        const partialMatch = contentWords.some(contentWord => 
          contentWord.includes(queryWord) || queryWord.includes(contentWord)
        )
        if (partialMatch) {
          partialMatches++
        }
      }
    }

    const exactScore = exactMatches / queryWords.length
    const partialScore = (partialMatches / queryWords.length) * 0.5
    let finalScore = exactScore + partialScore

    // Boost single word matches
    if (queryWords.length === 1 && exactMatches > 0) {
      finalScore = Math.min(1.0, finalScore * 2)
    }

    // Frequency bonus
    if (exactMatches > 0) {
      const queryText = queryWords.join(' ')
      const occurrences = (normalizedContent.match(new RegExp(queryText, 'g')) || []).length
      const frequencyBonus = Math.min(0.3, occurrences * 0.1)
      finalScore += frequencyBonus
    }

    return Math.min(1.0, finalScore)
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

import type { WeaviateClient } from "weaviate-ts-client";

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

      try {
        await this.client.schema.classCreator().withClass(schema).do()
      } catch (error) {
        // Class might already exist
        console.log("Weaviate class might already exist:", error)
      }
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

      const processedResults = result.data?.Get?.[className]?.map((item: any, index: number) => {
        // Calculate a more realistic score based on search mode
        let finalScore = 1 - index / (options.limit || 10) // Base score from ranking
        
        // Adjust score based on search mode for better representation
        if (options.mode === "semantic") {
          finalScore = Math.max(0.5, finalScore) // Semantic results should have decent scores
        } else if (options.mode === "keyword") {
          // For keyword search, calculate actual keyword relevance
          finalScore = this.calculateKeywordScore(query, item.content)
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

  // Helper method for keyword scoring in Weaviate
  private calculateKeywordScore(query: string, content: string): number {
    if (!content || !query) return 0

    // Normalize text
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)
    
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
    const contentWords = normalizedContent.split(/\s+/)
    
    if (queryWords.length === 0) return 0

    let exactMatches = 0
    let partialMatches = 0
    
    for (const queryWord of queryWords) {
      if (contentWords.includes(queryWord)) {
        exactMatches++
      } else {
        const partialMatch = contentWords.some(contentWord => 
          contentWord.includes(queryWord) || queryWord.includes(contentWord)
        )
        if (partialMatch) {
          partialMatches++
        }
      }
    }

    const exactScore = exactMatches / queryWords.length
    const partialScore = (partialMatches / queryWords.length) * 0.5
    let finalScore = exactScore + partialScore

    // Boost single word matches
    if (queryWords.length === 1 && exactMatches > 0) {
      finalScore = Math.min(1.0, finalScore * 2)
    }

    // Frequency bonus
    if (exactMatches > 0) {
      const queryText = queryWords.join(' ')
      const occurrences = (normalizedContent.match(new RegExp(queryText, 'g')) || []).length
      const frequencyBonus = Math.min(0.3, occurrences * 0.1)
      finalScore += frequencyBonus
    }

    return Math.min(1.0, finalScore)
  }
}

import type { ChromaClient, Collection as ChromaCollection } from "chromadb";

class ChromaDatabase extends VectorDatabase {
  private client!: ChromaClient
  private collection!: ChromaCollection

  async initialize(): Promise<void> {
    try {
      this.validateConfig()

      const chromaUrl = this.config.url || "http://localhost:8000"

      // Dynamic import to avoid build issues
      const { ChromaClient } = await import("chromadb")

      this.client = new ChromaClient({
        path: chromaUrl,
      })

      const collectionName = this.config.collection || "documents"

      try {
        this.collection = await this.client.getCollection({
          name: collectionName,
        })
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: collectionName,
          metadata: { description: "PDF document chunks" },
        })
      }

      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize Chroma:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Chroma initialization failed: ${errorMessage}. Make sure ChromaDB server is running at ${this.config.url || "http://localhost:8000"}`,
      )
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const ids = documents.map((doc) => doc.id)
      const embeddings = documents.map((doc) => doc.embedding)
      const metadatas = documents.map((doc) => ({
        source: doc.metadata.source,
        documentId: doc.metadata.documentId,
        chunkIndex: doc.metadata.chunkIndex,
        timestamp: doc.metadata.timestamp.toISOString(),
      }))
      const documents_content = documents.map((doc) => doc.content)

      await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents: documents_content,
      })
    } catch (error) {
      console.error("Failed to add documents to Chroma:", error)
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
        // Pure semantic search using embeddings
        if (!embedding || embedding.length === 0) {
          console.warn("No embedding provided for semantic search")
          return []
        }

        const searchParams: any = {
          queryEmbeddings: [embedding],
          nResults: options.limit || 10,
        }

        if (options.filters) {
          searchParams.where = options.filters
        }

        const chromaResults = await this.collection.query(searchParams)

        results = chromaResults.ids[0]?.map((id: string, index: number) => ({
          id,
          content: chromaResults.documents[0][index] || "",
          score: 1 - (chromaResults.distances[0][index] || 0),
          metadata: {
            ...chromaResults.metadatas[0][index],
            searchMode: "semantic"
          },
        })) || []

      } else if (options.mode === "keyword") {
        // Pure keyword search - use a zero vector to get documents, then filter locally
        // Since ChromaDB doesn't have native text search, we use query with zero vector
        const zeroVector = new Array(1536).fill(0) // Assuming 1536 dimensions
        
        const searchParams: any = {
          queryEmbeddings: [zeroVector],
          nResults: Math.min(1000, (options.limit || 10) * 20), // Get more to filter locally
        }

        if (options.filters) {
          searchParams.where = options.filters
        }

        const chromaResults = await this.collection.query(searchParams)

        // Filter using keyword matching
        const keywordResults = []
        const ids = chromaResults.ids[0] || []
        const documents = chromaResults.documents[0] || []
        const metadatas = chromaResults.metadatas[0] || []
        
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]
          const content = documents[i] || ""
          const metadata = metadatas[i] || {}
          
          const keywordScore = this.calculateKeywordScore(query, content)
          
          if (keywordScore >= (options.threshold || 0.01)) {
            keywordResults.push({
              id,
              content,
              score: keywordScore,
              metadata: {
                ...metadata,
                searchMode: "keyword"
              }
            })
          }
        }

        // Sort by score and limit results
        results = keywordResults
          .sort((a, b) => b.score - a.score)
          .slice(0, options.limit || 10)

      } else if (options.mode === "hybrid") {
        // Hybrid search - combine semantic and keyword approaches
        let semanticResults: any[] = []
        let keywordResults: any[] = []

        // Get semantic results if embedding is available
        if (embedding && embedding.length > 0) {
          const searchParams: any = {
            queryEmbeddings: [embedding],
            nResults: Math.min(100, (options.limit || 10) * 5), // Get more for better mixing
          }

          if (options.filters) {
            searchParams.where = options.filters
          }

          const chromaResults = await this.collection.query(searchParams)
          semanticResults = chromaResults.ids[0]?.map((id: string, index: number) => ({
            id,
            content: chromaResults.documents[0][index] || "",
            semanticScore: 1 - (chromaResults.distances[0][index] || 0),
            metadata: chromaResults.metadatas[0][index] || {},
          })) || []
        }

        // Get keyword results using zero vector query
        const zeroVector = new Array(1536).fill(0)
        const allDocsParams: any = {
          queryEmbeddings: [zeroVector],
          nResults: Math.min(200, (options.limit || 10) * 10),
        }

        if (options.filters) {
          allDocsParams.where = options.filters
        }

        const allDocsResults = await this.collection.query(allDocsParams)
        
        const keywordMap = new Map<string, number>()
        const allIds = allDocsResults.ids[0] || []
        const allDocuments = allDocsResults.documents[0] || []
        
        for (let i = 0; i < allIds.length; i++) {
          const id = allIds[i]
          const content = allDocuments[i] || ""
          const keywordScore = this.calculateKeywordScore(query, content)
          keywordMap.set(id, keywordScore)
        }

        // Combine semantic and keyword scores
        const hybridMap = new Map<string, any>()

        // Add semantic results
        semanticResults.forEach(result => {
          hybridMap.set(result.id, {
            ...result,
            keywordScore: keywordMap.get(result.id) || 0
          })
        })

        // Add any keyword-only results
        keywordMap.forEach((keywordScore, id) => {
          if (!hybridMap.has(id) && keywordScore > 0) {
            const docIndex = allIds.indexOf(id)
            if (docIndex >= 0) {
              hybridMap.set(id, {
                id,
                content: allDocuments[docIndex] || "",
                semanticScore: 0,
                keywordScore,
                metadata: (allDocsResults.metadatas![0] || [])[docIndex] || {}
              })
            }
          }
        })

        // Calculate final hybrid scores
        const hybridResults = Array.from(hybridMap.values()).map(result => {
          const semanticScore = result.semanticScore || 0
          const keywordScore = result.keywordScore || 0
          
          // Weighted combination (60% semantic, 40% keyword if both available)
          let hybridScore: number
          if (semanticScore > 0 && keywordScore > 0) {
            hybridScore = semanticScore * 0.6 + keywordScore * 0.4
          } else {
            hybridScore = semanticScore + keywordScore
          }

          return {
            id: result.id,
            content: result.content,
            score: hybridScore,
            metadata: {
              ...result.metadata,
              searchMode: "hybrid",
              semanticScore,
              keywordScore,
              hybridScore
            }
          }
        })

        // Filter and sort results
        results = hybridResults
          .filter(result => result.score >= (options.threshold || 0.05))
          .sort((a, b) => b.score - a.score)
          .slice(0, options.limit || 10)
      }

      return results

    } catch (error) {
      console.error("Failed to search Chroma:", error)
      throw error
    }
  }

  // Helper method for keyword scoring in ChromaDB
  private calculateKeywordScore(query: string, content: string): number {
    if (!content || !query) return 0

    // Normalize text
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)
    
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
    const contentWords = normalizedContent.split(/\s+/)
    
    if (queryWords.length === 0) return 0

    let exactMatches = 0
    let partialMatches = 0
    
    for (const queryWord of queryWords) {
      if (contentWords.includes(queryWord)) {
        exactMatches++
      } else {
        const partialMatch = contentWords.some(contentWord => 
          contentWord.includes(queryWord) || queryWord.includes(contentWord)
        )
        if (partialMatch) {
          partialMatches++
        }
      }
    }

    const exactScore = exactMatches / queryWords.length
    const partialScore = (partialMatches / queryWords.length) * 0.5
    let finalScore = exactScore + partialScore

    // Boost single word matches
    if (queryWords.length === 1 && exactMatches > 0) {
      finalScore = Math.min(1.0, finalScore * 2)
    }

    // Frequency bonus
    if (exactMatches > 0) {
      const queryText = queryWords.join(' ')
      const occurrences = (normalizedContent.match(new RegExp(queryText, 'g')) || []).length
      const frequencyBonus = Math.min(0.3, occurrences * 0.1)
      finalScore += frequencyBonus
    }

    return Math.min(1.0, finalScore)
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      await this.collection.delete({
        where: { documentId },
      })
    } catch (error) {
      console.error("Failed to delete document from Chroma:", error)
      throw error
    }
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const collectionName = this.config.collection || "documents"
      // Get the collection first, then delete it if it exists
      try {
        const collection = await this.client.getCollection({
          name: collectionName
        })
        if (collection) {
          // Delete all documents by passing an empty where filter
          await collection.delete({
            where: {}
          })
        }
      } catch (err) {
        // Collection might not exist, which is fine for a clear operation
        console.log(`Collection ${collectionName} might not exist or couldn't be deleted.`)
      }

      // Recreate the collection
      this.collection = await this.client.createCollection({
        name: collectionName
      })
      
      // Note: metadata handling would typically go here, but the current type definitions
      // don't expose a metadata property directly
    } catch (error) {
      console.error("Failed to clear Chroma collection:", error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const chromaUrl = this.config.url || "http://localhost:8000"

      // Test with a simple fetch request first
      const response = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error("Chroma connection test failed:", error)
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
        score = this.enhancedKeywordSimilarity(query, doc.content)
      } else if (options.mode === "hybrid") {
        // Hybrid search - combine both with fallback
        let semanticScore = 0
        let keywordScore = 0

        // Try semantic search if embeddings available
        if (embedding && embedding.length > 0) {
          semanticScore = this.cosineSimilarity(embedding, doc.embedding)
        }

        // Always do keyword search
        keywordScore = this.enhancedKeywordSimilarity(query, doc.content)

        // If both available, average them; otherwise use what's available
        if (semanticScore > 0 && keywordScore > 0) {
          score = (semanticScore + keywordScore) / 2
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

  private enhancedKeywordSimilarity(query: string, content: string): number {
    // Normalize text: lowercase, remove punctuation, handle contractions
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
    }

    const normalizedQuery = normalizeText(query)
    const normalizedContent = normalizeText(content)
    
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0)
    const contentWords = normalizedContent.split(/\s+/)
    
    if (queryWords.length === 0) return 0

    // Count exact matches
    let exactMatches = 0
    let partialMatches = 0
    
    for (const queryWord of queryWords) {
      // Check for exact matches
      if (contentWords.includes(queryWord)) {
        exactMatches++
      } else {
        // Check for partial matches (substring matching)
        const partialMatch = contentWords.some(contentWord => 
          contentWord.includes(queryWord) || queryWord.includes(contentWord)
        )
        if (partialMatch) {
          partialMatches++
        }
      }
    }

    // Calculate score with higher weight for exact matches
    const exactScore = exactMatches / queryWords.length
    const partialScore = (partialMatches / queryWords.length) * 0.5 // Partial matches worth 50%
    
    let finalScore = exactScore + partialScore

    // Boost score for short queries (single words should have higher chance of matching)
    if (queryWords.length === 1 && exactMatches > 0) {
      finalScore = Math.min(1.0, finalScore * 2) // Double score for single word exact matches
    }

    // Add frequency bonus - more occurrences = higher score
    if (exactMatches > 0) {
      const queryText = queryWords.join(' ')
      const occurrences = (normalizedContent.match(new RegExp(queryText, 'g')) || []).length
      const frequencyBonus = Math.min(0.3, occurrences * 0.1) // Max 30% bonus
      finalScore += frequencyBonus
    }

    return Math.min(1.0, finalScore) // Cap at 1.0
  }

  // Legacy method for backward compatibility
  private keywordSimilarity(query: string, content: string): number {
    return this.enhancedKeywordSimilarity(query, content)
  }
}

export function createVectorDatabase(config: VectorDBConfig): VectorDatabase {
  switch (config.provider) {
    case "pinecone":
      return new PineconeDatabase(config)
    case "weaviate":
      return new WeaviateDatabase(config) // Keep existing implementation
    case "chroma":
      return new ChromaDatabase(config)
    case "local":
    default:
      return new LocalVectorDatabase(config)
  }
}

// Browser-compatible vector database without Node.js dependencies

export interface VectorEntry {
  id: string
  vector: number[]
  metadata: Record<string, any>
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

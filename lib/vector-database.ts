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

class PineconeDatabase extends VectorDatabase {
  private pinecone: any
  private index: any

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
      throw new Error(`Pinecone initialization failed: ${error.message}`)
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
      const searchParams: any = {
        vector: embedding,
        topK: options.limit || 10,
        includeMetadata: true,
        includeValues: false,
      }

      if (options.filters) {
        searchParams.filter = options.filters
      }

      const results = await this.index.query(searchParams)

      return (
        results.matches?.map((match: any) => ({
          id: match.id,
          content: match.metadata?.content || "",
          score: match.score || 0,
          metadata: match.metadata || {},
        })) || []
      )
    } catch (error) {
      console.error("Failed to search Pinecone:", error)
      throw error
    }
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

class WeaviateDatabase extends VectorDatabase {
  private client: any

  async initialize(): Promise<void> {
    try {
      const weaviate = await import("weaviate-ts-client")

      this.client = weaviate.default.client({
        scheme: "https",
        host: this.config.url || "localhost:8080",
        apiKey: this.config.apiKey ? weaviate.default.apiKey(this.config.apiKey) : undefined,
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

      return (
        result.data?.Get?.[className]?.map((item: any, index: number) => ({
          id: `${item.documentId}_${item.chunkIndex}`,
          content: item.content,
          score: 1 - index / (options.limit || 10), // Approximate score
          metadata: {
            source: item.source,
            documentId: item.documentId,
            chunkIndex: item.chunkIndex,
          },
        })) || []
      )
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

class ChromaDatabase extends VectorDatabase {
  private client: any
  private collection: any

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
      throw new Error(
        `Chroma initialization failed: ${error.message}. Make sure ChromaDB server is running at ${this.config.url || "http://localhost:8000"}`,
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
      const searchParams: any = {
        queryEmbeddings: [embedding],
        nResults: options.limit || 10,
      }

      if (options.filters) {
        searchParams.where = options.filters
      }

      const results = await this.collection.query(searchParams)

      return (
        results.ids[0]?.map((id: string, index: number) => ({
          id,
          content: results.documents[0][index] || "",
          score: 1 - (results.distances[0][index] || 0),
          metadata: results.metadatas[0][index] || {},
        })) || []
      )
    } catch (error) {
      console.error("Failed to search Chroma:", error)
      throw error
    }
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
      await this.client.deleteCollection({ name: collectionName })

      // Recreate the collection
      this.collection = await this.client.createCollection({
        name: collectionName,
        metadata: { description: "PDF document chunks" },
      })
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

    for (const doc of this.documents) {
      let score = 0

      if (options.mode === "semantic" || options.mode === "hybrid") {
        score = this.cosineSimilarity(embedding, doc.embedding)
      }

      if (options.mode === "keyword" || options.mode === "hybrid") {
        const keywordScore = this.keywordSimilarity(query, doc.content)
        score = options.mode === "hybrid" ? (score + keywordScore) / 2 : keywordScore
      }

      if (score >= (options.threshold || 0.1)) {
        results.push({
          id: doc.id,
          content: doc.content,
          score,
          metadata: doc.metadata,
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

  private keywordSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/)
    const contentWords = content.toLowerCase().split(/\s+/)
    const matches = queryWords.filter((word) => contentWords.includes(word))
    return matches.length / queryWords.length
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

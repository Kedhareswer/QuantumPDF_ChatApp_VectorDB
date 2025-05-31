import { AIClient } from "./ai-client"
import { PDFParser } from "./pdf-parser"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface AIConfig {
  provider:
    | "huggingface"
    | "openai"
    | "anthropic"
    | "aiml"
    | "groq"
    | "openrouter"
    | "cohere"
    | "deepinfra"
    | "deepseek"
    | "google"
    | "vertex"
    | "mistral"
    | "perplexity"
    | "together"
    | "xai"
    | "alibaba"
    | "minimax"
  apiKey: string
  model: string
  baseUrl?: string
}

interface QueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: string[]
  fallbackMode?: boolean
}

export class RAGEngine {
  private aiClient: AIClient | null = null
  private documents: Document[] = []
  private pdfParser: PDFParser
  private initialized = false
  private embeddingFallbackMode = false
  private currentConfig: AIConfig | null = null

  constructor() {
    this.pdfParser = new PDFParser()
    console.log("RAG Engine initialized")
  }

  async initialize(config: AIConfig): Promise<void> {
    try {
      console.log(`Initializing RAG Engine with provider: ${config.provider}`)

      this.currentConfig = config
      this.aiClient = new AIClient(config)

      // Test the connection
      const connectionTest = await this.aiClient.testConnection()
      if (!connectionTest) {
        throw new Error(`Failed to connect to ${config.provider}`)
      }

      // Check if provider supports embeddings
      this.embeddingFallbackMode = !this.supportsEmbeddings(config.provider)

      if (this.embeddingFallbackMode) {
        console.warn(`Provider ${config.provider} does not support embeddings. Enabling fallback mode.`)
      } else {
        // Test embedding generation for providers that should support it
        try {
          const testEmbedding = await this.aiClient.generateEmbedding("test connection")
          if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
            console.warn("Embedding test failed, enabling fallback mode")
            this.embeddingFallbackMode = true
          }
        } catch (embeddingError) {
          console.warn("Embedding generation failed, enabling fallback mode:", embeddingError)
          this.embeddingFallbackMode = true
        }
      }

      this.initialized = true
      console.log(`RAG Engine initialized successfully with ${config.provider}`)

      // Re-process existing documents if any
      if (this.documents.length > 0) {
        console.log("Re-processing existing documents with new provider...")
        await this.reprocessDocuments()
      }
    } catch (error) {
      console.error("Failed to initialize RAG Engine:", error)
      this.initialized = false
      throw error
    }
  }

  private supportsEmbeddings(provider: string): boolean {
    const embeddingSupportedProviders = ["huggingface", "openai", "aiml", "cohere", "vertex"]
    return embeddingSupportedProviders.includes(provider)
  }

  private async reprocessDocuments(): Promise<void> {
    if (!this.embeddingFallbackMode && this.aiClient) {
      console.log("Regenerating embeddings for existing documents...")
      for (const document of this.documents) {
        try {
          const embeddings = await this.aiClient.generateEmbeddings(document.chunks)
          document.embeddings = embeddings
          console.log(`Updated embeddings for document: ${document.name}`)
        } catch (error) {
          console.error(`Failed to update embeddings for ${document.name}:`, error)
          // Keep existing embeddings or use fallback
        }
      }
    }
  }

  async updateConfig(config: AIConfig) {
    try {
      console.log("Updating RAG Engine configuration")
      await this.initialize(config)

      // Re-generate embeddings for existing documents if provider changed
      if (this.documents.length > 0) {
        console.log("Re-generating embeddings for existing documents...")
        for (const document of this.documents) {
          if (document.chunks && document.chunks.length > 0) {
            document.embeddings = await this.aiClient!.generateEmbeddings(document.chunks)
          }
        }
        console.log("Embeddings updated for all documents")
      }
    } catch (error) {
      console.error("Failed to update RAG Engine configuration:", error)
      throw error
    }
  }

  async processDocument(file: File): Promise<Document> {
    if (!this.initialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

    try {
      console.log(`Processing document: ${file.name}`)

      // Extract text from PDF
      const pdfContent = await this.pdfParser.extractText(file)

      // Chunk the text
      const chunks = this.pdfParser.chunkText(pdfContent.text, 500, 50)
      console.log(`Generated ${chunks.length} chunks`)

      if (chunks.length === 0) {
        throw new Error("No text chunks could be created from the document")
      }

      // Generate embeddings for all chunks
      console.log("Generating embeddings...")
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

  async addDocument(document: Document): Promise<void> {
    try {
      if (!this.initialized || !this.aiClient) {
        throw new Error("RAG Engine not initialized")
      }

      console.log(`Adding document: ${document.name} with ${document.chunks.length} chunks`)

      // Generate embeddings if provider supports them
      if (!this.embeddingFallbackMode) {
        try {
          console.log("Generating embeddings for document chunks...")
          const embeddings = await this.aiClient.generateEmbeddings(document.chunks)
          document.embeddings = embeddings
          console.log(`Generated ${embeddings.length} embeddings`)
        } catch (error) {
          console.error("Failed to generate embeddings, falling back to keyword search:", error)
          this.embeddingFallbackMode = true
          document.embeddings = []
        }
      } else {
        document.embeddings = []
        console.log("Skipping embedding generation (fallback mode active)")
      }

      this.documents.push(document)
      console.log(`Document added successfully. Total documents: ${this.documents.length}`)
    } catch (error) {
      console.error("Error adding document:", error)
      throw error
    }
  }

  async query(question: string): Promise<QueryResponse> {
    try {
      if (!this.initialized || !this.aiClient) {
        throw new Error("RAG Engine not initialized")
      }

      if (!question || question.trim().length === 0) {
        throw new Error("Invalid question provided")
      }

      if (this.documents.length === 0) {
        throw new Error("No documents available for querying")
      }

      console.log(`Processing query: "${question}" (Fallback mode: ${this.embeddingFallbackMode})`)

      let relevantChunks: string[] = []
      let relevanceScore = 0

      if (this.embeddingFallbackMode) {
        // Use keyword-based search as fallback
        const result = this.performKeywordSearch(question)
        relevantChunks = result.chunks
        relevanceScore = result.score
        console.log(`Keyword search found ${relevantChunks.length} relevant chunks`)
      } else {
        // Use embedding-based semantic search
        const result = await this.performSemanticSearch(question)
        relevantChunks = result.chunks
        relevanceScore = result.score
        console.log(`Semantic search found ${relevantChunks.length} relevant chunks`)
      }

      if (relevantChunks.length === 0) {
        console.warn("No relevant chunks found for the query")
        return {
          answer:
            "I couldn't find relevant information in the uploaded documents to answer your question. Please try rephrasing your question or check if the information exists in your documents.",
          sources: [],
          relevanceScore: 0,
          retrievedChunks: [],
          fallbackMode: this.embeddingFallbackMode,
        }
      }

      // Generate response using AI
      const context = relevantChunks.join("\n\n")
      const systemPrompt = this.embeddingFallbackMode
        ? "You are a helpful assistant analyzing documents using keyword-based search. The provided context may be less precisely matched than usual. Answer based on the given context and indicate if you're uncertain about any information."
        : "You are a helpful assistant analyzing documents. Answer the user's question based on the provided context from the documents."

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        {
          role: "user" as const,
          content: `Context from documents:\n${context}\n\nQuestion: ${question}\n\nPlease provide a comprehensive answer based on the context above.`,
        },
      ]

      console.log("Generating AI response...")
      const answer = await this.aiClient.generateText(messages)

      const sources = this.extractSources(relevantChunks)

      return {
        answer,
        sources,
        relevanceScore,
        retrievedChunks: relevantChunks,
        fallbackMode: this.embeddingFallbackMode,
      }
    } catch (error) {
      console.error("Error processing query:", error)
      throw error
    }
  }

  private performKeywordSearch(question: string): { chunks: string[]; score: number } {
    console.log("Performing keyword-based search...")

    // Extract keywords from the question
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter(
        (word) =>
          ![
            "the",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "what",
            "how",
            "when",
            "where",
            "why",
            "who",
            "which",
            "can",
            "could",
            "would",
            "should",
            "will",
            "are",
            "is",
            "was",
            "were",
            "been",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "this",
            "that",
            "these",
            "those",
            "a",
            "an",
            "from",
            "up",
            "out",
            "down",
            "off",
            "over",
            "under",
            "again",
            "further",
            "then",
            "once",
          ].includes(word),
      )

    console.log(`Extracted keywords: ${keywords.join(", ")}`)

    const scoredChunks: { chunk: string; score: number; source: string }[] = []

    // Score each chunk based on keyword matches
    for (const document of this.documents) {
      for (let i = 0; i < document.chunks.length; i++) {
        const chunk = document.chunks[i]
        const chunkLower = chunk.toLowerCase()
        let score = 0

        // Count keyword matches with different weights
        for (const keyword of keywords) {
          // Exact word matches (higher weight)
          const exactMatches = (chunkLower.match(new RegExp(`\\b${keyword}\\b`, "g")) || []).length
          score += exactMatches * 3

          // Partial matches (lower weight)
          const partialMatches = (chunkLower.match(new RegExp(keyword, "g")) || []).length - exactMatches
          score += partialMatches * 1
        }

        // Bonus for exact phrase matches
        if (chunkLower.includes(question.toLowerCase())) {
          score += 15
        }

        // Bonus for multiple keyword co-occurrence
        const keywordsInChunk = keywords.filter((keyword) => chunkLower.includes(keyword)).length
        if (keywordsInChunk > 1) {
          score += keywordsInChunk * 2
        }

        // Bonus for keyword density
        const chunkWords = chunkLower.split(/\s+/).length
        if (chunkWords > 0) {
          const density = (score / chunkWords) * 100
          score += density * 0.1
        }

        if (score > 0) {
          scoredChunks.push({
            chunk,
            score,
            source: `${document.name} (chunk ${i + 1})`,
          })
        }
      }
    }

    // Sort by score and take top chunks
    scoredChunks.sort((a, b) => b.score - a.score)
    const topChunks = scoredChunks.slice(0, 5).map((item) => item.chunk)
    const avgScore =
      scoredChunks.length > 0
        ? scoredChunks.slice(0, 5).reduce((sum, item) => sum + item.score, 0) / Math.min(5, scoredChunks.length)
        : 0
    const normalizedScore = Math.min(avgScore / 20, 1) // Normalize to 0-1 range

    console.log(
      `Keyword search completed. Found ${topChunks.length} relevant chunks with average score: ${normalizedScore.toFixed(2)}`,
    )

    return {
      chunks: topChunks,
      score: normalizedScore,
    }
  }

  private async performSemanticSearch(question: string): Promise<{ chunks: string[]; score: number }> {
    if (!this.aiClient) {
      throw new Error("AI client not available")
    }

    console.log("Performing semantic search...")

    // Generate embedding for the question
    const questionEmbedding = await this.aiClient.generateEmbedding(question)

    const scoredChunks: { chunk: string; score: number }[] = []

    // Calculate similarity with each chunk
    for (const document of this.documents) {
      for (let i = 0; i < document.chunks.length; i++) {
        const chunk = document.chunks[i]
        const chunkEmbedding = document.embeddings[i]

        if (chunkEmbedding && chunkEmbedding.length > 0) {
          const similarity = this.aiClient.cosineSimilarity(questionEmbedding, chunkEmbedding)
          if (similarity > 0.1) {
            // Threshold for relevance
            scoredChunks.push({ chunk, score: similarity })
          }
        }
      }
    }

    // Sort by similarity and take top chunks
    scoredChunks.sort((a, b) => b.score - a.score)
    const topChunks = scoredChunks.slice(0, 5).map((item) => item.chunk)
    const avgScore =
      scoredChunks.length > 0
        ? scoredChunks.slice(0, 5).reduce((sum, item) => sum + item.score, 0) / Math.min(5, scoredChunks.length)
        : 0

    console.log(
      `Semantic search completed. Found ${topChunks.length} relevant chunks with average similarity: ${avgScore.toFixed(2)}`,
    )

    return {
      chunks: topChunks,
      score: avgScore,
    }
  }

  private extractSources(chunks: string[]): string[] {
    const sources: string[] = []

    for (const chunk of chunks) {
      // Find which document this chunk belongs to
      for (const document of this.documents) {
        if (document.chunks.includes(chunk)) {
          const chunkIndex = document.chunks.indexOf(chunk)
          const source = `${document.name} (chunk ${chunkIndex + 1})`
          if (!sources.includes(source)) {
            sources.push(source)
          }
          break
        }
      }
    }

    return sources
  }

  private findRelevantChunks(questionEmbedding: number[], topK: number) {
    const allChunks: Array<{
      content: string
      source: string
      similarity: number
    }> = []

    try {
      // Validate inputs
      if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
        console.error("Invalid question embedding")
        return []
      }

      if (!Array.isArray(this.documents) || this.documents.length === 0) {
        console.error("No documents available")
        return []
      }

      // Calculate similarity for all chunks
      this.documents.forEach((doc, docIndex) => {
        try {
          // Validate document structure
          if (!doc || !doc.chunks || !doc.embeddings) {
            console.warn(`Document ${docIndex} has invalid structure`)
            return
          }

          if (!Array.isArray(doc.chunks) || !Array.isArray(doc.embeddings)) {
            console.warn(`Document ${docIndex} has invalid chunks or embeddings`)
            return
          }

          if (doc.chunks.length !== doc.embeddings.length) {
            console.warn(`Document ${docIndex} has mismatched chunks and embeddings`)
            return
          }

          doc.chunks.forEach((chunk, chunkIndex) => {
            try {
              const chunkEmbedding = doc.embeddings[chunkIndex]

              // Validate chunk embedding
              if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
                console.warn(`Invalid embedding for chunk ${chunkIndex} in document ${docIndex}`)
                return
              }

              if (chunkEmbedding.length !== questionEmbedding.length) {
                console.warn(`Embedding dimension mismatch for chunk ${chunkIndex} in document ${docIndex}`)
                return
              }

              const similarity = this.aiClient!.cosineSimilarity(questionEmbedding, chunkEmbedding)

              if (typeof similarity === "number" && !isNaN(similarity)) {
                allChunks.push({
                  content: chunk || "",
                  source: `${doc.name || "Unknown Document"} (chunk ${chunkIndex + 1})`,
                  similarity,
                })
              }
            } catch (chunkError) {
              console.warn(`Error processing chunk ${chunkIndex} in document ${docIndex}:`, chunkError)
            }
          })
        } catch (docError) {
          console.warn(`Error processing document ${docIndex}:`, docError)
        }
      })

      // Sort by similarity and return top K
      return allChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter((chunk) => chunk.similarity > 0.1) // Filter out very low similarity chunks
    } catch (error) {
      console.error("Error finding relevant chunks:", error)
      return []
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

  removeDocument(documentId: string): void {
    const initialLength = this.documents.length
    this.documents = this.documents.filter((doc) => doc.id !== documentId)
    console.log(`Removed document ${documentId}. Documents: ${initialLength} -> ${this.documents.length}`)
  }

  clearDocuments(): void {
    this.documents = []
    console.log("All documents cleared")
  }

  // Health check method
  isHealthy(): boolean {
    return this.initialized && this.aiClient !== null
  }

  // Get status information
  getStatus() {
    try {
      return {
        initialized: this.initialized,
        documentCount: Array.isArray(this.documents) ? this.documents.length : 0,
        totalChunks: Array.isArray(this.documents)
          ? this.documents.reduce((total, doc) => {
              return total + (Array.isArray(doc.chunks) ? doc.chunks.length : 0)
            }, 0)
          : 0,
        healthy: this.isHealthy(),
        currentProvider: this.currentConfig?.provider,
        currentModel: this.currentConfig?.model,
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
      }
    }
  }

  getDocumentCount(): number {
    return this.documents.length
  }

  isEmbeddingFallbackActive(): boolean {
    return this.embeddingFallbackMode
  }

  getCurrentProvider(): string | null {
    return this.currentConfig?.provider || null
  }
}

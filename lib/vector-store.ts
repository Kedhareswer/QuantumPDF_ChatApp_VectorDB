import { generateEmbedding } from "./embedding"

export interface Document {
  id: string
  text: string
  metadata: {
    pdfName: string
    pdfId: string
    chunkIndex: number
  }
  embedding?: number[]
}

import { promises as fs } from "fs"
import path from "path"

export class VectorStore {
  private documents: Document[] = []
  private storagePath = path.resolve(process.cwd(), "vector-store.json")

  constructor() {
    this.loadFromFile()
  }

  private async loadFromFile() {
    try {
      const data = await fs.readFile(this.storagePath, "utf-8")
      this.documents = JSON.parse(data)
    } catch (err) {
      // File doesn't exist or is invalid; start with empty
      this.documents = []
    }
  }

  private async saveToFile() {
    try {
      await fs.writeFile(this.storagePath, JSON.stringify(this.documents, null, 2), "utf-8")
    } catch (err) {
      console.error("Failed to save vector store:", err)
    }
  }

  // Add a document to the store and generate its embedding
  async addDocument(doc: Omit<Document, "embedding">): Promise<void> {
    try {
      const embedding = await generateEmbedding(doc.text)
      this.documents.push({
        ...doc,
        embedding,
      })
      await this.saveToFile()
    } catch (error: any) {
      console.error(`Error adding document ${doc.id} to vector store:`, error)
      throw new Error(`Failed to add document to vector store: ${error.message}`)
    }
  }

  // Add multiple documents at once
  async addDocuments(docs: Omit<Document, "embedding">[]): Promise<void> {
    const errors: Error[] = []

    for (const doc of docs) {
      try {
        await this.addDocument(doc)
      } catch (error: any) {
        errors.push(error)
        console.error(`Error adding document ${doc.id}:`, error)
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to add ${errors.length} out of ${docs.length} documents`)
    }
  }

  // Find similar documents based on a query
  async findSimilar(query: string, limit = 5): Promise<Document[]> {
    const queryEmbedding = await generateEmbedding(query)

    // Calculate similarity scores for all documents
    const scoredDocs = this.documents.map((doc) => {
      if (!doc.embedding) return { doc, score: 0 }

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding)
      return { doc, score: similarity }
    })

    // Sort by similarity score (descending) and take the top 'limit' results
    return scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.doc)
  }

  // Get all documents for a specific PDF
  getDocumentsForPdf(pdfId: string): Document[] {
    return this.documents.filter((doc) => doc.metadata.pdfId === pdfId)
  }

  // Clear all documents
  clear(): void {
    this.documents = []
    this.saveToFile()
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same length")
    }

    let dotProduct = 0
    let mag1 = 0
    let mag2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      mag1 += vec1[i] * vec1[i]
      mag2 += vec2[i] * vec2[i]
    }

    mag1 = Math.sqrt(mag1)
    mag2 = Math.sqrt(mag2)

    if (mag1 === 0 || mag2 === 0) return 0

    return dotProduct / (mag1 * mag2)
  }
}

// Create a singleton instance of the vector store
export const vectorStore = new VectorStore()

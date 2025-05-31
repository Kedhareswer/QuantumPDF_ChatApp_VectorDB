import type { HfInference } from "@huggingface/inference"

export class HuggingFaceClient {
  private hf: HfInference
  private embeddingModel = "sentence-transformers/all-MiniLM-L6-v2"
  private textGenerationModel = "HuggingFaceH4/zephyr-7b-beta"

  constructor() {
    // No API key stored on client side
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        throw new Error("Invalid text input for embedding generation")
      }

      // Use server-side API route instead of direct API call
      const response = await fetch("/api/huggingface/embedding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          model: this.embeddingModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error("Invalid embedding response from server")
      }

      return result.embedding
    } catch (error) {
      console.error("Error generating embedding:", error)
      // Fallback to local embedding generation
      return this.generateLocalEmbedding(text)
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error("Invalid texts array for embedding generation")
      }

      const embeddings: number[][] = []

      for (let i = 0; i < texts.length; i++) {
        try {
          const text = texts[i]
          if (!text || typeof text !== "string") {
            console.warn(`Skipping invalid text at index ${i}`)
            continue
          }

          const embedding = await this.generateEmbedding(text)
          embeddings.push(embedding)

          // Add small delay to avoid overwhelming the server
          if (i < texts.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        } catch (error) {
          console.error(`Error generating embedding for text ${i}:`, error)
          // Generate fallback embedding
          const fallbackEmbedding = this.generateLocalEmbedding(texts[i] || "")
          embeddings.push(fallbackEmbedding)
        }
      }

      if (embeddings.length === 0) {
        throw new Error("Failed to generate any embeddings")
      }

      return embeddings
    } catch (error) {
      console.error("Error generating embeddings:", error)
      throw error
    }
  }

  async generateText(prompt: string, context: string): Promise<string> {
    try {
      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new Error("Invalid prompt for text generation")
      }

      if (!context || typeof context !== "string") {
        context = ""
      }

      // Use server-side API route instead of direct API call
      const response = await fetch("/api/huggingface/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: context,
          model: this.textGenerationModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.text || typeof result.text !== "string") {
        throw new Error("Invalid text response from server")
      }

      return result.text
    } catch (error) {
      console.error("Error generating text:", error)
      return this.generateLocalResponse(prompt, context)
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test connection through server-side API route
      const response = await fetch("/api/test/huggingface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      return response.ok
    } catch (error) {
      console.error("Connection test failed:", error)
      return false
    }
  }

  private generateLocalEmbedding(text: string): number[] {
    try {
      if (!text || typeof text !== "string") {
        text = "default"
      }

      // Simple hash-based embedding as fallback
      const words = text
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0)
      const embedding = new Array(384).fill(0)

      words.forEach((word, index) => {
        const hash = this.simpleHash(word)
        const position = hash % 384
        embedding[position] += 1 / (index + 1) // Weight by position
      })

      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
      return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
    } catch (error) {
      console.error("Error generating local embedding:", error)
      // Return a default embedding
      return new Array(384).fill(0.001)
    }
  }

  private generateLocalResponse(prompt: string, context: string): string {
    try {
      if (!context || context.trim().length === 0) {
        return "I apologize, but I don't have enough context to answer your question. Please ensure your documents are properly uploaded and contain relevant information."
      }

      const contextWords = context.toLowerCase().split(/\s+/)
      const promptWords = prompt.toLowerCase().split(/\s+/)

      // Find relevant sentences from context
      const sentences = context.split(/[.!?]+/).filter((s) => s.trim().length > 0)
      const relevantSentences = sentences.filter((sentence) => {
        const sentenceWords = sentence.toLowerCase().split(/\s+/)
        return promptWords.some((word) => sentenceWords.includes(word))
      })

      if (relevantSentences.length > 0) {
        const selectedSentences = relevantSentences.slice(0, 2).join(". ")
        return `Based on the document content: ${selectedSentences}.`
      }

      // Fallback to first part of context
      const contextPreview = context.substring(0, 200).trim()
      return `According to the provided context: ${contextPreview}${contextPreview.length < context.length ? "..." : ""}`
    } catch (error) {
      console.error("Error generating local response:", error)
      return "I encountered an error while processing your question. Please try rephrasing your question or check your document content."
    }
  }

  private simpleHash(str: string): number {
    try {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return Math.abs(hash)
    } catch (error) {
      console.error("Error generating hash:", error)
      return 0
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    try {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        console.error("Invalid arrays for cosine similarity")
        return 0
      }

      if (a.length !== b.length) {
        console.error("Array length mismatch for cosine similarity")
        return 0
      }

      if (a.length === 0) {
        console.error("Empty arrays for cosine similarity")
        return 0
      }

      const dotProduct = a.reduce((sum, val, i) => {
        const aVal = typeof val === "number" && !isNaN(val) ? val : 0
        const bVal = typeof b[i] === "number" && !isNaN(b[i]) ? b[i] : 0
        return sum + aVal * bVal
      }, 0)

      const magnitudeA = Math.sqrt(
        a.reduce((sum, val) => {
          const numVal = typeof val === "number" && !isNaN(val) ? val : 0
          return sum + numVal * numVal
        }, 0),
      )

      const magnitudeB = Math.sqrt(
        b.reduce((sum, val) => {
          const numVal = typeof val === "number" && !isNaN(val) ? val : 0
          return sum + numVal * numVal
        }, 0),
      )

      if (magnitudeA === 0 || magnitudeB === 0) {
        return 0
      }

      const similarity = dotProduct / (magnitudeA * magnitudeB)
      return typeof similarity === "number" && !isNaN(similarity) ? similarity : 0
    } catch (error) {
      console.error("Error calculating cosine similarity:", error)
      return 0
    }
  }
}

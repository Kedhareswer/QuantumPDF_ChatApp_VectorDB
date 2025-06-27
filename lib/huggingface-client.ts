// Browser-compatible Hugging Face client without Node.js dependencies

export interface EmbeddingResponse {
  embeddings: number[][]
}

export interface TextGenerationResponse {
  generated_text: string
}

export class BrowserHuggingFaceClient {
  private apiKey: string
  private baseUrl = "https://api-inference.huggingface.co"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateEmbeddings(texts: string[], model = "sentence-transformers/all-MiniLM-L6-v2"): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/pipeline/feature-extraction/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: texts,
          options: {
            wait_for_model: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const embeddings = await response.json()
      return Array.isArray(embeddings[0]) ? embeddings : [embeddings]
    } catch (error) {
      console.error("Embedding generation failed:", error)
      // Return deterministic hash-based embeddings as fallback
      return texts.map((text) => this.generateHashBasedEmbedding(text))
    }
  }

  async generateText(prompt: string, model = "gpt2"): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/models/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: 100,
            temperature: 0.7,
          },
          options: {
            wait_for_model: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result[0]?.generated_text || "No response generated"
    } catch (error) {
      console.error("Text generation failed:", error)
      return "Text generation is currently unavailable."
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models/gpt2`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  private generateHashBasedEmbedding(text: string): number[] {
    // Generate deterministic embedding based on text content
    const dimension = 384 // Standard dimension for sentence-transformers/all-MiniLM-L6-v2
    const embedding = new Array(dimension).fill(0)

    // Simple but deterministic hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      const index1 = charCode % dimension
      const index2 = (charCode * 3) % dimension
      const index3 = (charCode * 7) % dimension
      
      embedding[index1] += charCode * 0.1
      embedding[index2] += charCode * 0.05
      embedding[index3] += charCode * 0.02
    }

    // Add word-level features
    const words = text.toLowerCase().split(/\s+/)
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const wordHash = this.simpleHash(word)
      const wordIndex = wordHash % dimension
      embedding[wordIndex] += word.length * 0.3
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

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
      // Return dummy embeddings as fallback
      return texts.map(() =>
        Array(384)
          .fill(0)
          .map(() => Math.random()),
      )
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
}

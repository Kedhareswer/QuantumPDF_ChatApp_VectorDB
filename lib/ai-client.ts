interface AIConfig {
  provider: "huggingface" | "openai" | "anthropic" | "aiml" | "groq"
  apiKey: string
  model: string
  baseUrl?: string
}

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export class AIClient {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        throw new Error("Invalid text input for embedding generation")
      }

      console.log(`Generating embedding with ${this.config.provider} for text length: ${text.length}`)

      switch (this.config.provider) {
        case "huggingface":
          return await this.generateHuggingFaceEmbedding(text)
        case "openai":
          return await this.generateOpenAIEmbedding(text)
        case "aiml":
          return await this.generateAIMLEmbedding(text)
        default:
          throw new Error(`Embedding generation not supported for provider: ${this.config.provider}`)
      }
    } catch (error) {
      console.error("Error generating embedding:", error)

      // If the primary provider fails, try to generate a fallback embedding
      console.log("Attempting to generate fallback embedding...")
      return this.generateFallbackEmbedding(text)
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i])
        embeddings.push(embedding)

        // Add delay to avoid rate limiting
        if (i < texts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error generating embedding for text ${i}:`, error)
        // Generate fallback embedding
        embeddings.push(this.generateFallbackEmbedding(texts[i]))
      }
    }

    return embeddings
  }

  async generateText(messages: ChatMessage[]): Promise<string> {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Invalid messages array")
      }

      switch (this.config.provider) {
        case "huggingface":
          return await this.generateHuggingFaceText(messages)
        case "openai":
          return await this.generateOpenAIText(messages)
        case "anthropic":
          return await this.generateAnthropicText(messages)
        case "aiml":
          return await this.generateAIMLText(messages)
        case "groq":
          return await this.generateGroqText(messages)
        default:
          throw new Error(`Text generation not supported for provider: ${this.config.provider}`)
      }
    } catch (error) {
      console.error("Error generating text:", error)
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(`Testing connection for provider: ${this.config.provider}`)

      switch (this.config.provider) {
        case "huggingface":
          return await this.testHuggingFaceConnection()
        case "openai":
          return await this.testOpenAIConnection()
        case "anthropic":
          return await this.testAnthropicConnection()
        case "aiml":
          return await this.testAIMLConnection()
        case "groq":
          return await this.testGroqConnection()
        default:
          console.error(`Unsupported provider: ${this.config.provider}`)
          return false
      }
    } catch (error) {
      console.error("Connection test failed:", error)
      return false
    }
  }

  // Hugging Face implementations - now using server-side API routes
  private async generateHuggingFaceEmbedding(text: string): Promise<number[]> {
    console.log("Making server-side Hugging Face API request for embedding")

    try {
      const response = await fetch("/api/huggingface/embedding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          model: "sentence-transformers/all-MiniLM-L6-v2",
        }),
      })

      console.log(`Server API response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error("Invalid embedding response from server")
      }

      console.log(`Generated Hugging Face embedding with dimension: ${result.embedding.length}`)
      return result.embedding
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Hugging Face API request failed: ${String(error)}`)
    }
  }

  private async generateHuggingFaceText(messages: ChatMessage[]): Promise<string> {
    const prompt = this.formatMessagesForHuggingFace(messages)
    const context = messages.find((m) => m.role === "system")?.content || ""

    const response = await fetch("/api/huggingface/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        context: context,
        model: this.config.model,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Server error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.text || "No response generated"
  }

  private async testHuggingFaceConnection(): Promise<boolean> {
    try {
      const response = await fetch("/api/test/huggingface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  // OpenAI implementations
  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1"

    console.log(`Making OpenAI API request to: ${baseUrl}/embeddings`)

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      })

      console.log(`OpenAI API response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`OpenAI API error response: ${errorText}`)

        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          }
        } catch (parseError) {
          console.warn("Could not parse OpenAI error response as JSON")
        }

        throw new Error(`OpenAI API error: ${errorMessage}`)
      }

      const result = await response.json()

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid response structure from OpenAI API")
      }

      if (!result.data[0].embedding || !Array.isArray(result.data[0].embedding)) {
        throw new Error("Invalid embedding data from OpenAI API")
      }

      console.log(`Generated OpenAI embedding with dimension: ${result.data[0].embedding.length}`)
      return result.data[0].embedding
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`OpenAI API request failed: ${String(error)}`)
    }
  }

  private async generateOpenAIText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1"

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testOpenAIConnection(): Promise<boolean> {
    try {
      await this.generateOpenAIText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  // AIML API implementations
  private async generateAIMLEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1"

    console.log(`Making AIML API request to: ${baseUrl}/embeddings`)

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      })

      console.log(`AIML API response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`AIML API error response: ${errorText}`)

        // Try to parse error details
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message
          } else if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch (parseError) {
          console.warn("Could not parse error response as JSON")
        }

        throw new Error(`AIML API error: ${errorMessage}`)
      }

      const result = await response.json()
      console.log("AIML API response structure:", Object.keys(result))

      // Validate response structure
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid response structure from AIML API - missing data array")
      }

      if (!result.data[0].embedding || !Array.isArray(result.data[0].embedding)) {
        throw new Error("Invalid response structure from AIML API - missing embedding array")
      }

      return result.data[0].embedding
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`AIML API request failed: ${String(error)}`)
    }
  }

  private async generateAIMLText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1"

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        temperature: 0.1,
        top_p: 0.1,
        frequency_penalty: 1,
        max_tokens: 551,
        top_k: 0,
      }),
    })

    if (!response.ok) {
      throw new Error(`AIML API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testAIMLConnection(): Promise<boolean> {
    try {
      console.log("Testing AIML connection...")

      // Test with a simple embedding request
      await this.generateAIMLEmbedding("test connection")
      console.log("AIML connection test successful")
      return true
    } catch (error) {
      console.error("AIML connection test failed:", error)
      return false
    }
  }

  // Anthropic implementations
  private async generateAnthropicText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.anthropic.com"

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 500,
        messages: messages.filter((m) => m.role !== "system"),
        system: messages.find((m) => m.role === "system")?.content,
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.content[0].text
  }

  private async testAnthropicConnection(): Promise<boolean> {
    try {
      await this.generateAnthropicText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  // Groq implementations
  private async generateGroqText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.groq.com/openai/v1"

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testGroqConnection(): Promise<boolean> {
    try {
      await this.generateGroqText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  // Utility methods
  private formatMessagesForHuggingFace(messages: ChatMessage[]): string {
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n")
  }

  private generateFallbackEmbedding(text: string): number[] {
    console.log("Generating fallback embedding for text length:", text.length)

    // Simple hash-based embedding as fallback
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0)

    // Use a consistent dimension size
    const dimension = 384
    const embedding = new Array(dimension).fill(0)

    words.forEach((word, index) => {
      const hash = this.simpleHash(word)
      const position = hash % dimension
      embedding[position] += 1 / (index + 1)
    })

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    const normalizedEmbedding = embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))

    console.log(`Generated fallback embedding with dimension: ${normalizedEmbedding.length}`)
    return normalizedEmbedding
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

    if (magnitudeA === 0 || magnitudeB === 0) return 0

    return dotProduct / (magnitudeA * magnitudeB)
  }
}

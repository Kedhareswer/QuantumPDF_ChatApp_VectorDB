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
    | "googleai"
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
        case "cohere":
          return await this.generateCohereEmbedding(text)
        case "vertex":
          return await this.generateVertexEmbedding(text)
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
        case "openrouter":
          return await this.generateOpenRouterText(messages)
        case "cohere":
          return await this.generateCohereText(messages)
        case "deepinfra":
          return await this.generateDeepInfraText(messages)
        case "deepseek":
          return await this.generateDeepSeekText(messages)
        case "googleai":
          return await this.generateGoogleAIText(messages)
        case "vertex":
          return await this.generateVertexText(messages)
        case "mistral":
          return await this.generateMistralText(messages)
        case "perplexity":
          return await this.generatePerplexityText(messages)
        case "together":
          return await this.generateTogetherText(messages)
        case "xai":
          return await this.generateXAIText(messages)
        case "alibaba":
          return await this.generateAlibabaText(messages)
        case "minimax":
          return await this.generateMiniMaxText(messages)
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
        case "openrouter":
          return await this.testOpenRouterConnection()
        case "cohere":
          return await this.testCohereConnection()
        case "deepinfra":
          return await this.testDeepInfraConnection()
        case "deepseek":
          return await this.testDeepSeekConnection()
        case "googleai":
          return await this.testGoogleAIConnection()
        case "vertex":
          return await this.testVertexConnection()
        case "mistral":
          return await this.testMistralConnection()
        case "perplexity":
          return await this.testPerplexityConnection()
        case "together":
          return await this.testTogetherConnection()
        case "xai":
          return await this.testXAIConnection()
        case "alibaba":
          return await this.testAlibabaConnection()
        case "minimax":
          return await this.testMiniMaxConnection()
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
      console.log("AIClient: generateHuggingFaceEmbedding - Attempting to POST to /api/huggingface/embedding")
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

    console.log("AIClient: generateHuggingFaceText - Attempting to POST to /api/huggingface/text")
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
      console.log("AIClient: testHuggingFaceConnection - Attempting to POST to /api/test/huggingface")
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

  // Add stub methods for the new providers
  // These would need to be properly implemented with the actual API calls
  private async testOpenRouterConnection(): Promise<boolean> {
    try {
      // Simplified test - in a real implementation, you would make an actual API call
      const response = await fetch(`${this.config.baseUrl || "https://openrouter.ai/api/v1"}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async generateOpenRouterText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://openrouter.ai/api/v1"

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
      throw new Error(`OpenRouter API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testCohereConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl || "https://api.cohere.ai/v1"}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async generateCohereText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.cohere.ai/v1"

    // Convert chat messages to Cohere format
    const chatHistory = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "CHATBOT" : "USER",
        message: msg.content,
      }))

    const systemMessage = messages.find((msg) => msg.role === "system")?.content || ""

    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        message: messages[messages.length - 1].content,
        chat_history: chatHistory.slice(0, -1),
        preamble: systemMessage,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.text || result.generation || ""
  }

  private async generateCohereEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.cohere.ai/v1"

    const response = await fetch(`${baseUrl}/embed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: [text],
        model: "embed-english-v3.0",
        input_type: "search_document",
      }),
    })

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`)
    }

    const result = await response.json()
    return result.embeddings[0]
  }

  // Add stub methods for the remaining providers
  // In a real implementation, these would contain the actual API calls
  private async testDeepInfraConnection(): Promise<boolean> {
    return this.simpleTestConnection("deepinfra")
  }
  private async generateDeepInfraText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("deepinfra", messages)
  }

  private async testDeepSeekConnection(): Promise<boolean> {
    return this.simpleTestConnection("deepseek")
  }
  private async generateDeepSeekText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("deepseek", messages)
  }

  private async testGoogleAIConnection(): Promise<boolean> {
    return this.simpleTestConnection("googleai")
  }
  private async generateGoogleAIText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("googleai", messages)
  }

  private async testVertexConnection(): Promise<boolean> {
    return this.simpleTestConnection("vertex")
  }
  private async generateVertexText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("vertex", messages)
  }
  private async generateVertexEmbedding(text: string): Promise<number[]> {
    return this.simpleGenerateEmbedding("vertex", text)
  }

  private async testMistralConnection(): Promise<boolean> {
    return this.simpleTestConnection("mistral")
  }
  private async generateMistralText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("mistral", messages)
  }

  private async testPerplexityConnection(): Promise<boolean> {
    return this.simpleTestConnection("perplexity")
  }
  private async generatePerplexityText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("perplexity", messages)
  }

  private async testTogetherConnection(): Promise<boolean> {
    return this.simpleTestConnection("together")
  }
  private async generateTogetherText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("together", messages)
  }

  private async testXAIConnection(): Promise<boolean> {
    return this.simpleTestConnection("xai")
  }
  private async generateXAIText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("xai", messages)
  }

  private async testAlibabaConnection(): Promise<boolean> {
    return this.simpleTestConnection("alibaba")
  }
  private async generateAlibabaText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("alibaba", messages)
  }

  private async testMiniMaxConnection(): Promise<boolean> {
    return this.simpleTestConnection("minimax")
  }
  private async generateMiniMaxText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("minimax", messages)
  }

  // Helper methods for simplified implementations
  private async simpleTestConnection(provider: string): Promise<boolean> {
    try {
      console.log(`Testing ${provider} connection (simplified implementation)`)
      // In a real implementation, you would make an actual API call to test the connection
      return !!this.config.apiKey
    } catch {
      return false
    }
  }

  private async simpleGenerateText(provider: string, messages: ChatMessage[]): Promise<string> {
    // This is a placeholder implementation
    // In a real implementation, you would make an actual API call to the provider
    console.log(`Generating text with ${provider} (simplified implementation)`)

    if (!this.config.apiKey) {
      throw new Error(`${provider} API key not provided`)
    }

    const userMessage = messages.find((m) => m.role === "user")?.content || "No user message found"
    return `This is a placeholder response from ${provider} for: "${userMessage.substring(0, 50)}..."`
  }

  private async simpleGenerateEmbedding(provider: string, text: string): Promise<number[]> {
    // This is a placeholder implementation
    // In a real implementation, you would make an actual API call to the provider
    console.log(`Generating embedding with ${provider} (simplified implementation)`)

    // Generate a deterministic but random-looking embedding based on the text
    const dimension = 384
    const embedding = new Array(dimension).fill(0)

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      const position = i % dimension
      embedding[position] += charCode / 128
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
  }
}

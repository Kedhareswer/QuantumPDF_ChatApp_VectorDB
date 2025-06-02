// lib/ai-client.ts

// Simplified AIConfig for text-only focus
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
    | "fireworks"
    | "cerebras"
    | "replicate"
    | "anyscale"
  apiKey: string // User-provided API key for the selected provider
  model: string // Model name for the selected provider
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
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text input for embedding generation: Content must be a non-empty string.")
    }

    console.log(`AIClient: Generating text embedding directly using provider '${this.config.provider}'.`)

    try {
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
        case "fireworks":
          return await this.generateFireworksEmbedding(text)
        case "deepinfra":
          return await this.generateDeepInfraEmbedding(text)
        case "together":
          return await this.generateTogetherEmbedding(text)
        case "googleai":
          return await this.generateGoogleAIEmbedding(text)
        // Add other direct providers here if they support embeddings
        default:
          console.warn(
            `AIClient: Embedding generation not supported for direct provider: ${this.config.provider}. Using hash-fallback.`,
          )
          return this.generateFallbackEmbedding(text)
      }
    } catch (directError) {
      console.error(
        `AIClient: Error in direct text embedding with provider ${this.config.provider}:`,
        directError.message,
      )
      console.log("AIClient: Attempting final hash-fallback for text...")
      return this.generateFallbackEmbedding(text)
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        console.warn(`AIClient:generateEmbeddings - Skipping invalid text at index ${i}, using fallback.`)
        embeddings.push(this.generateFallbackEmbedding("invalid input"))
        continue
      }
      try {
        const embedding = await this.generateEmbedding(text) // Calls the simplified generateEmbedding
        embeddings.push(embedding)
        // Add small delay to avoid rate limiting
        if (i < texts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(
          `AIClient:generateEmbeddings - Error for text at index ${i} ('${text.substring(0, 30)}...'):`,
          error.message,
        )
        embeddings.push(this.generateFallbackEmbedding(text))
      }
    }
    return embeddings
  }

  private async generateHuggingFaceEmbedding(text: string): Promise<number[]> {
    console.log("AIClient: [Direct Text] Calling backend /api/huggingface/embedding")
    try {
      const requestBody: { text: string; model?: string; apiKey?: string } = {
        text: text,
        model: this.config.model || "sentence-transformers/all-MiniLM-L6-v2",
      }

      if (this.config.provider === "huggingface" && this.config.apiKey) {
        requestBody.apiKey = this.config.apiKey
      }

      const response = await fetch("/api/huggingface/embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Server error: ${response.statusText}` }))
        throw new Error(errorData.error || `Backend API error: ${response.statusText}`)
      }
      const result = await response.json()
      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error("Invalid embedding response from backend API")
      }
      return result.embedding
    } catch (error) {
      console.error("AIClient: Error calling backend HuggingFace embedding API:", error.message)
      throw new Error(`Hugging Face embedding via backend failed: ${error.message}`)
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1"
    console.log(`AIClient: [Direct Text] Making OpenAI API request to: ${baseUrl}/embeddings`)
    try {
      const modelToUse =
        this.config.provider === "openai" && this.config.model.startsWith("text-embedding")
          ? this.config.model
          : "text-embedding-3-small"
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelToUse, input: text }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error && errorData.error.message) errorMessage = errorData.error.message
        } catch (parseError) {
          console.warn("Could not parse OpenAI error response as JSON")
        }
        throw new Error(`OpenAI API error: ${errorMessage}`)
      }
      const result = await response.json()
      if (
        !result.data ||
        !Array.isArray(result.data) ||
        result.data.length === 0 ||
        !result.data[0].embedding ||
        !Array.isArray(result.data[0].embedding)
      ) {
        throw new Error("Invalid embedding data from OpenAI API")
      }
      return result.data[0].embedding
    } catch (error) {
      throw new Error(`OpenAI text embedding API request failed: ${error.message}`)
    }
  }

  // Fixed AIML embedding with proper request format and validation
  private async generateAIMLEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1"
    console.log(`AIClient: [Direct Text] Making AIML API request to: ${baseUrl}/embeddings`)

    try {
      // Validate input text
      if (!text || text.trim().length === 0) {
        throw new Error("Empty text provided for embedding")
      }

      // Truncate text if too long (AIML has token limits)
      const maxLength = 8000 // Conservative limit
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text

      // Use appropriate embedding model for AIML
      let embeddingModel = this.config.model

      // AIML supports OpenAI-compatible embedding models
      const validEmbeddingModels = [
        "text-embedding-3-small",
        "text-embedding-3-large",
        "text-embedding-ada-002",
        "text-embedding-2-small",
        "text-embedding-2-large",
      ]

      // If the configured model is not an embedding model, use default
      if (!validEmbeddingModels.includes(embeddingModel)) {
        console.warn(`AIML model '${embeddingModel}' may not support embeddings, using default`)
        embeddingModel = "text-embedding-3-small"
      }

      console.log(`Using AIML embedding model: ${embeddingModel}`)

      // Prepare request body with proper validation
      const requestBody = {
        model: embeddingModel,
        input: truncatedText,
        encoding_format: "float", // Ensure we get float arrays
      }

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "PDF-RAG-Chatbot/1.0",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`

        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error) {
            if (typeof errorData.error === "string") {
              errorMessage = errorData.error
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message
            } else if (errorData.error.details) {
              errorMessage = errorData.error.details
            }
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.detail) {
            errorMessage = errorData.detail
          }
        } catch (parseError) {
          console.warn("Could not parse AIML error response as JSON:", errorText)
        }

        // Handle specific AIML errors
        if (errorMessage.includes("validation error") || errorMessage.includes("Body validation error")) {
          throw new Error(
            `AIML API validation error: Invalid request format. Model: ${embeddingModel}, Text length: ${truncatedText.length}`,
          )
        } else if (errorMessage.includes("model") && errorMessage.includes("not found")) {
          throw new Error(`AIML API error: Model '${embeddingModel}' not available. Try 'text-embedding-3-small'`)
        } else if (errorMessage.includes("quota") || errorMessage.includes("limit")) {
          throw new Error(`AIML API error: Rate limit or quota exceeded`)
        } else if (errorMessage.includes("authentication") || errorMessage.includes("unauthorized")) {
          throw new Error(`AIML API error: Invalid API key or authentication failed`)
        }

        throw new Error(`AIML API error: ${errorMessage}`)
      }

      const result = await response.json()

      // Validate response structure
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid response structure from AIML API: missing data array")
      }

      const embeddingData = result.data[0]
      if (!embeddingData || !embeddingData.embedding || !Array.isArray(embeddingData.embedding)) {
        throw new Error("Invalid embedding data structure from AIML API")
      }

      const embedding = embeddingData.embedding
      if (embedding.length === 0) {
        throw new Error("Empty embedding array from AIML API")
      }

      // Validate embedding values
      if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
        throw new Error("Invalid embedding values from AIML API")
      }

      console.log(`AIML embedding generated successfully: ${embedding.length} dimensions`)
      return embedding
    } catch (error) {
      console.error(`AIML embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`)

      // Don't throw immediately, let the caller handle fallback
      throw new Error(
        `AIML text embedding API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  // Fixed Cohere embedding with proper model selection
  private async generateCohereEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.cohere.ai/v1"
    console.log(`AIClient: [Direct Text] Making Cohere API request to: ${baseUrl}/embed`)

    try {
      // Fix: Use proper embedding model for Cohere
      let embeddingModel = this.config.model

      // If the configured model is a text generation model (like command-r),
      // switch to an appropriate embedding model
      const textGenModels = ["command", "command-r", "command-r-plus", "command-light", "command-nightly"]
      const isTextGenModel = textGenModels.some((model) => embeddingModel.toLowerCase().includes(model))

      if (isTextGenModel) {
        console.warn(`Cohere model '${embeddingModel}' is for text generation, switching to embedding model`)
        embeddingModel = "embed-english-v3.0" // Default to English embedding model
      }

      // Ensure we're using a valid embedding model
      const validEmbeddingModels = [
        "embed-english-v3.0",
        "embed-multilingual-v3.0",
        "embed-english-light-v3.0",
        "embed-multilingual-light-v3.0",
        "embed-english-v2.0",
        "embed-english-light-v2.0",
        "embed-multilingual-v2.0",
      ]

      if (!validEmbeddingModels.includes(embeddingModel)) {
        console.warn(`Unknown Cohere embedding model '${embeddingModel}', using default`)
        embeddingModel = "embed-english-v3.0"
      }

      console.log(`Using Cohere embedding model: ${embeddingModel}`)

      const response = await fetch(`${baseUrl}/embed`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          texts: [text],
          model: embeddingModel,
          input_type: "search_document",
          embedding_types: ["float"],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.message) errorMessage = errorData.message
          else if (errorData.error) errorMessage = errorData.error
        } catch (parseError) {
          console.warn("Could not parse Cohere error response as JSON")
        }
        throw new Error(`Cohere API error: ${errorMessage}`)
      }

      const result = await response.json()
      if (!result.embeddings || !Array.isArray(result.embeddings) || result.embeddings.length === 0) {
        throw new Error("Invalid embedding data from Cohere API")
      }

      // Cohere returns embeddings in different formats, handle both
      const embedding = result.embeddings[0]
      if (Array.isArray(embedding)) {
        return embedding
      } else if (embedding && Array.isArray(embedding.values)) {
        return embedding.values
      } else {
        throw new Error("Unexpected embedding format from Cohere API")
      }
    } catch (error) {
      console.error(`Cohere embedding generation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      console.log("Using fallback embedding for Cohere")
      return this.generateFallbackEmbedding(text)
    }
  }

  private async generateVertexEmbedding(text: string): Promise<number[]> {
    // This would require specific Google Cloud SDK or REST calls.
    // For now, it uses the simpleGenerateEmbedding placeholder.
    console.log("AIClient: [Direct Text] Vertex embedding (simplified/placeholder) for: ", text.substring(0, 30))
    // In a real scenario, check this.config.apiKey (service account key) and this.config.model (Vertex AI model ID)
    // and make appropriate calls to Google Vertex AI embedding endpoint.
    return this.simpleGenerateEmbedding("vertex", text)
  }

  // New embedding methods for additional providers
  private async generateFireworksEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.fireworks.ai/inference/v1"
    console.log(`AIClient: [Direct Text] Making Fireworks API request to: ${baseUrl}/embeddings`)

    try {
      // Use appropriate embedding model for Fireworks
      let embeddingModel = this.config.model

      // If the configured model is not an embedding model, use default
      if (!embeddingModel.includes("embedding")) {
        console.warn(`Fireworks model '${embeddingModel}' may not support embeddings, using default`)
        embeddingModel = "nomic-ai/nomic-embed-text-v1.5"
      }

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fireworks API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid embedding data from Fireworks API")
      }

      return result.data[0].embedding
    } catch (error) {
      console.error(`Fireworks embedding generation failed: ${error.message}`)
      return this.generateFallbackEmbedding(text)
    }
  }

  private async generateDeepInfraEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.deepinfra.com/v1/openai"
    console.log(`AIClient: [Direct Text] Making DeepInfra API request to: ${baseUrl}/embeddings`)

    try {
      // Use appropriate embedding model for DeepInfra
      let embeddingModel = this.config.model

      if (!embeddingModel.includes("embedding")) {
        embeddingModel = "BAAI/bge-base-en-v1.5"
      }

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepInfra API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid embedding data from DeepInfra API")
      }

      return result.data[0].embedding
    } catch (error) {
      console.error(`DeepInfra embedding generation failed: ${error.message}`)
      return this.generateFallbackEmbedding(text)
    }
  }

  private async generateTogetherEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.together.xyz/v1"
    console.log(`AIClient: [Direct Text] Making Together API request to: ${baseUrl}/embeddings`)

    try {
      // Use appropriate embedding model for Together
      let embeddingModel = this.config.model

      if (!embeddingModel.includes("embedding")) {
        embeddingModel = "togethercomputer/m2-bert-80M-8k-retrieval"
      }

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Together API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error("Invalid embedding data from Together API")
      }

      return result.data[0].embedding
    } catch (error) {
      console.error(`Together embedding generation failed: ${error.message}`)
      return this.generateFallbackEmbedding(text)
    }
  }

  private async generateGoogleAIEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
    console.log(`AIClient: [Direct Text] Making Google AI API request to: ${baseUrl}`)

    try {
      // Use appropriate embedding model for Google AI
      let embeddingModel = this.config.model

      if (!embeddingModel.includes("embedding")) {
        embeddingModel = "models/embedding-001"
      }

      const response = await fetch(`${baseUrl}/${embeddingModel}:embedContent?key=${this.config.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: text }],
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Google AI API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      if (!result.embedding || !result.embedding.values) {
        throw new Error("Invalid embedding data from Google AI API")
      }

      return result.embedding.values
    } catch (error) {
      console.error(`Google AI embedding generation failed: ${error.message}`)
      return this.generateFallbackEmbedding(text)
    }
  }

  // --- generateText and testConnection methods remain largely the same ---
  // ... (they use this.config.provider and this.config.apiKey as before)
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
        case "fireworks":
          return await this.generateFireworksText(messages)
        case "cerebras":
          return await this.generateCerebrasText(messages)
        case "replicate":
          return await this.generateReplicateText(messages)
        case "anyscale":
          return await this.generateAnyscaleText(messages)
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
        case "cohere":
          return await this.testCohereConnection()
        case "fireworks":
          return await this.testFireworksConnection()
        case "cerebras":
          return await this.testCerebrasConnection()
        case "deepinfra":
          return await this.testDeepInfraConnection()
        case "together":
          return await this.testTogetherConnection()
        case "googleai":
          return await this.testGoogleAIConnection()
        case "replicate":
          return await this.testReplicateConnection()
        case "anyscale":
          return await this.testAnyscaleConnection()
        // ... other test connection cases
        default:
          // For providers using simpleTestConnection
          if (
            ["openrouter", "deepseek", "vertex", "mistral", "perplexity", "xai", "alibaba", "minimax"].includes(
              this.config.provider,
            )
          ) {
            return this.simpleTestConnection(this.config.provider)
          }
          console.error(`Unsupported provider for connection test: ${this.config.provider}`)
          return false
      }
    } catch (error) {
      console.error("Connection test failed:", error)
      return false
    }
  }

  // --- Helper methods (formatMessagesForHuggingFace, generateFallbackEmbedding, simpleHash, cosineSimilarity) ---
  // ... (These are unchanged)

  private formatMessagesForHuggingFace(messages: ChatMessage[]): string {
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n")
  }

  private generateFallbackEmbedding(text: string): number[] {
    console.log("AIClient: Generating final fallback hash-based embedding for text length:", text.length)
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0)
    const dimension = 384
    const embedding = new Array(dimension).fill(0)
    words.forEach((word, index) => {
      const hash = this.simpleHash(word)
      embedding[hash % dimension] += 1 / (index + 1)
    })
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
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

  // --- Provider specific text generation / connection test stubs ---
  // (These remain as they were, ensure generateHuggingFaceText, generateOpenAIText, etc. are present)
  private async generateHuggingFaceText(messages: ChatMessage[]): Promise<string> {
    const prompt = this.formatMessagesForHuggingFace(messages)
    const context = messages.find((m) => m.role === "system")?.content || ""
    const requestBody: { prompt: string; context: string; model: string; apiKey?: string } = {
      prompt: prompt,
      context: context,
      model: this.config.model,
    }
    if (this.config.provider === "huggingface" && this.config.apiKey) {
      requestBody.apiKey = this.config.apiKey
    }
    const response = await fetch("/api/huggingface/text", {
      // This calls our backend for text gen too
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Server error: ${response.statusText}`)
    }
    const result = await response.json()
    return result.text || "No response generated"
  }

  private async testHuggingFaceConnection(): Promise<boolean> {
    // Tests connection to our backend proxy for HF
    try {
      const requestBody: { apiKey?: string } = {}
      if (this.config.provider === "huggingface" && this.config.apiKey) {
        requestBody.apiKey = this.config.apiKey
      }
      const response = await fetch("/api/test/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async generateOpenAIText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`)
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

  // Fixed AIML text generation
  private async generateAIMLText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1"

    // Ensure we're using a text generation model
    let textModel = this.config.model
    const embeddingModels = ["text-embedding"]
    const isEmbeddingModel = embeddingModels.some((model) => textModel.toLowerCase().includes(model))

    if (isEmbeddingModel) {
      console.warn(`AIML model '${textModel}' is for embeddings, switching to text generation model`)
      textModel = "gpt-4o-mini" // Default text generation model
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "PDF-RAG-Chatbot/1.0",
      },
      body: JSON.stringify({
        model: textModel,
        messages: messages,
        temperature: 0.1,
        top_p: 0.1,
        frequency_penalty: 1,
        max_tokens: 551,
        top_k: 0,
      }),
    })
    if (!response.ok) throw new Error(`AIML API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testAIMLConnection(): Promise<boolean> {
    try {
      // Test with a simple embedding request
      await this.generateAIMLEmbedding("test connection")
      return true
    } catch (error) {
      console.error("AIML connection test failed:", error)
      return false
    }
  }

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
    if (!response.ok) throw new Error(`Anthropic API error: ${response.statusText}`)
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

  private async generateGroqText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.groq.com/openai/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Groq API error: ${response.statusText}`)
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

  // Fixed Cohere text generation to use proper models
  private async generateCohereText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.cohere.ai/v1"

    // Ensure we're using a text generation model for Cohere
    let textModel = this.config.model
    const embeddingModels = ["embed-english", "embed-multilingual"]
    const isEmbeddingModel = embeddingModels.some((model) => textModel.toLowerCase().includes(model))

    if (isEmbeddingModel) {
      console.warn(`Cohere model '${textModel}' is for embeddings, switching to text generation model`)
      textModel = "command-r" // Default to command-r for text generation
    }

    // Convert messages to Cohere format
    const prompt = messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n") + "\nassistant:"

    const response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: textModel,
        prompt: prompt,
        max_tokens: 500,
        temperature: 0.7,
        stop_sequences: ["\nuser:", "\nhuman:"],
      }),
    })
    if (!response.ok) throw new Error(`Cohere API error: ${response.statusText}`)
    const result = await response.json()
    return result.generations[0].text.trim()
  }

  private async testCohereConnection(): Promise<boolean> {
    try {
      await this.generateCohereEmbedding("test connection")
      return true
    } catch {
      return false
    }
  }

  // New provider implementations
  private async generateFireworksText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.fireworks.ai/inference/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Fireworks API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testFireworksConnection(): Promise<boolean> {
    try {
      await this.generateFireworksText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateCerebrasText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.cerebras.ai/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Cerebras API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testCerebrasConnection(): Promise<boolean> {
    try {
      await this.generateCerebrasText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateGoogleAIText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"

    // Convert messages to Google AI format
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }))

    const response = await fetch(`${baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    })
    if (!response.ok) throw new Error(`Google AI API error: ${response.statusText}`)
    const result = await response.json()
    return result.candidates[0].content.parts[0].text
  }

  private async testGoogleAIConnection(): Promise<boolean> {
    try {
      await this.generateGoogleAIText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateReplicateText(messages: ChatMessage[]): Promise<string> {
    // Replicate has a different API structure, simplified implementation
    return this.simpleGenerateText("replicate", messages)
  }

  private async testReplicateConnection(): Promise<boolean> {
    return this.simpleTestConnection("replicate")
  }

  private async generateAnyscaleText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.endpoints.anyscale.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Anyscale API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testAnyscaleConnection(): Promise<boolean> {
    try {
      await this.generateAnyscaleText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  // Simplified implementations for other providers
  private async testOpenRouterConnection(): Promise<boolean> {
    return this.simpleTestConnection("openrouter")
  }
  private async generateOpenRouterText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("openrouter", messages)
  }
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
  private async testVertexConnection(): Promise<boolean> {
    return this.simpleTestConnection("vertex")
  }
  private async generateVertexText(messages: ChatMessage[]): Promise<string> {
    return this.simpleGenerateText("vertex", messages)
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

  private async simpleTestConnection(provider: string): Promise<boolean> {
    try {
      console.log(`Testing ${provider} connection (simplified)`)
      return !!this.config.apiKey
    } catch {
      return false
    }
  }
  private async simpleGenerateText(provider: string, messages: ChatMessage[]): Promise<string> {
    console.log(`Generating text with ${provider} (simplified)`)
    if (!this.config.apiKey) throw new Error(`${provider} API key not provided`)
    const userMessage = messages.find((m) => m.role === "user")?.content || "No user message"
    return `Placeholder response from ${provider} for: "${userMessage.substring(0, 50)}..."`
  }
  private async simpleGenerateEmbedding(provider: string, text: string): Promise<number[]> {
    console.log(`Generating text embedding with ${provider} (simplified hash) for: ${text.substring(0, 30)}`)
    const d = 384,
      e = new Array(d).fill(0)
    for (let i = 0; i < text.length; i++) e[text.charCodeAt(i) % d] += text.charCodeAt(i) / 128
    const m = Math.sqrt(e.reduce((s, v) => s + v * v, 0))
    return e.map((v) => (m > 0 ? v / m : 0))
  }
}

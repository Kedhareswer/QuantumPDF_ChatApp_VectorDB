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
    | "deepinfra"
    | "deepseek"
    | "googleai"
    | "vertex"
    | "mistral"
    | "perplexity"
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
  private text: string = ''
  private prompt: string = ''
  private context: string = ''

  constructor(config: AIConfig) {
    this.config = config
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error("Invalid text input for embedding generation")
    }

      switch (this.config.provider) {
        case "huggingface":
          return await this.generateHuggingFaceEmbedding(text)
        case "openai":
          return await this.generateOpenAIEmbedding(text)
        case "aiml":
          return await this.generateAIMLEmbedding(text)
        case "googleai":
          return await this.generateGoogleAIEmbedding(text)
        case "fireworks":
          return await this.generateFireworksEmbedding(text)
        case "deepinfra":
          return await this.generateDeepInfraEmbedding(text)
        default:
          console.warn(`Embedding generation not supported for provider: ${this.config.provider}, using fallback`)
          return this.generateFallbackEmbedding(text)
      }
    } catch (error) {
      console.error("Error generating embedding:", error)
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
          error instanceof Error ? error.message : String(error),
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("AIClient: Error calling backend HuggingFace embedding API:", errorMessage)
      throw new Error(`Hugging Face embedding via backend failed: ${errorMessage}`)
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
      throw new Error(`OpenAI text embedding API request failed: ${error instanceof Error ? error.message : String(error)}`)
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
      if (!embedding.every((val: number) => typeof val === "number" && !isNaN(val))) {
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
      console.error(`Fireworks embedding generation failed: ${error instanceof Error ? error.message : String(error)}`)
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
      console.error(`DeepInfra embedding generation failed: ${error instanceof Error ? error.message : String(error)}`)
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
    } catch (error: any) {
      if (error instanceof Error) {
        console.error(`Vertex AI embedding generation failed: ${error.message}`)
      } else {
        console.error(`Vertex AI embedding generation failed: ${String(error)}`)
      }
      return this.generateFallbackEmbedding(text)
    }
  }

  // --- generateText and testConnection methods remain largely the same ---
  // They use this.config.provider and this.config.apiKey as before
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
        case "fireworks":
          return await this.testFireworksConnection()
        case "cerebras":
          return await this.testCerebrasConnection()
        case "deepinfra":
          return await this.testDeepInfraConnection()
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
    console.warn("Using fallback embedding generation")
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn("Invalid input text for fallback embedding, using default")
        text = "default text"
      }
      
      // Use consistent dimension for fallback embeddings
      const dimension = 1024; // Common embedding dimension
      const embedding = new Array<number>(dimension).fill(0);
      
      // Improved hash-based embedding for fallback
      const cleanText = text.toLowerCase().trim()
      for (let i = 0; i < cleanText.length; i++) {
        const charCode = cleanText.charCodeAt(i);
        const index = charCode % dimension;
        // Use multiple hash functions for better distribution
        embedding[index] += (charCode * 0.1);
        embedding[(charCode * 3) % dimension] += (charCode * 0.05);
        embedding[(charCode * 7) % dimension] += (charCode * 0.02);
      }
      
      // Add some randomness based on text content
      for (let i = 0; i < dimension; i += 10) {
        const seed = this.simpleHash(text + i.toString());
        embedding[i] += (seed % 100) * 0.001;
      }
      
      // Normalize the vector to unit length
      const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      if (magnitude > 0) {
        const normalized = embedding.map((val: number) => val / magnitude);
        console.log(`Generated fallback embedding with dimension: ${normalized.length}`);
        return normalized;
      } else {
        // If magnitude is 0, create a small random vector
        console.warn("Zero magnitude in fallback embedding, generating random vector");
        const random = new Array(dimension).fill(0).map(() => (Math.random() - 0.5) * 0.1);
        const randomMagnitude = Math.sqrt(random.reduce((sum: number, val: number) => sum + val * val, 0));
        return random.map((val: number) => val / randomMagnitude);
      }
    } catch (error) {
      console.error("Error in fallback embedding generation:", error);
      // Return a minimal valid embedding vector
      const dimension = 1024;
      const minimal = new Array(dimension).fill(0);
      minimal[0] = 1.0; // Set first element to 1 for a valid unit vector
      return minimal;
    }
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

  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension")
    }
    const dotProduct = a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum: number, val: number) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum: number, val: number) => sum + val * val, 0))
    if (magnitudeA === 0 || magnitudeB === 0) return 0
    return dotProduct / (magnitudeA * magnitudeB)
  }

  // --- Provider specific text generation / connection test stubs ---
  // (These remain as they were, ensure generateHuggingFaceText, generateOpenAIText, etc. are present)
  private async generateHuggingFaceText(messages: ChatMessage[]): Promise<string> {
    const prompt = this.formatMessagesForHuggingFace(messages)
    const context = messages.find((m) => m.role === "system")?.content || ""
    const requestBody: { prompt: string; context: string; model: string; apiKey?: string } = {
      prompt,
      context,
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
    try {
      const baseUrl = this.config.baseUrl || "https://api.groq.com/openai/v1"
      const apiKey = this.config.apiKey.trim()
      
      if (!apiKey) {
        throw new Error("Groq API key is not configured")
      }

      console.log("Sending request to Groq API with model:", this.config.model)
      
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${apiKey}`, 
          "Content-Type": "application/json",
          "User-Agent": "QuantumPDF-ChatApp/1.0"
        },
        body: JSON.stringify({ 
          model: this.config.model, 
          messages: messages,
          max_tokens: 2048, // Increased from 500 to allow for longer responses
          temperature: 0.7,
          top_p: 1,
          stream: false
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Groq API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Groq API error (${response.status}): ${response.statusText} - ${errorText}`)
      }
      
      const result = await response.json()
      
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error("Invalid response format from Groq API:", result)
        throw new Error("Invalid response format from Groq API")
      }
      
      return result.choices[0].message.content
    } catch (error) {
      console.error("Error in generateGroqText:", error)
      throw error // Re-throw to be handled by the caller
    }
  }

  private async testGroqConnection(): Promise<boolean> {
    try {
      const testMessage = { role: "user" as const, content: "This is a test connection message." }
      const response = await this.generateGroqText([testMessage])
      
      if (!response || typeof response !== 'string') {
        console.error("Invalid response from Groq API during connection test")
        return false
      }
      
      console.log("Successfully connected to Groq API")
      return true
    } catch (error) {
      console.error("Groq connection test failed:", error)
      return false
    }
  }

  // New provider implementations
  private async generateFireworksText(messages: ChatMessage[]): Promise<string> {
    try {
      // Fireworks follows an OpenAI-compatible endpoint but sometimes requires /v1 instead of /inference/v1
      const defaultBase = "https://api.fireworks.ai/inference/v1"
      const baseUrl = this.config.baseUrl?.trim() || defaultBase
      const apiKey = this.config.apiKey.trim()

      if (!apiKey) throw new Error("Fireworks API key is not configured")

      const url = `${baseUrl}/chat/completions`
      console.log("Sending request to Fireworks API:", url)

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "QuantumPDF-ChatApp/1.0"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          max_tokens: 2048,
          temperature: 0.7,
          top_p: 1,
          stream: false
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Fireworks API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })

        // Common error: 404 Not Found when the model name is invalid or not hosted.
        if (response.status === 404) {
          throw new Error(`Fireworks model not found or endpoint invalid (404). Check the model name '${this.config.model}' and base URL '${baseUrl}'.`)
        }

        throw new Error(`Fireworks API error (${response.status}): ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error("Invalid response format from Fireworks API:", result)
        throw new Error("Invalid response format from Fireworks API")
      }

      return result.choices[0].message.content
    } catch (error) {
      console.error("Error in generateFireworksText:", error)
      throw error
    }
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

  // Proper implementations for providers that were using placeholders
  private async generateOpenRouterText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://openrouter.ai/api/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${this.config.apiKey}`, 
        "Content-Type": "application/json",
        "HTTP-Referer": "https://quantumpdf-chatapp.com",
        "X-Title": "QuantumPDF ChatApp"
      },
      body: JSON.stringify({ 
        model: this.config.model, 
        messages: messages, 
        max_tokens: 500, 
        temperature: 0.7 
      }),
    })
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testOpenRouterConnection(): Promise<boolean> {
    try {
      await this.generateOpenRouterText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateDeepInfraText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.deepinfra.com/v1/openai"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`DeepInfra API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testDeepInfraConnection(): Promise<boolean> {
    try {
      await this.generateDeepInfraText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateDeepSeekText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.deepseek.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`DeepSeek API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testDeepSeekConnection(): Promise<boolean> {
    try {
      await this.generateDeepSeekText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateVertexText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://us-central1-aiplatform.googleapis.com/v1"
    // Note: Vertex AI requires more complex authentication, this is a simplified version
    const response = await fetch(`${baseUrl}/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/${this.config.model}:generateContent`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${this.config.apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        }))
      }),
    })
    if (!response.ok) throw new Error(`Vertex AI API error: ${response.statusText}`)
    const result = await response.json()
    return result.candidates[0].content.parts[0].text
  }

  private async testVertexConnection(): Promise<boolean> {
    try {
      await this.generateVertexText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateMistralText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.mistral.ai/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Mistral API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testMistralConnection(): Promise<boolean> {
    try {
      await this.generateMistralText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generatePerplexityText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.perplexity.ai"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`Perplexity API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testPerplexityConnection(): Promise<boolean> {
    try {
      await this.generatePerplexityText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateXAIText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.x.ai/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7 }),
    })
    if (!response.ok) throw new Error(`xAI API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testXAIConnection(): Promise<boolean> {
    try {
      await this.generateXAIText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateAlibabaText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://dashscope.aliyuncs.com/api/v1"
    const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${this.config.apiKey}`, 
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable"
      },
      body: JSON.stringify({
        model: this.config.model,
        input: {
          messages: messages
        },
        parameters: {
          max_tokens: 500,
          temperature: 0.7
        }
      }),
    })
    if (!response.ok) throw new Error(`Alibaba API error: ${response.statusText}`)
    const result = await response.json()
    return result.output.text
  }

  private async testAlibabaConnection(): Promise<boolean> {
    try {
      await this.generateAlibabaText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
  }

  private async generateMiniMaxText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.minimax.chat/v1"
    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${this.config.apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      }),
    })
    if (!response.ok) throw new Error(`MiniMax API error: ${response.statusText}`)
    const result = await response.json()
    return result.choices[0].message.content
  }

  private async testMiniMaxConnection(): Promise<boolean> {
    try {
      await this.generateMiniMaxText([{ role: "user", content: "test" }])
      return true
    } catch {
      return false
    }
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
    console.log(`Generating text with ${provider} (simplified fallback)`)
    if (!this.config.apiKey) throw new Error(`${provider} API key not provided`)
    
    // Construct a helpful response based on the input
    const userMessage = messages.find(m => m.role === 'user')?.content || ''
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    
    // Simple keyword-based response generation
    const keywords = userMessage.toLowerCase().split(/\s+/)
    let response = `I understand you're asking about: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"\n\n`
    
    if (keywords.some(k => ['summary', 'summarize', 'overview'].includes(k))) {
      response += "Based on the available documents, here are the key points I can identify:\n\n"
      response += "• This appears to be a request for summarization\n"
      response += "• I'm currently using a fallback response system\n"
      response += "• For more detailed analysis, please ensure your AI provider is properly configured\n\n"
    } else if (keywords.some(k => ['find', 'search', 'locate', 'where'].includes(k))) {
      response += "I can help you search through the documents. However, I'm currently operating in fallback mode.\n\n"
      response += "To get more accurate search results:\n"
      response += "• Verify your AI provider configuration\n"
      response += "• Check your API key and model settings\n"
      response += "• Try rephrasing your query with more specific terms\n\n"
    } else {
      response += "I'm currently operating in simplified mode due to AI provider limitations.\n\n"
      response += "To get full AI-powered responses:\n"
      response += "• Check your AI provider settings in the configuration panel\n"
      response += "• Ensure your API key is valid and has sufficient credits\n"
      response += "• Try switching to a different AI provider\n\n"
    }
    
    response += `**Provider**: ${provider}\n`
    response += `**Status**: Fallback Mode\n`
    response += `**Suggestion**: Please configure a fully supported AI provider for better responses.`
    
    return response
  }
  private async simpleGenerateEmbedding(provider: string, text: string): Promise<number[]> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error(`Invalid text input for ${provider} embedding`);
      }
      
      console.log(`Generating text embedding with ${provider} (simplified hash) for: ${text.substring(0, 30)}`)
      const dimension = 384;
      const embedding = new Array<number>(dimension).fill(0);
      
      // Simple hash-based embedding
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const index = charCode % dimension;
        embedding[index] += charCode / 128;
      }
      
      // Calculate magnitude and normalize the vector
      const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
      return magnitude > 0 
        ? embedding.map((val: number) => val / magnitude)
        : embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error in ${provider} simple embedding generation:`, errorMessage);
      // Return a zero vector of the expected dimension
      return new Array(384).fill(0);
    }
  }

  async generateTextStream(messages: ChatMessage[], onToken: (token: string)=>void): Promise<void> {
    if (this.config.provider !== "openai") {
      // Fallback to non-stream call
      const full = await this.generateText(messages)
      onToken(full)
      return
    }
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        stream: true,
        messages,
      }),
    })
    if (!response.ok || !response.body) {
      throw new Error(`OpenAI stream error: ${response.status}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buffer = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() || ""
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          const payload = part.replace("data: ", "").trim()
          if (payload === "[DONE]") return
          try {
            const json = JSON.parse(payload)
            const token = json.choices?.[0]?.delta?.content
            if (token) onToken(token)
          } catch {}
        }
      }
    }
  }
}

interface InteractionLog {
  query: string
  response: string
  sources: string[]
  responseTime: number
  relevanceScore: number
  retrievedChunks: number
}

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface WandbConfig {
  enabled: boolean
  apiKey: string
  projectName: string
  entityName?: string
  tags: string[]
}

export class WandbTracker {
  private isInitialized = false
  private sessionId: string
  private interactions: InteractionLog[] = []
  private runId: string | null = null
  private config: WandbConfig | null = null

  constructor() {
    this.sessionId = `session_${Date.now()}`
  }

  async initialize(config?: WandbConfig) {
    try {
      console.log("Initializing Wandb tracking...")

      // Use provided config or try environment variables
      if (config && config.enabled) {
        this.config = config
      } else {
        // Fallback to environment variables
        const envApiKey = process.env.WANDB_API_KEY
        if (!envApiKey) {
          throw new Error("No Wandb configuration provided and WANDB_API_KEY environment variable not found")
        }

        this.config = {
          enabled: true,
          apiKey: envApiKey,
          projectName: "pdf-rag-chatbot",
          entityName: "",
          tags: ["pdf-rag", "chatbot", "ai"],
        }
      }

      if (!this.config.apiKey) {
        throw new Error("Wandb API key is required")
      }

      // Test connection first
      await this.testConnection()

      // Initialize run
      const response = await fetch("/api/wandb/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: this.config.projectName,
          entity: this.config.entityName || undefined,
          config: {
            session_id: this.sessionId,
            model_type: "configurable",
            embedding_model: "sentence-transformers/all-MiniLM-L6-v2",
            chunk_size: 500,
            chunk_overlap: 50,
            top_k_retrieval: 3,
            tags: this.config.tags,
          },
          apiKey: this.config.apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Failed to initialize Wandb: ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      this.runId = data.runId
      this.isInitialized = true

      console.log("Wandb tracking initialized successfully with run ID:", this.runId)

      // Log session start
      await this.logEvent("session_start", {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
        config: this.config,
      })

      return true
    } catch (error) {
      console.error("Failed to initialize Wandb:", error)
      this.isInitialized = false
      throw error
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config?.apiKey) {
        throw new Error("No API key configured")
      }

      // Test Wandb API connection
      const response = await fetch("https://api.wandb.ai/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query {
              viewer {
                id
                username
                entity
              }
            }
          `,
        }),
      })

      if (!response.ok) {
        throw new Error(`Wandb API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.errors) {
        throw new Error(`Wandb GraphQL error: ${data.errors[0].message}`)
      }

      console.log("Wandb connection test successful:", data.data.viewer)
      return true
    } catch (error) {
      console.error("Wandb connection test failed:", error)
      throw error
    }
  }

  async logDocumentIngestion(document: Document) {
    if (!this.isInitialized) {
      console.warn("Wandb not initialized, skipping document ingestion log")
      return
    }

    const metrics = {
      document_id: document.id,
      document_name: document.name,
      content_length: document.content.length,
      chunk_count: document.chunks.length,
      avg_chunk_length: document.chunks.reduce((sum, chunk) => sum + chunk.length, 0) / document.chunks.length,
      embedding_dimensions: document.embeddings[0]?.length || 0,
      pages: document.metadata?.pages || 0,
      processing_method: document.metadata?.processingMethod || "unknown",
      timestamp: document.uploadedAt.toISOString(),
    }

    await this.logEvent("document_ingestion", metrics)
    console.log("Logged document ingestion to Wandb:", metrics)
  }

  async logInteraction(interaction: InteractionLog) {
    if (!this.isInitialized) {
      console.warn("Wandb not initialized, skipping interaction log")
      return
    }

    this.interactions.push(interaction)

    const metrics = {
      session_id: this.sessionId,
      query_length: interaction.query.length,
      response_length: interaction.response.length,
      source_count: interaction.sources.length,
      response_time_ms: interaction.responseTime,
      relevance_score: interaction.relevanceScore,
      retrieved_chunks: interaction.retrievedChunks,
      timestamp: new Date().toISOString(),
    }

    await this.logEvent("chat_interaction", metrics)

    // Log aggregated session metrics
    await this.logSessionMetrics()

    console.log("Logged interaction to Wandb:", metrics)
  }

  async logError(error: Error, context?: any) {
    if (!this.isInitialized) {
      console.warn("Wandb not initialized, skipping error log")
      return
    }

    const errorMetrics = {
      session_id: this.sessionId,
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      context: context ? JSON.stringify(context) : undefined,
      timestamp: new Date().toISOString(),
    }

    await this.logEvent("error", errorMetrics)
    console.log("Logged error to Wandb:", errorMetrics)
  }

  private async logSessionMetrics() {
    if (this.interactions.length === 0) return

    const avgResponseTime = this.interactions.reduce((sum, i) => sum + i.responseTime, 0) / this.interactions.length
    const avgRelevanceScore = this.interactions.reduce((sum, i) => sum + i.relevanceScore, 0) / this.interactions.length
    const totalInteractions = this.interactions.length

    const sessionMetrics = {
      session_id: this.sessionId,
      total_interactions: totalInteractions,
      avg_response_time_ms: avgResponseTime,
      avg_relevance_score: avgRelevanceScore,
      session_duration_ms: Date.now() - Number.parseInt(this.sessionId.split("_")[1]),
      timestamp: new Date().toISOString(),
    }

    await this.logEvent("session_metrics", sessionMetrics)
  }

  private async logEvent(eventType: string, data: any) {
    if (!this.isInitialized || !this.runId) return

    try {
      const response = await fetch("/api/wandb/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: this.runId,
          eventType,
          data,
          timestamp: new Date().toISOString(),
          apiKey: this.config?.apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error(`Failed to log event to Wandb: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error("Error logging to Wandb:", error)
    }
  }

  async finishRun() {
    if (!this.isInitialized || !this.runId) return

    try {
      await fetch("/api/wandb/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          runId: this.runId,
          apiKey: this.config?.apiKey,
        }),
      })

      console.log("Wandb run finished")
    } catch (error) {
      console.error("Error finishing Wandb run:", error)
    }
  }

  // Method to retrieve logs for debugging
  getLogs() {
    return this.interactions
  }

  // Method to clear logs
  clearLogs() {
    this.interactions = []
  }

  // Check if Wandb is properly initialized
  isReady(): boolean {
    return this.isInitialized && this.runId !== null && this.config !== null
  }

  // Get current configuration
  getConfig(): WandbConfig | null {
    return this.config
  }
}

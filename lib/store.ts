import { create } from "zustand"
import { persist } from "zustand/middleware"

interface RetrievedChunk {
  content: string
  source: string
  similarity: number
  documentId?: string
  documentName?: string
  page?: number
  bbox?: unknown
  level?: number
  chunkType?: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
  metadata?: {
    responseTime?: number
    relevanceScore?: number
    retrievedChunks?: RetrievedChunk[]
    qualityMetrics?: {
      accuracyScore: number
      completenessScore: number
      clarityScore: number
      confidenceScore: number
      finalRating: number
    }
    tokenUsage?: {
      contextTokens: number
      reasoningTokens: number
      responseTokens: number
      totalTokens: number
    }
    reasoning?: {
      initialThoughts: string
      criticalReview: string
      finalRefinement: string
    }
    queryAnalysis?: {
      originalQuery: string
      rewrittenQuery: string
      queryType: string
      complexity: "simple" | "moderate" | "complex"
      requiresHyDE: boolean
      requiresStepBack: boolean
      alternativeQueries: string[]
      hasHypotheticalAnswer: boolean
      hasStepBackQuestion: boolean
      confidence: number
    }
  }
}

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: unknown
}

export type AIProvider =
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

interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "local"
  apiKey?: string
  environment?: string
  indexName?: string
  url?: string
  collection?: string
  dimension?: number
}

interface AppError {
  id: string
  type: "error" | "warning" | "info" | "success"
  title: string
  message: string
  timestamp: Date
  dismissed?: boolean
}

interface AppState {
  // Core data
  messages: Message[]
  documents: Document[]

  // Configuration
  aiConfig: AIConfig
  vectorDBConfig: VectorDBConfig

  // UI state
  isProcessing: boolean
  modelStatus: "loading" | "ready" | "error" | "config"
  activeTab: string
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // Error handling
  errors: AppError[]

  // Actions
  addMessage: (message: Message) => void
  updateMessage: (id: string, partial: Partial<Message>) => void
  clearMessages: () => void
  addDocument: (document: Document) => void
  removeDocument: (id: string) => void
  clearDocuments: () => void
  setAIConfig: (config: AIConfig) => void
  setVectorDBConfig: (config: VectorDBConfig) => void
  setIsProcessing: (processing: boolean) => void
  setModelStatus: (status: "loading" | "ready" | "error" | "config") => void
  setActiveTab: (tab: string) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  addError: (error: Omit<AppError, "id" | "timestamp">) => void
  removeError: (id: string) => void
  clearErrors: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      messages: [],
      documents: [],
      aiConfig: {
        provider: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
        baseUrl: "https://api.openai.com/v1",
        temperature: 0.7,
        maxTokens: 1000,
      },
      vectorDBConfig: {
        provider: "local",
        dimension: 1536,
      },
      isProcessing: false,
      modelStatus: "config",
      activeTab: "settings",
      sidebarOpen: false,
      sidebarCollapsed: false,
      errors: [],

      // Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      updateMessage: (id, partial) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...partial } : m)),
        })),

      clearMessages: () => set({ messages: [] }),

      addDocument: (document) =>
        set((state) => ({
          documents: [...state.documents, document],
        })),

      removeDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
        })),

      clearDocuments: () => set({ documents: [] }),

      setAIConfig: (config) => {
        // Validate provider and fallback to openai if invalid
        const validProviders: AIProvider[] = [
          "huggingface", "openai", "anthropic", "aiml", "groq", "openrouter",
          "deepinfra", "deepseek", "googleai", "vertex", "mistral", "perplexity",
          "xai", "alibaba", "minimax", "fireworks", "cerebras"
        ];
        
        if (!validProviders.includes(config.provider)) {
          console.warn(`Invalid provider "${config.provider}", falling back to "openai"`);
          config = {
            ...config,
            provider: "openai",
            model: "gpt-4o-mini",
            baseUrl: "https://api.openai.com/v1"
          };
        }
        
        set({ aiConfig: config });
      },
      setVectorDBConfig: (config) => set({ vectorDBConfig: config }),
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      setModelStatus: (status) => set({ modelStatus: status }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      addError: (error) =>
        set((state) => ({
          errors: [
            ...state.errors,
            {
              ...error,
              id: Date.now().toString(),
              timestamp: new Date(),
            },
          ],
        })),

      removeError: (id) =>
        set((state) => ({
          errors: state.errors.filter((error) => error.id !== id),
        })),

      clearErrors: () => set({ errors: [] }),
    }),
    {
      name: "quantum-pdf-store",
      partialize: (state) => ({
        aiConfig: {
          ...state.aiConfig,
          apiKey: "",
        },
        vectorDBConfig: state.vectorDBConfig,
        sidebarCollapsed: state.sidebarCollapsed,
        activeTab: state.activeTab,
      }),
      // Add version and migration logic
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState
        }
        const state = persistedState as Record<string, unknown>

        if (version < 2) {
          const aiConfig = state.aiConfig
          if (aiConfig && typeof aiConfig === "object") {
            state.aiConfig = {
              ...(aiConfig as Record<string, unknown>),
              apiKey: "",
            }
          }
        }

        if (version === 0) {
          // Migration from version 0 to 1: fix invalid providers
          if (state.aiConfig && typeof state.aiConfig === "object") {
            const validProviders = [
              "huggingface", "openai", "anthropic", "aiml", "groq", "openrouter",
              "deepinfra", "deepseek", "googleai", "vertex", "mistral", "perplexity",
              "xai", "alibaba", "minimax", "fireworks", "cerebras", "replicate", "anyscale"
            ];

            const aiConfig = state.aiConfig as Record<string, unknown>
            const provider = typeof aiConfig.provider === "string" ? aiConfig.provider : ""

            if (!validProviders.includes(provider)) {
              console.warn(`Migrating invalid provider "${provider}" to "openai"`);
              state.aiConfig = {
                ...aiConfig,
                provider: "openai",
                model: "gpt-4o-mini",
                baseUrl: "https://api.openai.com/v1"
              };
            }
          }
        }

        if (version < 3) {
          // Anyscale Endpoints was shut down, and Replicate never had an
          // OpenAI-compatible chat endpoint for this client to call. Anyone
          // persisted onto either would otherwise sit on a provider the app no
          // longer implements. Stale *model* ids are handled separately by
          // MODEL_MIGRATIONS in lib/ai-client.ts, which remaps them at call time.
          const removedProviders = ["replicate", "anyscale"]
          const aiConfig = state.aiConfig as Record<string, unknown> | undefined
          if (aiConfig && typeof aiConfig === "object") {
            const provider = typeof aiConfig.provider === "string" ? aiConfig.provider : ""
            if (removedProviders.includes(provider)) {
              console.warn(`Provider "${provider}" was removed; migrating to "openai"`)
              state.aiConfig = {
                ...aiConfig,
                provider: "openai",
                model: "gpt-5.6-terra",
                baseUrl: "https://api.openai.com/v1",
              }
            }
          }
        }
        return state;
      },
    },
  ),
)

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
  metadata?: {
    responseTime?: number
    relevanceScore?: number
    retrievedChunks?: number
  }
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
  | "replicate"
  | "anyscale"

interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "chroma" | "local"
  apiKey?: string
  environment?: string
  indexName?: string
  url?: string
  collection?: string
  dimension?: number
}

interface WandbConfig {
  enabled: boolean
  apiKey: string
  projectName: string
  entityName?: string
  runName?: string
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
  wandbConfig: WandbConfig

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
  clearMessages: () => void
  addDocument: (document: Document) => void
  removeDocument: (id: string) => void
  clearDocuments: () => void
  setAIConfig: (config: AIConfig) => void
  setVectorDBConfig: (config: VectorDBConfig) => void
  setWandbConfig: (config: WandbConfig) => void
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
    (set, get) => ({
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
      wandbConfig: {
        enabled: false,
        apiKey: "",
        projectName: "pdf-rag-chatbot",
      },
      isProcessing: false,
      modelStatus: "config",
      activeTab: "documents",
      sidebarOpen: false,
      sidebarCollapsed: false,
      errors: [],

      // Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
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
          "xai", "alibaba", "minimax", "fireworks", "cerebras", "replicate", "anyscale"
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
      setWandbConfig: (config) => set({ wandbConfig: config }),
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
        aiConfig: state.aiConfig,
        vectorDBConfig: state.vectorDBConfig,
        wandbConfig: state.wandbConfig,
        sidebarCollapsed: state.sidebarCollapsed,
        activeTab: state.activeTab,
      }),
      // Add version and migration logic
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from version 0 to 1: fix invalid providers
          if (persistedState.aiConfig) {
            const validProviders = [
              "huggingface", "openai", "anthropic", "aiml", "groq", "openrouter",
              "deepinfra", "deepseek", "googleai", "vertex", "mistral", "perplexity",
              "xai", "alibaba", "minimax", "fireworks", "cerebras", "replicate", "anyscale"
            ];
            
            if (!validProviders.includes(persistedState.aiConfig.provider)) {
              console.warn(`Migrating invalid provider "${persistedState.aiConfig.provider}" to "openai"`);
              persistedState.aiConfig = {
                ...persistedState.aiConfig,
                provider: "openai",
                model: "gpt-4o-mini",
                baseUrl: "https://api.openai.com/v1"
              };
            }
          }
        }
        return persistedState;
      },
    },
  ),
)

"use client"

import {
    ConfigurationTestingSkeleton,
    VectorDatabaseLoadingSkeleton
} from "@/components/skeleton-loaders"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AIConfig } from "@/lib/ai-client"
import { useAppStore } from "@/lib/store"
import type { VectorDBConfig } from "@/lib/vector-database-types"
import { AlertTriangle, Check, Cpu, Database, ExternalLink, Eye, EyeOff, Info, Loader2, X, Zap } from "lucide-react"
import { useState } from "react"

// Updated: October 2026 — checked against each provider's official model and
// deprecation pages. Retiring an id here is not enough on its own: aiConfig is
// persisted to localStorage, so every removed id also needs a MODEL_MIGRATIONS
// entry in lib/ai-client.ts or existing users keep sending a model the API no
// longer knows.
//
// supportsEmbeddings must match PROVIDER_SPECS[...].embeddings in lib/ai-client.ts.
// Providers without it index documents with the local lexical embedding.
export const AI_PROVIDERS = {
  // Major Providers
  openai: {
    name: "OpenAI",
    description: "GPT-6.1 / GPT-6 and the GPT-5.6 Sol/Terra/Luna family (Oct 2026)",
    category: "Major",
    models: [
      "gpt-6.1-sol",       // Flagship (reasoning always on)
      "gpt-6-sol",         // Previous flagship
      "gpt-6-luna",        // Cheap/high-volume, GPT-6 generation
      "gpt-5.6-sol",       // `gpt-5.6` aliases here
      "gpt-5.6-terra",     // Balanced — no GPT-6 Terra yet
      "gpt-5.6-luna",      // Cheap
      "gpt-5.5",           // Previous-gen frontier, still active
      "gpt-4o-mini"        // Legacy cheap option, still active
    ],
    defaultModel: "gpt-5.6-terra",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.openai.com/v1",
    signupUrl: "https://platform.openai.com/api-keys",
    supportsEmbeddings: true,
    icon: "",
    features: ["Chat completion", "Embeddings", "Function calling", "Vision", "Reasoning"]
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 5.5 family — Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5; 1M context (Oct 2026)",
    category: "Major",
    models: [
      "claude-fable-5-1",  // Most capable
      "claude-opus-5-5",   // Flagship for complex work
      "claude-sonnet-5-5", // Best speed/intelligence balance
      "claude-haiku-5-5"   // Fast + cheap
    ],
    defaultModel: "claude-sonnet-5-5",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.anthropic.com",
    signupUrl: "https://console.anthropic.com/",
    supportsEmbeddings: false,
    icon: "🧠",
    pricing: "Pay-per-token",
    features: ["Chat completion", "Vision", "1M context", "Adaptive thinking"]
  },
  googleai: {
    name: "Google AI",
    description: "Gemini 3.x family with multimodal capabilities (Oct 2026)",
    category: "Major",
    models: [
      "gemini-3.8-flash",        // Newest flash (GA Sep 2026)
      "gemini-3.6-flash",
      "gemini-3.5-flash",        // Legacy, still served
      "gemini-3.5-flash-lite",   // Cheapest
      "gemini-3.1-pro-preview",  // Pro (still preview — ids can move)
    ],
    defaultModel: "gemini-3.5-flash-lite",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    signupUrl: "https://aistudio.google.com/apikey",
    supportsEmbeddings: true,
    icon: "⚡",
    pricing: "Pay-per-token",
    features: ["Chat completion", "Embeddings", "Vision", "Multimodal", "Long context"]
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference — GPT-OSS, MiniMax M2.7, Qwen 3.8 (Oct 2026)",
    category: "Fast",
    models: [
      "openai/gpt-oss-120b",      // Production
      "openai/gpt-oss-20b",
      "minimaxai/minimax-m2.7",   // Preview
      "qwen/qwen3.8-27b"          // Preview
    ],
    defaultModel: "openai/gpt-oss-120b",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    signupUrl: "https://console.groq.com/keys",
    supportsEmbeddings: false,
    icon: "",
    features: ["Ultra-fast inference", "GPT-OSS models", "Low latency"]
  },
  fireworks: {
    name: "Fireworks AI",
    description: "Fast serverless inference — DeepSeek V4.1, GLM 5.2, Kimi K2.6 (Oct 2026)",
    category: "Commercial",
    models: [
      "accounts/fireworks/models/deepseek-v4p1-flash",
      "accounts/fireworks/models/deepseek-v4-pro",
      "accounts/fireworks/models/glm-5p2",
      "accounts/fireworks/models/kimi-k2p6",
      "accounts/fireworks/models/gpt-oss-120b"
    ],
    defaultModel: "accounts/fireworks/models/deepseek-v4p1-flash",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    signupUrl: "https://fireworks.ai/",
    supportsEmbeddings: true,
    icon: "",
    features: ["Fast inference", "DeepSeek V4.1", "GLM 5.2", "Embeddings"]
  },
  mistral: {
    name: "Mistral AI",
    description: "Mistral Large/Medium/Small + Ministral (Oct 2026)",
    category: "Commercial",
    models: [
      // Rolling aliases — Mistral moves these to the current snapshot for you
      "mistral-medium-latest",   // Medium 3.5 — recommended flagship
      "mistral-large-latest",
      "mistral-small-latest",
      "ministral-14b-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
      "codestral-latest",        // Coding specialist
    ],
    defaultModel: "mistral-small-latest",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    signupUrl: "https://console.mistral.ai/",
    supportsEmbeddings: true,
    icon: "",
    features: ["Rolling aliases", "Ministral", "Embeddings", "Coding"]
  },
  cerebras: {
    name: "Cerebras",
    description: "Extremely fast inference on specialized chips (Oct 2026)",
    category: "Fast",
    models: ["gpt-oss-120b", "qwen-3.8-27b"],
    defaultModel: "gpt-oss-120b",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    signupUrl: "https://cloud.cerebras.ai/",
    supportsEmbeddings: false,
    icon: "🧠",
    pricing: "Pay-per-token",
    features: ["Ultra-fast inference", "Specialized hardware", "Low latency"]
  },

  // Aggregators
  openrouter: {
    name: "OpenRouter",
    description: "One API in front of every major lab (Oct 2026)",
    category: "Aggregator",
    models: [
      "openai/gpt-6.1-sol",
      "openai/gpt-5.6-sol",
      "openai/gpt-5.6-terra",
      "openai/gpt-5.6-luna",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-sonnet-5.5",
      "google/gemini-3.6-flash",
      "x-ai/grok-4.7",
      "deepseek/deepseek-v4-flash-0731"
    ],
    defaultModel: "openai/gpt-5.6-luna",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    signupUrl: "https://openrouter.ai/keys",
    supportsEmbeddings: false,
    icon: "🌐",
    pricing: "Pay-per-token",
    features: ["Multiple models", "Single API", "Model routing"]
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to 200+ models",
    category: "Aggregator",
    models: [
      "openai/gpt-5.6-sol",
      "openai/gpt-5.6-luna",
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
      "google/gemini-3-6-flash",
      "google/gemini-3-5-flash-lite",
      "x-ai/grok-4-5",
      "alibaba/qwen3.8-max",
      "deepseek/deepseek-v4-flash"
    ],
    defaultModel: "google/gemini-3-6-flash",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.aimlapi.com/v1",
    signupUrl: "https://aimlapi.com/",
    supportsEmbeddings: true,
    icon: "🌐",
    pricing: "Pay-per-token",
    features: ["200+ models", "Unified API", "Multiple providers"]
  },

  // Specialized
  huggingface: {
    name: "Hugging Face",
    description: "Inference Providers router — open-weight models",
    category: "Open Source",
    models: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "deepseek-ai/DeepSeek-V4-Pro",
      "deepseek-ai/DeepSeek-V4-Flash",
      "zai-org/GLM-5.2",
      "zai-org/GLM-4.7-Flash",
      "moonshotai/Kimi-K3",
      "Qwen/Qwen3.5-397B-A17B",
      "MiniMaxAI/MiniMax-M3",
      "meta-llama/Llama-3.3-70B-Instruct"
    ],
    defaultModel: "openai/gpt-oss-120b",
    apiKeyRequired: true,
    baseUrlRequired: false,
    // The legacy api-inference.huggingface.co host is deprecated; Inference
    // Providers is the current surface. Needs a fine-grained token with the
    // "Make calls to Inference Providers" permission — a read token is not enough.
    // Calls go through /api/huggingface/* so a server HUGGINGFACE_API_KEY also works.
    defaultBaseUrl: "https://router.huggingface.co/v1",
    signupUrl: "https://huggingface.co/settings/tokens",
    supportsEmbeddings: true,
    icon: "",
    features: ["Open-weight models", "Many providers", "Community models"]
  },
  perplexity: {
    name: "Perplexity",
    description: "Router API — OpenAI-compatible access to hosted models (Oct 2026)",
    category: "Specialized",
    models: [
      "perplexity/kimi-k3",
      "perplexity/glm-5.2"
    ],
    defaultModel: "perplexity/kimi-k3",
    apiKeyRequired: true,
    baseUrlRequired: false,
    // Sonar chat-completions support ended 2026-09-27. The Router API keeps the
    // OpenAI chat-completions shape the rest of this app speaks. (The Agent API,
    // /v1/agent, is Responses-shaped and always web-searches — wrong for RAG over
    // the user's own documents.)
    defaultBaseUrl: "https://api.perplexity.ai/router/v1",
    signupUrl: "https://www.perplexity.ai/settings/api",
    supportsEmbeddings: false,
    icon: "",
    features: ["OpenAI-compatible", "Hosted open models"]
  },

  // Additional providers
  deepinfra: {
    name: "DeepInfra",
    description: "Serverless inference for open-weight models (Oct 2026)",
    category: "Open Source",
    models: [
      "deepseek-ai/DeepSeek-V4-Flash-0731",
      "deepseek-ai/DeepSeek-V4-Pro",
      "deepseek-ai/DeepSeek-V3.2",
      "zai-org/GLM-5.2",
      "zai-org/GLM-4.7-Flash",
      "Qwen/Qwen3.5-397B-A17B",
      "moonshotai/Kimi-K2.6",
      "google/gemma-4-26B-A4B-it",
      "mistralai/Mistral-Small-3.2-24B-Instruct-2506"
    ],
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash-0731",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.deepinfra.com/v1/openai",
    signupUrl: "https://deepinfra.com/",
    supportsEmbeddings: true,
    icon: "⚡",
    pricing: "Pay-per-token",
    features: ["Serverless", "Open-weight models", "Cost effective"]
  },
  deepseek: {
    name: "DeepSeek",
    description: "DeepSeek Flash (V4.1) & V4 Pro (Oct 2026)",
    category: "Specialized",
    models: [
      "deepseek-flash",      // Canonical name; currently V4.1-Flash
      "deepseek-v4-pro"      // Frontier
    ],
    defaultModel: "deepseek-flash",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.deepseek.com",
    signupUrl: "https://platform.deepseek.com/",
    supportsEmbeddings: false,
    icon: "🔬",
    pricing: "Pay-per-token",
    features: ["Flash / V4 Pro", "Reasoning", "Cost effective"]
  },
  xai: {
    name: "xAI (Grok)",
    description: "Grok 4.7 / 4.6 / 4.5 / 4.3 (Oct 2026)",
    category: "Major",
    models: [
      "grok-4.7",                // Newest flagship
      "grok-4.6",
      "grok-4.5",
      "grok-4.3",                // Cheap
      "grok-4.20-multi-agent",   // Multi-agent
      "grok-build-0.1"           // Coding/agentic build (early access)
    ],
    defaultModel: "grok-4.3",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.x.ai/v1",
    signupUrl: "https://console.x.ai/",
    supportsEmbeddings: false,
    icon: "🚀",
    pricing: "Pay-per-token",
    features: ["Grok 4.7", "Agentic tools", "Vision"]
  },
  // Removed August 2026:
  //  - anyscale:  Anyscale Endpoints was shut down. api.endpoints.anyscale.com/v1/models
  //               returns 404 and the console 308-redirects to console.anyscale.com,
  //               which only sells Ray/platform products now. There is nothing to call.
  //  - replicate: Replicate serves no OpenAI-compatible /chat/completions endpoint, so
  //               this app's client could never talk to it. Re-adding it means a separate
  //               predictions-API path (POST /v1/models/{owner}/{name}/predictions with a
  //               per-model input schema, plus `Prefer: wait` or polling) — not a base-URL swap.
}

/** Every category actually present in AI_PROVIDERS, in first-seen order. */
const AI_PROVIDER_CATEGORIES = [...new Set(Object.values(AI_PROVIDERS).map((p) => p.category))]

const VECTOR_DB_PROVIDERS = {
  local: {
    name: "Local Storage",
    description: "In-browser index, saved in this browser (IndexedDB) across reloads",
    category: "Free",
    requiresApiKey: false,
    optionalApiKey: false,
    requiresUrl: false,
    features: ["Free", "No Setup", "Private — never leaves the browser"],
    limitations: ["This browser only", "Limited Scale"],
    icon: <Database className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "No setup required. Documents and embeddings are stored in this browser.",
    signupUrl: "",
  },
  pinecone: {
    name: "Pinecone",
    description: "Managed vector database with high performance",
    category: "Managed",
    requiresApiKey: true,
    optionalApiKey: false,
    requiresUrl: false,
    features: ["Managed", "Scalable", "Fast Search", "Real-time"],
    limitations: ["Paid Service", "API Limits"],
    signupUrl: "https://www.pinecone.io/",
    icon: <Zap className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "Create an account at Pinecone.io. The index is created automatically on first upload, sized to your embedding model",
  },
  weaviate: {
    name: "Weaviate",
    description: "Open-source vector database — Weaviate Cloud or self-hosted",
    category: "Self-hosted",
    requiresApiKey: false,
    optionalApiKey: true,
    requiresUrl: true,
    features: ["Open Source", "Hybrid Search", "Self-host or Cloud"],
    limitations: ["Needs a running instance"],
    signupUrl: "https://console.weaviate.cloud/",
    icon: <Database className="w-4 h-4" />,
    difficulty: "Medium",
    defaultUrl: "http://localhost:8080",
    setupInstructions: "Enter your cluster URL (e.g. https://xyz.weaviate.cloud or http://localhost:8080). The API key is only needed for Weaviate Cloud or auth-enabled clusters",
  },
}

interface UnifiedConfigurationProps {
  onTestAI: (config: AIConfig) => Promise<boolean>
  onTestVectorDB: (config: VectorDBConfig) => Promise<boolean>
  /** Wipe documents and chat history from this browser (IndexedDB) and the current session. */
  onClearSavedData?: () => Promise<void> | void
}

export function UnifiedConfiguration({ onTestAI, onTestVectorDB, onClearSavedData }: UnifiedConfigurationProps) {
  const { aiConfig, setAIConfig, vectorDBConfig, setVectorDBConfig, addError, rememberSession, setRememberSession } =
    useAppStore()

  const [showApiKeys, setShowApiKeys] = useState({
    ai: false,
    vectordb: false,
  })

  const [testingStatus, setTestingStatus] = useState({
    ai: "idle" as "idle" | "testing" | "success" | "error",
    vectordb: "idle" as "idle" | "testing" | "success" | "error",
  })

  const [selectedCategory, setSelectedCategory] = useState("Major")

  const handleAIProviderChange = (provider: keyof typeof AI_PROVIDERS) => {
    const providerInfo = AI_PROVIDERS[provider]
    setAIConfig({
      ...aiConfig,
      provider,
      model: providerInfo.defaultModel,
      baseUrl: providerInfo.defaultBaseUrl,
      apiKey: "",
    })
    setTestingStatus((prev) => ({ ...prev, ai: "idle" }))
  }

  const handleVectorDBProviderChange = (provider: keyof typeof VECTOR_DB_PROVIDERS) => {
    const providerInfo = VECTOR_DB_PROVIDERS[provider]
    setVectorDBConfig({
      ...vectorDBConfig,
      provider,
      apiKey: "",
      url: providerInfo.defaultUrl || "",
      indexName: "pdf-documents",
      collection: "documents",
    })
    setTestingStatus((prev) => ({ ...prev, vectordb: "idle" }))
  }

  const handleTestAI = async () => {
    if (!aiConfig.apiKey.trim()) {
      addError({
        type: "error",
        title: "Configuration Error",
        message: "AI API key is required",
      })
      return
    }

    setTestingStatus((prev) => ({ ...prev, ai: "testing" }))

    try {
      const success = await onTestAI(aiConfig)
      setTestingStatus((prev) => ({ ...prev, ai: success ? "success" : "error" }))

      if (success) {
        addError({
          type: "success",
          title: "AI Connection Successful",
          message: `Connected to ${AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.name || aiConfig.provider}`,
        })
      } else {
        addError({
          type: "error",
          title: "AI Connection Failed",
          message: "Unable to connect to AI provider. Check your API key and configuration.",
        })
      }
    } catch (error) {
      setTestingStatus((prev) => ({ ...prev, ai: "error" }))
      addError({
        type: "error",
        title: "AI Test Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleTestVectorDB = async () => {
    const provider = VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]

    if (provider.requiresApiKey && !vectorDBConfig.apiKey?.trim()) {
      addError({
        type: "error",
        title: "Configuration Error",
        message: "Vector database API key is required",
      })
      return
    }

    if (provider.requiresUrl && !vectorDBConfig.url?.trim()) {
      addError({
        type: "error",
        title: "Configuration Error",
        message: "Vector database URL is required",
      })
      return
    }

    setTestingStatus((prev) => ({ ...prev, vectordb: "testing" }))

    try {
      const success = await onTestVectorDB(vectorDBConfig)
      setTestingStatus((prev) => ({ ...prev, vectordb: success ? "success" : "error" }))

      if (success) {
        addError({
          type: "success",
          title: "Vector DB Connection Successful",
          message: `Connected to ${provider.name}`,
        })
      } else {
        addError({
          type: "error",
          title: "Vector DB Connection Failed",
          message: `Unable to connect to ${provider.name}. ${provider.setupInstructions || "Check your configuration."}`,
        })
      }
    } catch (error) {
      setTestingStatus((prev) => ({ ...prev, vectordb: "error" }))
      addError({
        type: "error",
        title: "Vector DB Test Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <Check className="w-4 h-4 text-green-600" />
      case "error":
        return <X className="w-4 h-4 text-red-600" />
      case "testing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
      default:
        return null
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "border-green-600 text-green-600"
      case "Medium":
        return "border-yellow-600 text-yellow-600"
      case "Hard":
        return "border-red-600 text-red-600"
      default:
        return "border-gray-600 text-gray-600"
    }
  }

  const filteredProviders = Object.entries(AI_PROVIDERS).filter(
    ([, provider]) => provider.category === selectedCategory,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Cpu className="w-5 h-5" />
        <h2 className="text-lg font-bold">SYSTEM CONFIGURATION</h2>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 gap-2 p-1 bg-white border-2 border-black rounded-lg">
          <TabsTrigger 
            value="ai"
            className="data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:font-medium 
                       bg-white text-black border border-black hover:bg-black hover:text-white 
                       transition-colors duration-200 rounded-md flex items-center justify-center py-2 px-1 whitespace-nowrap"
          >
            <Zap className="w-4 h-4 mr-1" />
            <span className="text-sm truncate">AI Provider</span>
          </TabsTrigger>
          <TabsTrigger 
            value="vectordb"
            className="data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:font-medium 
                       bg-white text-black border border-black hover:bg-black hover:text-white 
                       transition-colors duration-200 rounded-md flex items-center justify-center py-2 px-1 whitespace-nowrap"
          >
            <Database className="w-4 h-4 mr-1" />
            <span className="text-sm truncate">Vector DB</span>
          </TabsTrigger>
        </TabsList>

        {/* AI Provider Configuration */}
        <TabsContent value="ai">
          <div className="space-y-4">
            {/* Category Selection */}
            <Card className="border-2 border-black shadow-none">
              <CardHeader className="border-b border-black">
                <CardTitle className="text-sm">PROVIDER CATEGORIES</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {/* Derived from the data, not hardcoded: a literal list silently
                      hid every provider whose category had no chip (Commercial,
                      Open Source) and showed a "Cloud" chip nothing matched. */}
                  {AI_PROVIDER_CATEGORIES.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={
                        selectedCategory === category
                          ? "bg-black text-white"
                          : "border-black hover:bg-black hover:text-white"
                      }
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-black shadow-none">
              <CardHeader className="border-b border-black">
                <CardTitle className="flex items-center justify-between">
                  <span>AI PROVIDER CONFIGURATION</span>
                  {getStatusIcon(testingStatus.ai)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <Select value={aiConfig.provider} onValueChange={handleAIProviderChange}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {filteredProviders.map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center space-x-2">
                            <span>{info.name}</span>
                            {info.supportsEmbeddings && (
                              <Badge variant="outline" className="text-xs border-green-600 text-green-600">
                                Embeddings
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Provider Info */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>{AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.name || 'Unknown Provider'}:</strong>{" "}
                        {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.description || 'Provider not found'}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.signupUrl || '#',
                              "_blank",
                            )
                          }
                          className="h-6 text-xs border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Get API Key
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Embedding Warning */}
                {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS] && !AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS].supportsEmbeddings && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> This provider has no embeddings API, so documents are indexed with local
                      keyword (lexical) embeddings. Exact terms match well; synonyms and paraphrases match poorly.
                      For semantic search, use a provider with embeddings (e.g. OpenAI, Google AI, Mistral).
                    </AlertDescription>
                  </Alert>
                )}

                {/* Provider Not Found Warning */}
                {!AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS] && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> Provider &quot;{aiConfig.provider}&quot; is not supported. Please select a different provider.
                    </AlertDescription>
                  </Alert>
                )}

                {/* API Key */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKeys.ai ? "text" : "password"}
                      value={aiConfig.apiKey}
                      onChange={(e) => setAIConfig({ ...aiConfig, apiKey: e.target.value })}
                      placeholder="Enter your API key"
                      className="border-2 border-black pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKeys((prev) => ({ ...prev, ai: !prev.ai }))}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showApiKeys.ai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>
                  <Select value={aiConfig.model} onValueChange={(model) => setAIConfig({ ...aiConfig, model })}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.models || []).map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="text-sm font-medium">Advanced Settings</h4>

                  <div className="space-y-2">
                    <Label className="text-sm">Temperature: {aiConfig.temperature}</Label>
                    <Slider
                      value={[aiConfig.temperature || 0.7]}
                      onValueChange={([value]) => setAIConfig({ ...aiConfig, temperature: value })}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Max Tokens: {aiConfig.maxTokens}</Label>
                    <Slider
                      value={[aiConfig.maxTokens || 1000]}
                      onValueChange={([value]) => setAIConfig({ ...aiConfig, maxTokens: value })}
                      max={4000}
                      min={100}
                      step={100}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Test Connection */}
                {testingStatus.ai === "testing" ? (
                  <ConfigurationTestingSkeleton />
                ) : (
                <Button
                  onClick={handleTestAI}
                    disabled={!aiConfig.apiKey.trim()}
                  className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
                >
                    Test Connection
                </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vector Database Configuration */}
        <TabsContent value="vectordb">
          <Card className="border-2 border-black shadow-none">
            <CardHeader className="border-b border-black">
              <CardTitle className="flex items-center justify-between">
                <span>VECTOR DATABASE CONFIGURATION</span>
                {getStatusIcon(testingStatus.vectordb)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <Select value={vectorDBConfig.provider} onValueChange={handleVectorDBProviderChange}>
                  <SelectTrigger className="border-2 border-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VECTOR_DB_PROVIDERS).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center space-x-2">
                          {info.icon}
                          <span>{info.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {info.category}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${getDifficultyColor(info.difficulty)}`}>
                            {info.difficulty}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>
                        {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].name}:
                      </strong>{" "}
                      {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].features.map(
                        (feature) => (
                          <Badge key={feature} variant="outline" className="text-xs border-green-600 text-green-600">
                            {feature}
                          </Badge>
                        ),
                      )}
                    </div>
                    {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].limitations && (
                      <div className="flex flex-wrap gap-1">
                        {VECTOR_DB_PROVIDERS[
                          vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS
                        ].limitations.map((limitation) => (
                          <Badge key={limitation} variant="outline" className="text-xs border-red-600 text-red-600">
                            {limitation}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]
                      .setupInstructions && (
                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
                        {
                          VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]
                            .setupInstructions
                        }
                      </div>
                    )}
                    {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].signupUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(
                            VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].signupUrl,
                            "_blank",
                          )
                        }
                        className="h-6 text-xs border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Learn More
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Configuration Fields */}
              {(VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].requiresApiKey ||
                VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].optionalApiKey) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    API Key
                    {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].optionalApiKey && " (optional)"}
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKeys.vectordb ? "text" : "password"}
                      value={vectorDBConfig.apiKey || ""}
                      onChange={(e) => setVectorDBConfig({ ...vectorDBConfig, apiKey: e.target.value })}
                      placeholder="Enter your API key"
                      className="border-2 border-black pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKeys((prev) => ({ ...prev, vectordb: !prev.vectordb }))}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showApiKeys.vectordb ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].requiresUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    value={vectorDBConfig.url || ""}
                    onChange={(e) => setVectorDBConfig({ ...vectorDBConfig, url: e.target.value })}
                    placeholder={
                      VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].defaultUrl ||
                      "https://your-instance.com"
                    }
                    className="border-2 border-black"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Index/Collection Name</label>
                  <Input
                    value={vectorDBConfig.indexName || vectorDBConfig.collection || ""}
                    onChange={(e) =>
                      setVectorDBConfig({
                        ...vectorDBConfig,
                        indexName: e.target.value,
                        collection: e.target.value,
                      })
                    }
                    placeholder="pdf-documents"
                    className="border-2 border-black"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dimension</label>
                  <Input
                    type="number"
                    value={vectorDBConfig.dimension || 1536}
                    onChange={(e) =>
                      setVectorDBConfig({ ...vectorDBConfig, dimension: Number.parseInt(e.target.value) })
                    }
                    placeholder="1536"
                    className="border-2 border-black"
                  />
                </div>
              </div>

              {/* Test Connection */}
              {testingStatus.vectordb === "testing" ? (
                <VectorDatabaseLoadingSkeleton />
              ) : (
              <Button
                onClick={handleTestVectorDB}
                  disabled={
                    (VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].requiresApiKey && !vectorDBConfig.apiKey?.trim()) ||
                    (VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].requiresUrl && !vectorDBConfig.url?.trim())
                  }
                className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
              >
                  Test Connection
              </Button>
              )}
            </CardContent>
          </Card>

          {/* Privacy & storage */}
          <Card className="border-2 border-black">
            <CardHeader>
              <CardTitle className="text-base">Saved data on this device</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="remember-session" className="text-sm">
                  Remember documents and chat history in this browser
                </Label>
                <Switch id="remember-session" checked={rememberSession} onCheckedChange={setRememberSession} />
              </div>
              <p className="text-xs text-gray-600">
                Saved data is stored unencrypted in this browser&apos;s IndexedDB and is readable by anyone using this
                browser profile. Turn this off, or clear it, on shared computers. API keys are never saved.
              </p>
              {onClearSavedData && (
                <Button
                  variant="outline"
                  className="w-full border-2 border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                  onClick={async () => {
                    if (window.confirm("Delete all saved documents and chat history from this browser?")) {
                      await onClearSavedData()
                    }
                  }}
                >
                  Clear saved data
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

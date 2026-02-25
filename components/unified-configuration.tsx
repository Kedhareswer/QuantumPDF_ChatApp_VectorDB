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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/lib/store"
import { AlertTriangle, Check, Cpu, Database, ExternalLink, Eye, EyeOff, Info, Loader2, X, Zap } from "lucide-react"
import { useState } from "react"

// Updated: December 2025 - Latest models from official provider documentation
const AI_PROVIDERS = {
  // Major Providers
  openai: {
    name: "OpenAI",
    description: "GPT-5 family, GPT-4o, and o-series reasoning models (Dec 2025)",
    category: "Major",
    models: [
      "gpt-5.1",           // Latest flagship (Dec 2025)
      "gpt-5-pro",         // Pro tier
      "gpt-5-mini",        // Efficient model
      "gpt-5-nano",        // Smallest model
      "gpt-4o",            // GPT-4 Omni multimodal
      "gpt-4o-mini",       // Cost-effective GPT-4o
      "o3-2025-04-16",     // Reasoning model
      "o1",                // Original reasoning
      "gpt-4-turbo"        // Legacy but stable
    ],
    defaultModel: "gpt-4o-mini",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.openai.com/v1",
    signupUrl: "https://platform.openai.com/api-keys",
    supportsEmbeddings: true,
    icon: "",
    features: ["Chat completion", "Embeddings", "Function calling", "Vision", "Audio"]
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 4.5 Sonnet/Haiku - frontier models with extended thinking (Dec 2025)",
    category: "Major",
    models: [
      "claude-sonnet-4-5-20250514",   // Claude 4.5 Sonnet (latest frontier)
      "claude-haiku-4-5-20250514",    // Claude 4.5 Haiku (fast + intelligent)
      "claude-sonnet-4-20250514",     // Claude 4 Sonnet
      "claude-3-5-sonnet-20241022",   // Claude 3.5 Sonnet (stable)
      "claude-3-5-haiku-20241022",    // Claude 3.5 Haiku
      "claude-3-opus-20240229"        // Claude 3 Opus (legacy)
    ],
    defaultModel: "claude-sonnet-4-5-20250514",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.anthropic.com",
    signupUrl: "https://console.anthropic.com/",
    supportsEmbeddings: false,
    icon: "🧠",
    pricing: "Pay-per-token",
    features: ["Chat completion", "Function calling", "Vision", "Large context", "Extended thinking"]
  },
  googleai: {
    name: "Google AI",
    description: "Gemini 3 Pro & 2.5 family with multimodal capabilities (Dec 2025)",
    category: "Major",
    models: [
      "gemini-3-pro",            // Latest flagship (Dec 2025)
      "gemini-3-pro-preview",    // Preview version
      "gemini-2.5-pro",          // Stable pro model
      "gemini-2.5-flash",        // Best price-performance
      "gemini-2.5-flash-lite",   // Lightweight version
      "gemini-2.0-flash",        // Previous generation
      "gemini-embedding-001"     // Text embeddings
    ],
    defaultModel: "gemini-2.5-flash",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    signupUrl: "https://aistudio.google.com/apikey",
    supportsEmbeddings: true,
    icon: "⚡",
    pricing: "Pay-per-token",
    features: ["Chat completion", "Embeddings", "Vision", "Multimodal", "Live API"]
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference - Llama 4, GPT-OSS, Qwen 3 (Dec 2025)",
    category: "Fast",
    models: [
      "llama-3.3-70b-versatile",           // Production - Llama 3.3
      "llama-3.1-8b-instant",              // Production - Fast
      "meta-llama/llama-guard-4-12b",      // Production - Safety
      "openai/gpt-oss-120b",               // Production - GPT OSS large
      "openai/gpt-oss-20b",                // Production - GPT OSS small
      "meta-llama/llama-4-maverick-17b-128e-instruct",  // Preview - Llama 4
      "meta-llama/llama-4-scout-17b-16e-instruct",      // Preview - Llama 4 Scout
      "moonshotai/kimi-k2-instruct-0905",  // Preview - Kimi K2
      "qwen/qwen3-32b"                     // Preview - Qwen 3
    ],
    defaultModel: "llama-3.3-70b-versatile",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    signupUrl: "https://console.groq.com/keys",
    supportsEmbeddings: false,
    icon: "",
    features: ["Ultra-fast inference", "Llama 4 preview", "GPT-OSS models", "Low latency"]
  },
  fireworks: {
    name: "Fireworks AI",
    description: "Fast inference - DeepSeek V3.1, Kimi K2, Qwen 3 (Dec 2025)",
    category: "Commercial",
    models: [
      "accounts/fireworks/models/kimi-k2-instruct-0905",    // Top performer
      "accounts/fireworks/models/deepseek-v3p1",            // DeepSeek V3.1
      "accounts/fireworks/models/qwen3-235b-a22b",          // Qwen 3 large
      "accounts/fireworks/models/qwen3-32b",                // Qwen 3 medium
      "accounts/fireworks/models/llama-v3p3-70b-instruct",  // Llama 3.3
      "accounts/fireworks/models/gpt-oss-120b",             // GPT-OSS large
      "accounts/fireworks/models/gpt-oss-20b",              // GPT-OSS small
      "accounts/fireworks/models/glm-4p6"                   // GLM 4.6
    ],
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    signupUrl: "https://fireworks.ai/",
    supportsEmbeddings: true,
    icon: "",
    features: ["Fast inference", "DeepSeek V3.1", "Qwen 3", "Competitive pricing"]
  },
  mistral: {
    name: "Mistral AI",
    description: "Mistral Large 3, Medium 3.1, Magistral reasoning models (Dec 2025)",
    category: "Commercial",
    models: [
      // Generalist models
      "mistral-large-2512",      // Mistral Large 3 (Dec 2025)
      "mistral-medium-2508",     // Mistral Medium 3.1 (Aug 2025)
      "mistral-small-2506",      // Mistral Small 3.2 (Jun 2025)
      // Ministral family
      "ministral-3-14b-2512",    // Ministral 3 14B
      "ministral-3-8b-2512",     // Ministral 3 8B
      "ministral-3-3b-2512",     // Ministral 3 3B
      // Reasoning models
      "magistral-medium-2509",   // Magistral Medium 1.2
      "magistral-small-2509",    // Magistral Small 1.2
      // Specialist models
      "codestral-2508",          // Coding specialist
      "devstral-medium-2507",    // SWE specialist
      "devstral-small-2507",     // SWE small
      "voxtral-small-2507",      // Audio input
      "voxtral-mini-2507",       // Audio mini
      "mistral-ocr-2505",        // OCR specialist
      "pixtral-large-latest",    // Vision model
      "mistral-embed"            // Embeddings
    ],
    defaultModel: "mistral-large-2512",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    signupUrl: "https://console.mistral.ai/",
    supportsEmbeddings: true,
    icon: "",
    features: ["Mistral Large 3", "Magistral reasoning", "Vision", "Audio", "OCR", "Coding"]
  },
  cerebras: {
    name: "Cerebras",
    description: "Extremely fast inference on specialized chips",
    category: "Fast",
    models: ["llama3.3-70b", "llama3.1-8b", "llama3.1-70b"],
    defaultModel: "llama3.1-8b",
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
    description: "Access to multiple AI models through one API",
    category: "Aggregator",
    models: [
      "openai/gpt-5.1",
      "openai/gpt-5-mini",
      "anthropic/claude-3.5-sonnet-20241022",
      "google/gemini-2.5-pro",
      "meta-llama/llama-3.3-405b-instruct",
    ],
    defaultModel: "openai/gpt-5-mini",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    signupUrl: "https://openrouter.ai/keys",
    supportsEmbeddings: true,
    icon: "🌐",
    pricing: "Pay-per-token",
    features: ["Multiple models", "Single API", "Model routing"]
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to 200+ AI providers",
    category: "Aggregator",
    models: [
      "gpt-5.1",
      "claude-3-5-sonnet-20241022",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "llama-3.3-70b-instruct",
      "deepseek-v3",
    ],
    defaultModel: "gpt-5.1",
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
    description: "Open source models and inference API",
    category: "Open Source",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct",
      "Qwen/Qwen2.5-72B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "mistralai/Mistral-Small-3.2-Instruct",
      "google/gemma-2-27b-it",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api-inference.huggingface.co",
    signupUrl: "https://huggingface.co/settings/tokens",
    supportsEmbeddings: true,
    icon: "",
    features: ["Open source models", "Free tier", "Community models"]
  },
  perplexity: {
    name: "Perplexity",
    description: "Sonar search-augmented models with reasoning (Dec 2025)",
    category: "Specialized",
    models: [
      "sonar",                  // Base search model
      "sonar-pro",              // Advanced search (2x results)
      "sonar-reasoning",        // Reasoning with search
      "sonar-reasoning-pro",    // Pro reasoning
      "sonar-deep-research"     // Deep research agent
    ],
    defaultModel: "sonar",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.perplexity.ai",
    signupUrl: "https://www.perplexity.ai/settings/api",
    supportsEmbeddings: false,
    icon: "",
    features: ["Search-augmented", "Real-time data", "Deep research", "Reasoning"]
  },

  // Additional providers
  deepinfra: {
    name: "DeepInfra",
    description: "Serverless inference for open source models",
    category: "Open Source",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "mistralai/Mistral-Small-3.2-Instruct",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.deepinfra.com/v1/openai",
    signupUrl: "https://deepinfra.com/",
    supportsEmbeddings: true,
    icon: "⚡",
    pricing: "Pay-per-token",
    features: ["Serverless", "Open source models", "Cost effective"]
  },
  replicate: {
    name: "Replicate",
    description: "Run open source models via API",
    category: "Open Source",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "mistralai/Mistral-Small-3.2-Instruct",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.replicate.com/v1",
    signupUrl: "https://replicate.com/account/api-tokens",
    supportsEmbeddings: false,
    icon: "",
    features: ["Open source models", "Easy deployment", "Version control"]
  },
  anyscale: {
    name: "Anyscale",
    description: "Scalable AI infrastructure",
    category: "Infrastructure",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct",
      "mistralai/Mistral-Small-3.2-Instruct",
      "deepseek-ai/DeepSeek-V3",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.endpoints.anyscale.com/v1",
    signupUrl: "https://console.anyscale.com/",
    supportsEmbeddings: false,
    icon: "",
    features: ["Scalable infrastructure", "Ray ecosystem", "Enterprise ready"]
  },
  deepseek: {
    name: "DeepSeek",
    description: "DeepSeek V3.2-Speciale & V3.1 with advanced reasoning (Dec 2025)",
    category: "Specialized",
    models: [
      "deepseek-chat",                // DeepSeek V3.2 (current default)
      "deepseek-reasoner",            // Reasoning model
      "deepseek-v3.1",                // Open source V3.1
      "deepseek-coder"                // Coding specialist
    ],
    defaultModel: "deepseek-chat",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.deepseek.com",
    signupUrl: "https://platform.deepseek.com/",
    supportsEmbeddings: false,
    icon: "🔬",
    pricing: "Pay-per-token",
    features: ["V3.2-Speciale", "Reasoning", "Coding", "Cost effective"]
  },
  xai: {
    name: "xAI (Grok)",
    description: "Grok 4 & Grok 3 models with agentic capabilities (Dec 2025)",
    category: "Major",
    models: [
      "grok-4-0709",             // Latest Grok 4 (Jul 2025)
      "grok-3-latest",           // Grok 3 stable
      "grok-3-mini",             // Smaller Grok 3
      "grok-vision"              // Vision model
    ],
    defaultModel: "grok-3-latest",
    apiKeyRequired: true,
    baseUrlRequired: false,
    defaultBaseUrl: "https://api.x.ai/v1",
    signupUrl: "https://console.x.ai/",
    supportsEmbeddings: false,
    icon: "🚀",
    pricing: "Pay-per-token",
    features: ["Grok 4", "Agentic tools", "Live search", "Vision"]
  },
}

const VECTOR_DB_PROVIDERS = {
  local: {
    name: "Local Storage",
    description: "In-memory vector storage (no persistence)",
    category: "Free",
    requiresApiKey: false,
    requiresUrl: false,
    features: ["Free", "No Setup", "Local Only"],
    limitations: ["No Persistence", "Limited Scale"],
    icon: <Database className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "No setup required. Data is stored in memory.",
    signupUrl: "",
  },
  pinecone: {
    name: "Pinecone",
    description: "Managed vector database with high performance",
    category: "Managed",
    requiresApiKey: true,
    requiresUrl: false,
    features: ["Managed", "Scalable", "Fast Search", "Real-time"],
    limitations: ["Paid Service", "API Limits"],
    signupUrl: "https://www.pinecone.io/",
    icon: <Zap className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "Create an account at Pinecone.io and create an index with the dimensions set to match your embedding model",
  },
}

interface UnifiedConfigurationProps {
  onTestAI: (config: unknown) => Promise<boolean>
  onTestVectorDB: (config: unknown) => Promise<boolean>
}

export function UnifiedConfiguration({ onTestAI, onTestVectorDB }: UnifiedConfigurationProps) {
  const { aiConfig, setAIConfig, vectorDBConfig, setVectorDBConfig, addError } =
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
      provider: provider as unknown,
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
      provider: provider as unknown,
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
                  {["Major", "Fast", "Aggregator", "Specialized", "Cloud"].map((category) => (
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
                      <strong>Warning:</strong> This provider doesn&apos;t support embeddings. Document processing will use
                      fallback embeddings which may reduce search quality.
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
              {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS].requiresApiKey && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import {
  Zap,
  Database,
  BarChart3,
  Eye,
  EyeOff,
  Check,
  X,
  ExternalLink,
  Info,
  AlertTriangle,
  Settings,
  Loader2,
  Globe,
  Cpu,
  Sparkles,
  Brain,
  Search,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { 
  ConfigurationTestingSkeleton, 
  APITestingSkeleton, 
  VectorDatabaseLoadingSkeleton, 
  WandbConfigurationLoadingSkeleton 
} from "@/components/skeleton-loaders"

const AI_PROVIDERS = {
  // Major Providers
  openai: {
    name: "OpenAI",
    description: "Industry-leading GPT models with high quality responses",
    category: "Major",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    signupUrl: "https://platform.openai.com/api-keys",
    embeddingSupport: true,
    icon: <Sparkles className="w-4 h-4" />,
    pricing: "$$",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude models with strong reasoning and safety focus",
    category: "Major",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229"],
    defaultModel: "claude-3-5-sonnet-20241022",
    baseUrl: "https://api.anthropic.com",
    signupUrl: "https://console.anthropic.com/",
    embeddingSupport: false,
    icon: <Brain className="w-4 h-4" />,
    pricing: "$$",
  },
  googleai: {
    name: "Google AI",
    description: "Gemini models with multimodal capabilities",
    category: "Major",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-exp-1206"],
    defaultModel: "gemini-1.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    signupUrl: "https://makersuite.google.com/app/apikey",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$",
  },

  // Fast & Affordable
  groq: {
    name: "Groq",
    description: "Ultra-fast inference with specialized hardware",
    category: "Fast",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "deepseek-r1-distill-llama-70b"],
    defaultModel: "llama-3.1-8b-instant",
    baseUrl: "https://api.groq.com/openai/v1",
    signupUrl: "https://console.groq.com/keys",
    embeddingSupport: false,
    icon: <Cpu className="w-4 h-4" />,
    pricing: "$",
  },
  fireworks: {
    name: "Fireworks AI",
    description: "Fast and cost-effective model serving",
    category: "Fast",
    models: ["llama-v3p3-70b-instruct", "llama-v3p1-8b-instruct", "qwen2p5-72b-instruct", "deepseek-v3"],
    defaultModel: "llama-v3p1-8b-instruct",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    signupUrl: "https://fireworks.ai/",
    embeddingSupport: true,
    icon: <Zap className="w-4 h-4" />,
    pricing: "$",
  },
  cerebras: {
    name: "Cerebras",
    description: "Extremely fast inference on specialized chips",
    category: "Fast",
    models: ["llama3.1-70b", "llama3.1-8b", "llama3.3-70b"],
    defaultModel: "llama3.1-8b",
    baseUrl: "https://api.cerebras.ai/v1",
    signupUrl: "https://cloud.cerebras.ai/",
    embeddingSupport: false,
    icon: <Cpu className="w-4 h-4" />,
    pricing: "$",
  },

  // Aggregators
  openrouter: {
    name: "OpenRouter",
    description: "Access to multiple AI models through one API",
    category: "Aggregator",
    models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-exp"],
    defaultModel: "openai/gpt-4o-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    signupUrl: "https://openrouter.ai/keys",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$$",
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to multiple AI providers",
    category: "Aggregator",
    models: ["gpt-4o", "claude-3-5-sonnet", "llama-3.3-70b", "deepseek-v3"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.aimlapi.com/v1",
    signupUrl: "https://aimlapi.com/",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$$",
  },

  // Specialized
  huggingface: {
    name: "Hugging Face",
    description: "Open-source models and inference",
    category: "Specialized",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "microsoft/Phi-3.5-mini-instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    baseUrl: "https://api-inference.huggingface.co",
    signupUrl: "https://huggingface.co/settings/tokens",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$",
  },
  perplexity: {
    name: "Perplexity",
    description: "Search-augmented language models",
    category: "Specialized",
    models: ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-huge-128k-online"],
    defaultModel: "llama-3.1-sonar-small-128k-online",
    baseUrl: "https://api.perplexity.ai",
    signupUrl: "https://www.perplexity.ai/settings/api",
    embeddingSupport: false,
    icon: <Search className="w-4 h-4" />,
    pricing: "$$",
  },

  // Additional providers
  deepinfra: {
    name: "DeepInfra",
    description: "Serverless inference for open-source models",
    category: "Cloud",
    models: ["meta-llama/Meta-Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct", "deepseek-ai/DeepSeek-V3"],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    signupUrl: "https://deepinfra.com/",
    embeddingSupport: true,
    icon: <Cpu className="w-4 h-4" />,
    pricing: "$",
  },
  replicate: {
    name: "Replicate",
    description: "Run machine learning models in the cloud",
    category: "Cloud",
    models: ["meta/llama-3.3-70b-instruct", "deepseek-ai/deepseek-v3", "qwen/qwen2.5-72b-instruct"],
    defaultModel: "meta/llama-3.3-70b-instruct",
    baseUrl: "https://api.replicate.com/v1",
    signupUrl: "https://replicate.com/account/api-tokens",
    embeddingSupport: false,
    icon: <Cpu className="w-4 h-4" />,
    pricing: "$$",
  },
  anyscale: {
    name: "Anyscale",
    description: "Scalable AI model serving",
    category: "Cloud",
    models: ["meta-llama/Llama-3.3-70b-instruct", "mistralai/Mistral-7B-Instruct-v0.3"],
    defaultModel: "meta-llama/Llama-3.3-70b-instruct",
    baseUrl: "https://api.endpoints.anyscale.com/v1",
    signupUrl: "https://console.anyscale.com/",
    embeddingSupport: false,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$$",
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
  chroma: {
    name: "ChromaDB",
    description: "Simple vector database for AI applications",
    category: "Self-hosted",
    requiresApiKey: false,
    requiresUrl: true,
    features: ["Open Source", "Simple API", "Local/Cloud"],
    limitations: ["Requires Setup", "Basic Features"],
    signupUrl: "https://www.trychroma.com/",
    icon: <Database className="w-4 h-4" />,
    difficulty: "Medium",
    defaultUrl: "http://localhost:8000",
    setupInstructions: "Run: docker run -p 8000:8000 chromadb/chroma",
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
  weaviate: {
    name: "Weaviate",
    description: "Open-source vector database with GraphQL",
    category: "Self-hosted",
    requiresApiKey: true,
    requiresUrl: true,
    features: ["Open Source", "GraphQL", "Hybrid Search", "Modules"],
    limitations: ["Complex Setup", "Resource Heavy"],
    signupUrl: "https://weaviate.io/",
    icon: <Globe className="w-4 h-4" />,
    difficulty: "Hard",
    defaultUrl: "http://localhost:8080",
    setupInstructions: "Follow Weaviate installation guide",
  },
}

interface UnifiedConfigurationProps {
  onTestAI: (config: any) => Promise<boolean>
  onTestVectorDB: (config: any) => Promise<boolean>
  onTestWandb: (config: any) => Promise<boolean>
}

export function UnifiedConfiguration({ onTestAI, onTestVectorDB, onTestWandb }: UnifiedConfigurationProps) {
  const { aiConfig, setAIConfig, vectorDBConfig, setVectorDBConfig, wandbConfig, setWandbConfig, addError } =
    useAppStore()

  const [showApiKeys, setShowApiKeys] = useState({
    ai: false,
    vectordb: false,
    wandb: false,
  })

  const [testingStatus, setTestingStatus] = useState({
    ai: "idle" as "idle" | "testing" | "success" | "error",
    vectordb: "idle" as "idle" | "testing" | "success" | "error",
    wandb: "idle" as "idle" | "testing" | "success" | "error",
  })

  const [selectedCategory, setSelectedCategory] = useState("Major")

  const handleAIProviderChange = (provider: keyof typeof AI_PROVIDERS) => {
    const providerInfo = AI_PROVIDERS[provider]
    setAIConfig({
      ...aiConfig,
      provider: provider as any,
      model: providerInfo.defaultModel,
      baseUrl: providerInfo.baseUrl,
      apiKey: "",
    })
    setTestingStatus((prev) => ({ ...prev, ai: "idle" }))
  }

  const handleVectorDBProviderChange = (provider: keyof typeof VECTOR_DB_PROVIDERS) => {
    const providerInfo = VECTOR_DB_PROVIDERS[provider]
    setVectorDBConfig({
      ...vectorDBConfig,
      provider: provider as any,
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

  const handleTestWandb = async () => {
    if (!wandbConfig.enabled) {
      addError({
        type: "warning",
        title: "Wandb Disabled",
        message: "Enable Wandb tracking first",
      })
      return
    }

    if (!wandbConfig.apiKey.trim()) {
      addError({
        type: "error",
        title: "Configuration Error",
        message: "Wandb API key is required",
      })
      return
    }

    setTestingStatus((prev) => ({ ...prev, wandb: "testing" }))

    try {
      const success = await onTestWandb(wandbConfig)
      setTestingStatus((prev) => ({ ...prev, wandb: success ? "success" : "error" }))

      if (success) {
        addError({
          type: "success",
          title: "Wandb Connection Successful",
          message: "Connected to Weights & Biases",
        })
      } else {
        addError({
          type: "error",
          title: "Wandb Connection Failed",
          message: "Unable to connect to Wandb. Check your API key and project settings.",
        })
      }
    } catch (error) {
      setTestingStatus((prev) => ({ ...prev, wandb: "error" }))
      addError({
        type: "error",
        title: "Wandb Test Failed",
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
    ([_, provider]) => provider.category === selectedCategory,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="w-5 h-5" />
        <h2 className="text-lg font-bold">SYSTEM CONFIGURATION</h2>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <TabsTrigger 
            value="ai"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:font-medium 
                       hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 rounded-md flex items-center justify-center py-2 px-1 whitespace-nowrap"
          >
            <Zap className="w-4 h-4 mr-1" />
            <span className="text-sm truncate">AI Provider</span>
          </TabsTrigger>
          <TabsTrigger 
            value="vectordb"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:font-medium 
                       hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 rounded-md flex items-center justify-center py-2 px-1 whitespace-nowrap"
          >
            <Database className="w-4 h-4 mr-1" />
            <span className="text-sm truncate">Vector DB</span>
          </TabsTrigger>
          <TabsTrigger 
            value="wandb"
            className="data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm data-[state=active]:font-medium 
                       hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 rounded-md flex items-center justify-center py-2 px-1 whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            <span className="text-sm truncate">Wandb</span>
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
                            {info.icon}
                            <span>{info.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {info.pricing}
                            </Badge>
                            {info.embeddingSupport && (
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
                        <Badge variant="outline" className="text-xs">
                          {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.pricing || '?'} pricing
                        </Badge>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Embedding Warning */}
                {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS] && !AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS].embeddingSupport && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This provider doesn't support embeddings. Document processing will use
                      fallback embeddings which may reduce search quality.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Provider Not Found Warning */}
                {!AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS] && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> Provider "{aiConfig.provider}" is not supported. Please select a different provider.
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

        {/* Wandb Configuration */}
        <TabsContent value="wandb">
          <Card className="border-2 border-black shadow-none">
            <CardHeader className="border-b border-black">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span>WANDB TRACKING</span>
                  {getStatusIcon(testingStatus.wandb)}
                </div>
                <Switch
                  checked={wandbConfig.enabled}
                  onCheckedChange={(enabled) => setWandbConfig({ ...wandbConfig, enabled })}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {wandbConfig.enabled ? (
                <>
                  {/* Info */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <strong>Weights & Biases</strong> integration for experiment tracking, metrics logging, and
                          model monitoring.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open("https://wandb.ai/settings", "_blank")}
                          className="h-6 text-xs border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Get API Key
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* API Key */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <div className="relative">
                      <Input
                        type={showApiKeys.wandb ? "text" : "password"}
                        value={wandbConfig.apiKey}
                        onChange={(e) => setWandbConfig({ ...wandbConfig, apiKey: e.target.value })}
                        placeholder="Enter your Wandb API key"
                        className="border-2 border-black pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeys((prev) => ({ ...prev, wandb: !prev.wandb }))}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                      >
                        {showApiKeys.wandb ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Project Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Project Name</label>
                      <Input
                        value={wandbConfig.projectName}
                        onChange={(e) => setWandbConfig({ ...wandbConfig, projectName: e.target.value })}
                        placeholder="pdf-rag-chatbot"
                        className="border-2 border-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Entity (Optional)</label>
                      <Input
                        value={wandbConfig.entityName || ""}
                        onChange={(e) => setWandbConfig({ ...wandbConfig, entityName: e.target.value })}
                        placeholder="your-username"
                        className="border-2 border-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Run Name (Optional)</label>
                    <Input
                      value={wandbConfig.runName || ""}
                      onChange={(e) => setWandbConfig({ ...wandbConfig, runName: e.target.value })}
                      placeholder="Auto-generated if empty"
                      className="border-2 border-black"
                    />
                  </div>

                  {/* Test Connection */}
                  {testingStatus.wandb === "testing" ? (
                    <WandbConfigurationLoadingSkeleton />
                  ) : (
                    <Button
                      onClick={handleTestWandb}
                      disabled={!wandbConfig.enabled || !wandbConfig.apiKey.trim() || !wandbConfig.projectName.trim()}
                      className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
                    >
                      Test Connection
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Enable Wandb tracking to monitor experiments and log metrics</p>
                  <p className="text-xs mt-2">Track model performance, document processing stats, and chat analytics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

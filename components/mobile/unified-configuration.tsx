"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  ChevronDown,
  ChevronRight,
  Smartphone,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { 
  ConfigurationTestingSkeleton, 
  APITestingSkeleton, 
  VectorDatabaseLoadingSkeleton, 
  WandbConfigurationLoadingSkeleton 
} from "@/components/skeleton-loaders"

// Same provider configurations as desktop
const AI_PROVIDERS = {
  // Major Providers
  openai: {
    name: "OpenAI",
    description: "Industry-leading GPT models",
    category: "Major",
    models: ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini", "gpt-4-turbo"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    signupUrl: "https://platform.openai.com/api-keys",
    embeddingSupport: true,
    icon: <Sparkles className="w-4 h-4" />,
    pricing: "$$",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude models with strong reasoning",
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
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-pro"],
    defaultModel: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    signupUrl: "https://makersuite.google.com/app/apikey",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$",
  },

  // Fast & Affordable
  groq: {
    name: "Groq",
    description: "Ultra-fast inference",
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
    description: "Fast and cost-effective",
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
    description: "Extremely fast inference",
    category: "Fast",
    models: ["llama3.3-70b", "llama3.1-8b", "llama3.1-70b"],
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
    description: "Access to 400+ AI models",
    category: "Aggregator",
    models: [
      "openai/gpt-4o", 
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet", 
      "meta-llama/llama-3.3-70b-instruct", 
      "google/gemini-2.0-flash-exp",
      "deepseek/deepseek-v3",
      "openai/o1-preview"
    ],
    defaultModel: "openai/gpt-4o-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    signupUrl: "https://openrouter.ai/keys",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$$",
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to 200+ providers",
    category: "Aggregator",
    models: [
      "gpt-4o",
      "gpt-4o-mini", 
      "claude-3-5-sonnet",
      "deepseek-v3",
      "deepseek-r1",
      "llama-3.3-70b",
      "gemini-2.5-pro",
      "gemini-2.5-flash"
    ],
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
    description: "Open-source models",
    category: "Specialized",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct", 
      "Qwen/Qwen2.5-7B-Instruct-1M", 
      "microsoft/Phi-4", 
      "deepseek-ai/DeepSeek-R1",
      "google/gemma-2-2b-it"
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    baseUrl: "https://api-inference.huggingface.co",
    signupUrl: "https://huggingface.co/settings/tokens",
    embeddingSupport: true,
    icon: <Globe className="w-4 h-4" />,
    pricing: "$",
  },
  perplexity: {
    name: "Perplexity",
    description: "Search-augmented models",
    category: "Specialized",
    models: [
      "llama-3.1-sonar-large-128k-online", 
      "llama-3.1-sonar-small-128k-online", 
      "llama-3.1-sonar-huge-128k-online"
    ],
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
    description: "Serverless open-source models",
    category: "Cloud",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct", 
      "Qwen/Qwen2.5-72B-Instruct", 
      "deepseek-ai/DeepSeek-V3"
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    signupUrl: "https://deepinfra.com/",
    embeddingSupport: true,
    icon: <Cpu className="w-4 h-4" />,
    pricing: "$",
  },
}

const VECTOR_DB_PROVIDERS = {
  local: {
    name: "Local Storage",
    description: "In-memory vector storage",
    category: "Free",
    requiresApiKey: false,
    requiresUrl: false,
    features: ["Free", "No Setup", "Local Only"],
    limitations: ["No Persistence", "Limited Scale"],
    icon: <Database className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "No setup required.",
    signupUrl: "",
  },
  chroma: {
    name: "ChromaDB",
    description: "Simple vector database",
    category: "Self-hosted",
    requiresApiKey: false,
    requiresUrl: true,
    features: ["Open Source", "Simple API"],
    limitations: ["Requires Setup"],
    signupUrl: "https://www.trychroma.com/",
    icon: <Database className="w-4 h-4" />,
    difficulty: "Medium",
    defaultUrl: "http://localhost:8000",
    setupInstructions: "Run: docker run -p 8000:8000 chromadb/chroma",
  },
  pinecone: {
    name: "Pinecone",
    description: "Managed vector database",
    category: "Managed",
    requiresApiKey: true,
    requiresUrl: false,
    features: ["Managed", "Scalable"],
    limitations: ["Paid Service"],
    signupUrl: "https://www.pinecone.io/",
    icon: <Zap className="w-4 h-4" />,
    difficulty: "Easy",
    defaultUrl: "",
    setupInstructions: "Create account and index at Pinecone.io",
  },
  weaviate: {
    name: "Weaviate",
    description: "Vector database with GraphQL",
    category: "Self-hosted",
    requiresApiKey: true,
    requiresUrl: true,
    features: ["Open Source", "GraphQL"],
    limitations: ["Complex Setup"],
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

  const [expandedSections, setExpandedSections] = useState({
    ai: true,
    vectordb: false,
    wandb: false,
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
          title: "AI Connected",
          message: `Connected to ${AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.name || aiConfig.provider}`,
        })
      } else {
        addError({
          type: "error",
          title: "AI Connection Failed",
          message: "Check your API key and configuration.",
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
          title: "Vector DB Connected",
          message: `Connected to ${provider.name}`,
        })
      } else {
        addError({
          type: "error",
          title: "Vector DB Failed",
          message: `Unable to connect to ${provider.name}.`,
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
          title: "Wandb Connected",
          message: "Connected to Weights & Biases",
        })
      } else {
        addError({
          type: "error",
          title: "Wandb Failed",
          message: "Check your API key and project settings.",
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const categories = Array.from(new Set(Object.values(AI_PROVIDERS).map(p => p.category)))

  return (
    <div className="space-y-3">
      {/* Mobile Header */}
      <div className="flex items-center space-x-2 mb-4">
        <Smartphone className="w-4 h-4 text-gray-600" />
        <h2 className="text-sm font-bold text-gray-900">CONFIGURATION</h2>
      </div>

      {/* AI Configuration Section */}
      <Collapsible
        open={expandedSections.ai}
        onOpenChange={() => toggleSection('ai')}
      >
        <Card className="border-2 border-black shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>AI PROVIDER</span>
                  {getStatusIcon(testingStatus.ai)}
                </CardTitle>
                {expandedSections.ai ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 space-y-3">
              {/* Category Filter - Mobile */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Category</Label>
                <ScrollArea className="w-full">
                  <div className="flex space-x-2 pb-2">
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                        className="whitespace-nowrap h-7 px-3 text-xs"
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Provider Selection - Mobile */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Provider</Label>
                <Select
                  value={aiConfig.provider}
                  onValueChange={handleAIProviderChange}
                >
                  <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AI_PROVIDERS)
                      .filter(([_, provider]) => provider.category === selectedCategory)
                      .map(([key, provider]) => (
                        <SelectItem key={key} value={key} className="text-sm">
                          <div className="flex items-center space-x-2">
                            {provider.icon}
                            <span>{provider.name}</span>
                            <Badge variant="outline" className="text-xs">{provider.pricing}</Badge>
                          </div>
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Provider Info - Mobile */}
              {aiConfig.provider && (
                <Alert>
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    <div className="space-y-1">
                      <p><strong>{AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.name}:</strong> {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS]?.embeddingSupport && (
                          <Badge variant="outline" className="text-xs border-green-600 text-green-600">
                            Embeddings
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* API Key - Mobile */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">API Key</Label>
                <div className="relative">
                  <Input
                    type={showApiKeys.ai ? "text" : "password"}
                    value={aiConfig.apiKey}
                    onChange={(e) => setAIConfig({ ...aiConfig, apiKey: e.target.value })}
                    placeholder="Enter your API key..."
                    className="border-2 border-black focus:ring-0 focus:border-black h-10 pr-10 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKeys(prev => ({ ...prev, ai: !prev.ai }))}
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                  >
                    {showApiKeys.ai ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {/* Model Selection - Mobile */}
              {aiConfig.provider && AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS] && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Model</Label>
                  <Select
                    value={aiConfig.model}
                    onValueChange={(value) => setAIConfig({ ...aiConfig, model: value })}
                  >
                    <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS[aiConfig.provider as keyof typeof AI_PROVIDERS].models.map((model) => (
                        <SelectItem key={model} value={model} className="text-sm">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Test AI Button - Mobile */}
              <Button
                onClick={handleTestAI}
                disabled={testingStatus.ai === "testing" || !aiConfig.apiKey || !aiConfig.model}
                className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black h-10 text-sm"
              >
                {testingStatus.ai === "testing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test AI Connection"
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Vector Database Section */}
      <Collapsible
        open={expandedSections.vectordb}
        onOpenChange={() => toggleSection('vectordb')}
      >
        <Card className="border-2 border-black shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>VECTOR DATABASE</span>
                  {getStatusIcon(testingStatus.vectordb)}
                </CardTitle>
                {expandedSections.vectordb ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 space-y-3">
              {/* Vector DB Provider Selection - Mobile */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Provider</Label>
                <Select
                  value={vectorDBConfig.provider}
                  onValueChange={handleVectorDBProviderChange}
                >
                  <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VECTOR_DB_PROVIDERS).map(([key, provider]) => (
                      <SelectItem key={key} value={key} className="text-sm">
                        <div className="flex items-center space-x-2">
                          {provider.icon}
                          <span>{provider.name}</span>
                          <Badge variant="outline" className="text-xs">{provider.category}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vector DB Info - Mobile */}
              {vectorDBConfig.provider && (
                <Alert>
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    <div className="space-y-1">
                      <p><strong>{VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.name}:</strong> {VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.description}</p>
                      <p className="text-xs text-gray-600">{VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.setupInstructions}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Vector DB API Key - Mobile */}
              {vectorDBConfig.provider && VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.requiresApiKey && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showApiKeys.vectordb ? "text" : "password"}
                      value={vectorDBConfig.apiKey || ""}
                      onChange={(e) => setVectorDBConfig({ ...vectorDBConfig, apiKey: e.target.value })}
                      placeholder="Enter your API key..."
                      className="border-2 border-black focus:ring-0 focus:border-black h-10 pr-10 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKeys(prev => ({ ...prev, vectordb: !prev.vectordb }))}
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                    >
                      {showApiKeys.vectordb ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Vector DB URL - Mobile */}
              {vectorDBConfig.provider && VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.requiresUrl && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Database URL</Label>
                  <Input
                    value={vectorDBConfig.url || ""}
                    onChange={(e) => setVectorDBConfig({ ...vectorDBConfig, url: e.target.value })}
                    placeholder={VECTOR_DB_PROVIDERS[vectorDBConfig.provider as keyof typeof VECTOR_DB_PROVIDERS]?.defaultUrl}
                    className="border-2 border-black focus:ring-0 focus:border-black h-10 text-sm"
                  />
                </div>
              )}

              {/* Test Vector DB Button - Mobile */}
              <Button
                onClick={handleTestVectorDB}
                disabled={testingStatus.vectordb === "testing"}
                className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black h-10 text-sm"
              >
                {testingStatus.vectordb === "testing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Vector DB"
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Wandb Section */}
      <Collapsible
        open={expandedSections.wandb}
        onOpenChange={() => toggleSection('wandb')}
      >
        <Card className="border-2 border-black shadow-sm">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>WANDB TRACKING</span>
                  {getStatusIcon(testingStatus.wandb)}
                </CardTitle>
                {expandedSections.wandb ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 space-y-3">
              {/* Wandb Enable Toggle - Mobile */}
              <div className="flex items-center justify-between">
                <Label htmlFor="wandb-enabled-mobile" className="text-xs font-medium">
                  Enable Tracking
                </Label>
                <Switch
                  id="wandb-enabled-mobile"
                  checked={wandbConfig.enabled}
                  onCheckedChange={(checked) =>
                    setWandbConfig({ ...wandbConfig, enabled: checked })
                  }
                />
              </div>

              {wandbConfig.enabled && (
                <>
                  {/* Wandb API Key - Mobile */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKeys.wandb ? "text" : "password"}
                        value={wandbConfig.apiKey}
                        onChange={(e) => setWandbConfig({ ...wandbConfig, apiKey: e.target.value })}
                        placeholder="Enter your Wandb API key..."
                        className="border-2 border-black focus:ring-0 focus:border-black h-10 pr-10 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKeys(prev => ({ ...prev, wandb: !prev.wandb }))}
                        className="absolute right-1 top-1 h-8 w-8 p-0"
                      >
                        {showApiKeys.wandb ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Wandb Project - Mobile */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Project Name</Label>
                    <Input
                      value={wandbConfig.projectName}
                      onChange={(e) => setWandbConfig({ ...wandbConfig, projectName: e.target.value })}
                      placeholder="quantum-pdf-chat"
                      className="border-2 border-black focus:ring-0 focus:border-black h-10 text-sm"
                    />
                  </div>

                  {/* Test Wandb Button - Mobile */}
                  <Button
                    onClick={handleTestWandb}
                    disabled={testingStatus.wandb === "testing" || !wandbConfig.apiKey}
                    className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black h-10 text-sm"
                  >
                    {testingStatus.wandb === "testing" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Wandb"
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
} 
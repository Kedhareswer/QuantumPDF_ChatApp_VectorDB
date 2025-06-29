"use client"

import type React from "react"

import { useState } from "react"
import { Zap, Eye, EyeOff, Check, X, AlertTriangle, Info, ExternalLink, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Same provider info as desktop version
const PROVIDER_INFO = {
  huggingface: {
    name: "Hugging Face",
    description: "Open-source models via Inference Providers",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct", 
      "Qwen/Qwen2.5-7B-Instruct-1M", 
      "microsoft/Phi-4", 
      "deepseek-ai/DeepSeek-R1",
      "google/gemma-2-2b-it"
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    baseUrl: "https://api-inference.huggingface.co",
    features: ["Text Generation", "Embeddings", "Free Tier"],
    limitations: ["Rate Limited", "Cold Start Delays", "Model Loading Time"],
    signupUrl: "https://huggingface.co/settings/tokens",
    embeddingSupport: true,
    disabled: false,
  },
  openai: {
    name: "OpenAI",
    description: "Premium API with high-quality models",
    models: ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini", "gpt-4-turbo"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    features: ["High Quality", "Fast Response", "Latest Models"],
    limitations: ["Paid Service", "Usage Limits", "API Costs"],
    signupUrl: "https://platform.openai.com/api-keys",
    embeddingSupport: true,
    disabled: false,
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude models with strong reasoning",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    defaultModel: "claude-3-5-sonnet-20241022",
    baseUrl: "https://api.anthropic.com",
    features: ["Strong Reasoning", "Long Context", "Safety Focused"],
    limitations: ["Paid Service", "No Embeddings", "Limited Availability"],
    signupUrl: "https://console.anthropic.com/",
    embeddingSupport: false,
    disabled: false,
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to 200+ AI models",
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
    features: ["200+ Models", "Competitive Pricing", "OpenAI Compatible"],
    limitations: ["Paid Service", "Third Party", "Model Availability"],
    signupUrl: "https://aimlapi.com/",
    embeddingSupport: true,
    disabled: false,
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference with specialized hardware",
    models: [
      "llama-3.3-70b-versatile", 
      "llama-3.1-8b-instant", 
      "gemma2-9b-it",
      "deepseek-r1-distill-llama-70b"
    ],
    defaultModel: "llama-3.1-8b-instant",
    baseUrl: "https://api.groq.com/openai/v1",
    features: ["Ultra Fast", "Low Latency", "Open Source Models"],
    limitations: ["Limited Models", "No Embeddings", "Rate Limits"],
    signupUrl: "https://console.groq.com/keys",
    embeddingSupport: false,
    disabled: false,
  },
  openrouter: {
    name: "OpenRouter",
    description: "Universal gateway to 400+ AI models",
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
    features: ["400+ Models", "Unified API", "Fallback Options"],
    limitations: ["Third Party", "Added Latency", "Cost Markup"],
    signupUrl: "https://openrouter.ai/keys",
    embeddingSupport: true,
    disabled: false,
  },
  deepinfra: {
    name: "DeepInfra",
    description: "Serverless open-source models",
    models: [
      "meta-llama/Meta-Llama-3.3-70B-Instruct", 
      "Qwen/Qwen2.5-72B-Instruct",
      "deepseek-ai/DeepSeek-V3"
    ],
    defaultModel: "meta-llama/Meta-Llama-3.3-70B-Instruct",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    features: ["Serverless", "Open Source Models", "Low Cost"],
    limitations: ["No Embeddings", "Limited Features", "API Reliability"],
    signupUrl: "https://deepinfra.com/",
    embeddingSupport: false,
    disabled: false,
  },
  deepseek: {
    name: "DeepSeek",
    description: "Advanced reasoning models",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-r1"],
    defaultModel: "deepseek-r1",
    baseUrl: "https://api.deepseek.com/v1",
    features: ["Advanced Reasoning", "Code Generation", "Cost Effective"],
    limitations: ["No Embeddings", "Limited Availability", "API Costs"],
    signupUrl: "https://platform.deepseek.com/",
    embeddingSupport: false,
    disabled: false,
  },
  googleai: {
    name: "Google AI Studio",
    description: "Gemini models with multimodal capabilities",
    models: [
      "gemini-2.5-pro", 
      "gemini-2.5-flash", 
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro"
    ],
    defaultModel: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1",
    features: ["Multimodal", "Google Knowledge", "Fast Response"],
    limitations: ["No Embeddings", "API Costs", "Limited Models"],
    signupUrl: "https://aistudio.google.com/",
    embeddingSupport: false,
    disabled: false,
  },
  vertex: {
    name: "Google Vertex AI",
    description: "Enterprise AI platform with embeddings",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "text-embedding-gecko"],
    defaultModel: "gemini-2.5-pro",
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1",
    features: ["Enterprise Grade", "Embeddings", "Google Cloud Integration"],
    limitations: ["Complex Setup", "API Costs", "GCP Required"],
    signupUrl: "https://console.cloud.google.com/",
    embeddingSupport: true,
    disabled: false,
  },
  mistral: {
    name: "Mistral AI",
    description: "European AI models with strong capabilities",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    defaultModel: "mistral-large-latest",
    baseUrl: "https://api.mistral.ai/v1",
    features: ["European Hosting", "Strong Performance", "Privacy Focus"],
    limitations: ["No Embeddings", "Limited Models", "API Costs"],
    signupUrl: "https://console.mistral.ai/",
    embeddingSupport: false,
    disabled: false,
  },
  perplexity: {
    name: "Perplexity",
    description: "Search-augmented models with real-time knowledge",
    models: [
      "llama-3.1-sonar-large-128k-online", 
      "llama-3.1-sonar-small-128k-online",
      "llama-3.1-sonar-huge-128k-online"
    ],
    defaultModel: "llama-3.1-sonar-small-128k-online",
    baseUrl: "https://api.perplexity.ai",
    features: ["Real-time Knowledge", "Search Augmented", "Online Access"],
    limitations: ["No Embeddings", "Limited Features", "API Costs"],
    signupUrl: "https://www.perplexity.ai/settings/api",
    embeddingSupport: false,
    disabled: false,
  },
  xai: {
    name: "xAI (Grok)",
    description: "Real-time knowledge models",
    models: ["grok-3-beta", "grok-3-mini-beta", "grok-beta"],
    defaultModel: "grok-3-mini-beta",
    baseUrl: "https://api.xai.com/v1",
    features: ["Real-time Knowledge", "Strong Reasoning", "Fast Response"],
    limitations: ["No Embeddings", "Limited Availability", "API Costs"],
    signupUrl: "https://grok.x.ai/",
    embeddingSupport: false,
    disabled: false,
  },
  alibaba: {
    name: "Alibaba Cloud",
    description: "Qwen models with multilingual capabilities",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    defaultModel: "qwen-turbo",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    features: ["Multilingual", "Chinese Excellence", "Cloud Integration"],
    limitations: ["No Embeddings", "Limited Global Availability", "API Costs"],
    signupUrl: "https://www.alibabacloud.com/",
    embeddingSupport: false,
    disabled: false,
  },
  minimax: {
    name: "MiniMax",
    description: "Chinese conversational AI models",
    models: ["abab5.5-chat", "abab5-chat", "abab4-chat"],
    defaultModel: "abab5.5-chat",
    baseUrl: "https://api.minimax.chat/v1",
    features: ["Chinese Excellence", "Conversational Focus", "Cultural Context"],
    limitations: ["No Embeddings", "Limited Global Availability", "API Costs"],
    signupUrl: "https://api.minimax.chat/",
    embeddingSupport: false,
    disabled: false,
  },
}

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
  apiKey: string
  model: string
  baseUrl?: string
}

interface EnhancedAPIConfigurationProps {
  config: AIConfig
  onConfigChange: (config: AIConfig) => void
  onTestConnection: (config: AIConfig) => Promise<boolean>
  onError: (error: string, details?: string) => void
  onSuccess: (message: string) => void
}

const handleProviderChange = ({
  provider,
  onConfigChange,
  onError,
  config,
  setConnectionStatus,
}: {
  provider: AIConfig["provider"]
  onConfigChange: EnhancedAPIConfigurationProps["onConfigChange"]
  onError: EnhancedAPIConfigurationProps["onError"]
  config: AIConfig
  setConnectionStatus: React.Dispatch<React.SetStateAction<"idle" | "success" | "error">>
}) => {
  const providerInfo = PROVIDER_INFO[provider]

  if (providerInfo.disabled) {
    onError("Provider Disabled", `${providerInfo.name} is currently disabled. Please select another provider.`)
    return
  }

  onConfigChange({
    ...config,
    provider,
    model: providerInfo.defaultModel,
    baseUrl: providerInfo.baseUrl,
    apiKey: "",
  })
  setConnectionStatus("idle")
}

export function EnhancedAPIConfiguration({
  config,
  onConfigChange,
  onTestConnection,
  onError,
  onSuccess,
}: EnhancedAPIConfigurationProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [testProgress, setTestProgress] = useState(0)
  const [showProviderInfo, setShowProviderInfo] = useState(false)

  const currentProvider = PROVIDER_INFO[config.provider]

  const handleModelChange = (model: string) => {
    onConfigChange({
      ...config,
      model,
    })
    setConnectionStatus("idle")
  }

  const handleApiKeyChange = (apiKey: string) => {
    onConfigChange({
      ...config,
      apiKey,
    })
    setConnectionStatus("idle")
  }

  const handleBaseUrlChange = (baseUrl: string) => {
    onConfigChange({
      ...config,
      baseUrl,
    })
    setConnectionStatus("idle")
  }

  const validateConfig = (): string | null => {
    if (!config.apiKey.trim()) {
      return "API key is required"
    }

    if (!config.model.trim()) {
      return "Model selection is required"
    }

    if (config.baseUrl && config.baseUrl.trim() && !isValidUrl(config.baseUrl)) {
      return "Invalid base URL format"
    }

    return null
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleTestConnection = async () => {
    const validationError = validateConfig()
    if (validationError) {
      onError("Configuration Error", validationError)
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus("idle")
    setTestProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setTestProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const success = await onTestConnection(config)

      clearInterval(progressInterval)
      setTestProgress(100)

      if (success) {
        setConnectionStatus("success")
        onSuccess(`Successfully connected to ${currentProvider.name}`)
      } else {
        setConnectionStatus("error")
        onError(
          "Connection Failed",
          `Unable to connect to ${currentProvider.name}. Please check your API key and try again.`,
        )
      }
    } catch (error) {
      setConnectionStatus("error")
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      onError("Connection Test Failed", errorMessage)
    } finally {
      setIsTestingConnection(false)
      setTimeout(() => setTestProgress(0), 1000)
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case "success":
        return <Check className="w-4 h-4 text-green-600" />
      case "error":
        return <X className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  return (
    <Card className="border-2 border-black shadow-none">
      <CardHeader className="border-b border-black p-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Zap className="w-4 h-4" />
          <span>AI PROVIDER CONFIG</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Mobile Provider Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Provider</label>
          <Select
            value={config.provider}
            onValueChange={(value) =>
              handleProviderChange({
                provider: value as AIConfig["provider"],
                onConfigChange,
                onError,
                config,
                setConnectionStatus,
              })
            }
          >
            <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <SelectItem
                  key={key}
                  value={key}
                  disabled={info.disabled}
                  className={info.disabled ? "opacity-50 cursor-not-allowed" : ""}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm">{info.name}</span>
                    <div className="flex space-x-1">
                      {info.disabled && (
                        <Badge variant="outline" className="text-xs bg-red-100 border-red-300">
                          Disabled
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {info.embeddingSupport ? "Embeddings" : "Text Only"}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Provider Information - Collapsible */}
        <Collapsible open={showProviderInfo} onOpenChange={setShowProviderInfo}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between h-8 text-xs"
            >
              <div className="flex items-center space-x-1">
                <Info className="w-3 h-3" />
                <span>Provider Info</span>
              </div>
              <ChevronDown className={`w-3 h-3 transition-transform ${showProviderInfo ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Alert className="mt-2">
              <Info className="h-3 w-3" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="text-xs">
                    <strong>{currentProvider.name}:</strong> {currentProvider.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentProvider.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs border-green-600 text-green-600">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  {currentProvider.limitations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {currentProvider.limitations.map((limitation) => (
                        <Badge key={limitation} variant="outline" className="text-xs border-yellow-600 text-yellow-600">
                          {limitation}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <span className="text-xs">Need an API key?</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-600"
                      onClick={() => window.open(currentProvider.signupUrl, "_blank")}
                    >
                      Get one here
                      <ExternalLink className="w-2 h-2 ml-1" />
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </Collapsible>

        {/* Mobile API Key Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter your API key..."
              className="border-2 border-black focus:ring-0 focus:border-black h-10 pr-10 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-1 top-1 h-8 w-8 p-0"
            >
              {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Mobile Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Model</label>
          <Select value={config.model} onValueChange={handleModelChange}>
            <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentProvider.models.map((model) => (
                <SelectItem key={model} value={model} className="text-sm">
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Base URL - Only show if different from default */}
        {config.baseUrl !== currentProvider.baseUrl && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Custom Base URL</label>
            <Input
              value={config.baseUrl || ""}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder={currentProvider.baseUrl}
              className="border-2 border-black focus:ring-0 focus:border-black h-10 text-sm"
            />
          </div>
        )}

        {/* Mobile Test Connection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Connection Status</span>
            {getConnectionStatusIcon()}
          </div>
          
          {isTestingConnection && testProgress > 0 && (
            <Progress value={testProgress} className="h-2" />
          )}

          <Button
            onClick={handleTestConnection}
            disabled={isTestingConnection || !config.apiKey || !config.model}
            className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black h-10 text-sm"
          >
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
        </div>

        {/* Mobile Connection Status Messages */}
        {connectionStatus === "success" && (
          <Alert className="border-green-500 bg-green-50">
            <Check className="h-3 w-3 text-green-600" />
            <AlertDescription className="text-xs text-green-700">
              Connection successful! Your AI provider is ready to use.
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus === "error" && (
          <Alert className="border-red-500 bg-red-50">
            <X className="h-3 w-3 text-red-600" />
            <AlertDescription className="text-xs text-red-700">
              Connection failed. Please check your API key and settings.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
} 
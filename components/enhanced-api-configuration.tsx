"use client"

import { useState } from "react"
import { Zap, Eye, EyeOff, Check, X, AlertTriangle, Info, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

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
    | "google"
    | "vertex"
    | "mistral"
    | "perplexity"
    | "together"
    | "xai"
    | "alibaba"
    | "minimax"
  apiKey: string
  model: string
  baseUrl?: string
}

const PROVIDER_INFO = {
  huggingface: {
    name: "Hugging Face",
    description: "Free inference API with rate limits",
    models: [
      "HuggingFaceH4/zephyr-7b-beta",
      "microsoft/DialoGPT-medium",
      "facebook/blenderbot-400M-distill",
      "mistralai/Mistral-7B-Instruct-v0.1",
      "meta-llama/Llama-2-7b-chat-hf",
    ],
    defaultModel: "HuggingFaceH4/zephyr-7b-beta",
    baseUrl: "https://api-inference.huggingface.co",
    features: ["Text Generation", "Embeddings", "Free Tier"],
    limitations: ["Rate Limited", "Cold Start Delays", "Model Loading Time"],
    signupUrl: "https://huggingface.co/settings/tokens",
    embeddingSupport: true,
  },
  openai: {
    name: "OpenAI",
    description: "Premium API with high-quality models",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    features: ["High Quality", "Fast Response", "Latest Models"],
    limitations: ["Paid Service", "Usage Limits", "API Costs"],
    signupUrl: "https://platform.openai.com/api-keys",
    embeddingSupport: true,
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude models with strong reasoning",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
    baseUrl: "https://api.anthropic.com",
    features: ["Strong Reasoning", "Long Context", "Safety Focused"],
    limitations: ["Paid Service", "No Embeddings", "Limited Availability"],
    signupUrl: "https://console.anthropic.com/",
    embeddingSupport: false,
  },
  aiml: {
    name: "AIML API",
    description: "OpenAI-compatible API with competitive pricing",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "claude-3-5-sonnet-20241022", "llama-3.1-405b-instruct"],
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.aimlapi.com/v1",
    features: ["OpenAI Compatible", "Competitive Pricing", "Multiple Models"],
    limitations: ["Paid Service", "Third Party", "API Reliability"],
    signupUrl: "https://aimlapi.com/",
    embeddingSupport: true,
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference with specialized hardware",
    models: [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma-7b-it",
      "llama3-groq-70b-8192-tool-use-preview",
    ],
    defaultModel: "llama-3.1-8b-instant",
    baseUrl: "https://api.groq.com/openai/v1",
    features: ["Ultra Fast", "Low Latency", "Open Source Models"],
    limitations: ["Limited Models", "No Embeddings", "Rate Limits"],
    signupUrl: "https://console.groq.com/keys",
    embeddingSupport: false,
  },
  openrouter: {
    name: "OpenRouter",
    description: "Universal API gateway with access to hundreds of AI models",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.1-405b-instruct",
      "google/gemini-pro-1.5",
      "mistralai/mistral-large",
      "cohere/command-r-plus",
      "deepseek/deepseek-chat",
      "qwen/qwen-2.5-72b-instruct",
    ],
    defaultModel: "openai/gpt-4o-mini",
    baseUrl: "https://openrouter.ai/api/v1",
    features: ["Universal Access", "Hundreds of Models", "Transparent Pricing"],
    limitations: ["Paid Service", "No Embeddings", "Third Party"],
    signupUrl: "https://openrouter.ai/keys",
    embeddingSupport: false,
  },
  cohere: {
    name: "Cohere",
    description: "Enterprise-grade language models with embeddings",
    models: ["command-r-plus", "command-r", "command", "command-nightly", "command-light"],
    defaultModel: "command-r",
    baseUrl: "https://api.cohere.ai/v1",
    features: ["Enterprise Grade", "Embeddings", "RAG Optimized"],
    limitations: ["Paid Service", "Limited Free Tier"],
    signupUrl: "https://dashboard.cohere.ai/api-keys",
    embeddingSupport: true,
  },
  deepinfra: {
    name: "DeepInfra",
    description: "Serverless inference for open-source models",
    models: [
      "meta-llama/Meta-Llama-3.1-70B-Instruct",
      "meta-llama/Meta-Llama-3.1-8B-Instruct",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "microsoft/WizardLM-2-8x22B",
      "cognitivecomputations/dolphin-2.6-mixtral-8x7b",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    features: ["Open Source Models", "Serverless", "Cost Effective"],
    limitations: ["No Embeddings", "Third Party", "Model Availability"],
    signupUrl: "https://deepinfra.com/",
    embeddingSupport: false,
  },
  deepseek: {
    name: "DeepSeek",
    description: "Advanced reasoning models with competitive performance",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    features: ["Advanced Reasoning", "Code Generation", "Competitive Pricing"],
    limitations: ["No Embeddings", "Limited Availability"],
    signupUrl: "https://platform.deepseek.com/api_keys",
    embeddingSupport: false,
  },
  google: {
    name: "Google AI Studio",
    description: "Google's Gemini models via AI Studio",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro", "gemini-1.5-pro-002"],
    defaultModel: "gemini-1.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    features: ["Multimodal", "Long Context", "Fast Response"],
    limitations: ["No Embeddings", "API Quotas"],
    signupUrl: "https://aistudio.google.com/app/apikey",
    embeddingSupport: false,
  },
  vertex: {
    name: "Google Vertex AI",
    description: "Google Cloud's enterprise AI platform",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro", "text-bison", "chat-bison"],
    defaultModel: "gemini-1.5-flash",
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1",
    features: ["Enterprise Grade", "Embeddings", "Google Cloud"],
    limitations: ["Complex Setup", "GCP Required"],
    signupUrl: "https://console.cloud.google.com/vertex-ai",
    embeddingSupport: true,
  },
  mistral: {
    name: "Mistral AI",
    description: "European AI with strong performance models",
    models: [
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "open-mistral-7b",
      "open-mixtral-8x7b",
    ],
    defaultModel: "mistral-small-latest",
    baseUrl: "https://api.mistral.ai/v1",
    features: ["European AI", "Strong Performance", "Open Models"],
    limitations: ["No Embeddings", "Limited Availability"],
    signupUrl: "https://console.mistral.ai/",
    embeddingSupport: false,
  },
  perplexity: {
    name: "Perplexity",
    description: "Search-augmented language models",
    models: [
      "llama-3.1-sonar-small-128k-online",
      "llama-3.1-sonar-large-128k-online",
      "llama-3.1-sonar-huge-128k-online",
      "llama-3.1-8b-instruct",
      "llama-3.1-70b-instruct",
    ],
    defaultModel: "llama-3.1-sonar-small-128k-online",
    baseUrl: "https://api.perplexity.ai",
    features: ["Search Augmented", "Real-time Info", "Citation Support"],
    limitations: ["No Embeddings", "Search Focused"],
    signupUrl: "https://www.perplexity.ai/settings/api",
    embeddingSupport: false,
  },
  together: {
    name: "Together AI",
    description: "Fast inference for open-source models",
    models: [
      "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
      "togethercomputer/RedPajama-INCITE-Chat-3B-v1",
    ],
    defaultModel: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    baseUrl: "https://api.together.xyz/v1",
    features: ["Fast Inference", "Open Source", "Competitive Pricing"],
    limitations: ["No Embeddings", "Model Availability"],
    signupUrl: "https://api.together.xyz/settings/api-keys",
    embeddingSupport: false,
  },
  xai: {
    name: "xAI (Grok)",
    description: "Elon Musk's AI with real-time knowledge",
    models: ["grok-beta", "grok-vision-beta"],
    defaultModel: "grok-beta",
    baseUrl: "https://api.x.ai/v1",
    features: ["Real-time Knowledge", "Uncensored", "X Integration"],
    limitations: ["No Embeddings", "Limited Access", "Beta"],
    signupUrl: "https://console.x.ai/",
    embeddingSupport: false,
  },
  alibaba: {
    name: "Alibaba Cloud",
    description: "Qwen models from Alibaba Cloud",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-max-longcontext"],
    defaultModel: "qwen-turbo",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    features: ["Chinese Language", "Long Context", "Multimodal"],
    limitations: ["No Embeddings", "Regional Access"],
    signupUrl: "https://dashscope.console.aliyun.com/",
    embeddingSupport: false,
  },
  minimax: {
    name: "MiniMax",
    description: "Chinese AI company with conversational models",
    models: ["abab6.5s-chat", "abab6.5-chat", "abab5.5s-chat", "abab5.5-chat"],
    defaultModel: "abab6.5s-chat",
    baseUrl: "https://api.minimax.chat/v1",
    features: ["Conversational AI", "Chinese Support", "Role Playing"],
    limitations: ["No Embeddings", "Chinese Focused"],
    signupUrl: "https://www.minimax.chat/",
    embeddingSupport: false,
  },
}

interface EnhancedAPIConfigurationProps {
  config: AIConfig
  onConfigChange: (config: AIConfig) => void
  onTestConnection: (config: AIConfig) => Promise<boolean>
  onError: (error: string, details?: string) => void
  onSuccess: (message: string) => void
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

  const currentProvider = PROVIDER_INFO[config.provider]

  const handleProviderChange = (provider: AIConfig["provider"]) => {
    const providerInfo = PROVIDER_INFO[provider]
    onConfigChange({
      ...config,
      provider,
      model: providerInfo.defaultModel,
      baseUrl: providerInfo.baseUrl,
    })
    setConnectionStatus("idle")
  }

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
      // Simulate progress
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
      <CardHeader className="border-b border-black">
        <CardTitle className="flex items-center space-x-2">
          <Zap className="w-5 h-5" />
          <span>AI PROVIDER CONFIGURATION</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Provider</label>
          <Select value={config.provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center space-x-2">
                    <span>{info.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {info.embeddingSupport ? "Embeddings" : "Text Only"}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider Information */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="text-sm">
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
              <div className="flex items-center space-x-2">
                <span className="text-xs">Need an API key?</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(currentProvider.signupUrl, "_blank")}
                  className="h-6 text-xs border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Get API Key
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Embedding Support Warning */}
        {!currentProvider.embeddingSupport && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> {currentProvider.name} does not support embeddings. Document processing will use
              fallback embeddings, which may reduce accuracy.
            </AlertDescription>
          </Alert>
        )}

        {/* API Key Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={`Enter your ${currentProvider.name} API key`}
              className="border-2 border-black focus:ring-0 focus:border-black pr-20"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              {getConnectionStatusIcon()}
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="p-1 hover:bg-gray-100">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            Get your API key from{" "}
            <a
              href={currentProvider.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {currentProvider.name}
            </a>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <Select value={config.model} onValueChange={handleModelChange}>
            <SelectTrigger className="border-2 border-black focus:ring-0 focus:border-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentProvider.models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Base URL (Advanced) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Base URL (Advanced)</label>
          <Input
            value={config.baseUrl || ""}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder={currentProvider.baseUrl}
            className="border-2 border-black focus:ring-0 focus:border-black"
          />
          <div className="text-xs text-gray-600">
            Leave empty to use default. Only change if using a custom endpoint.
          </div>
        </div>

        {/* Test Connection */}
        <div className="space-y-2">
          {isTestingConnection && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Testing connection...</span>
                <span>{testProgress}%</span>
              </div>
              <Progress value={testProgress} className="h-2" />
            </div>
          )}

          <Button
            onClick={handleTestConnection}
            disabled={!config.apiKey.trim() || isTestingConnection}
            className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
          >
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>
        </div>

        {/* Connection Status */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span>Connection Status:</span>
            <Badge
              variant="outline"
              className={
                connectionStatus === "success"
                  ? "border-green-600 text-green-600"
                  : connectionStatus === "error"
                    ? "border-red-600 text-red-600"
                    : "border-gray-400 text-gray-600"
              }
            >
              {connectionStatus === "success" ? "Connected" : connectionStatus === "error" ? "Error" : "Not Tested"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

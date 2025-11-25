"use client"

import { useState } from "react"
import { Settings, Eye, EyeOff, Check, X, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface APIConfig {
  provider: "huggingface" | "openai" | "anthropic" | "aiml" | "groq"
  apiKey: string
  model: string
  baseUrl?: string
}

interface APIConfigurationProps {
  config: APIConfig
  onConfigChange: (config: APIConfig) => void
  onTestConnection: (config: APIConfig) => Promise<boolean>
}

const PROVIDER_MODELS = {
  huggingface: [
    "meta-llama/Meta-Llama-3.3-70B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "deepseek-ai/DeepSeek-V3",
    "mistralai/Mistral-Small-3.2-Instruct",
    "google/gemma-2-27b-it",
  ],
  openai: ["gpt-5.1", "gpt-5-mini", "gpt-5-nano", "gpt-4o", "o3-2025-04-16"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-latest",
    "claude-3-sonnet-20250219",
    "claude-3-7-sonnet-latest",
    "claude-opus-4-0",
  ],
  aiml: [
    "gpt-5.1",
    "claude-3-5-sonnet-20241022",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "llama-3.3-70b-instruct",
    "deepseek-v3",
    "mistral-small-2506",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "mixtral-8x22b",
    "deepseek-r1-distill-llama-70b",
    "gemma2-27b-it",
    "qwen2.5-32b",
  ],
}

const PROVIDER_INFO = {
  huggingface: {
    name: "Hugging Face",
    description: "Latest open-source leaders (Llama 3.3, Qwen2.5, DeepSeek-V3)",
    baseUrl: "https://api-inference.huggingface.co",
    keyFormat: "hf_xxxxxxxxxx",
  },
  openai: {
    name: "OpenAI",
    description: "GPT-5 family, GPT-4o Omni, and o-series reasoning models",
    baseUrl: "https://api.openai.com/v1",
    keyFormat: "sk-xxxxxxxxxx",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude 3.5 family with extended context and reasoning",
    baseUrl: "https://api.anthropic.com",
    keyFormat: "sk-ant-xxxxxxxxxx",
  },
  aiml: {
    name: "AI/ML API",
    description: "Unified access to GPT-5.1, Claude 3.5, Gemini 2.5, DeepSeek V3, Mistral",
    baseUrl: "https://api.aimlapi.com/v1",
    keyFormat: "xxxxxxxxxx",
  },
  groq: {
    name: "Groq",
    description: "Ultra-fast inference for Llama 3.3, Mixtral, DeepSeek, Gemma, Qwen",
    baseUrl: "https://api.groq.com/openai/v1",
    keyFormat: "gsk_xxxxxxxxxx",
  },
}

export function APIConfiguration({ config, onConfigChange, onTestConnection }: APIConfigurationProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleProviderChange = (provider: APIConfig["provider"]) => {
    const providerInfo = PROVIDER_INFO[provider]
    const defaultModel = PROVIDER_MODELS[provider][0]

    onConfigChange({
      ...config,
      provider,
      model: defaultModel,
      baseUrl: providerInfo.baseUrl,
      apiKey: "", // Clear API key when switching providers
    })
    setConnectionStatus("idle")
  }

  const handleModelChange = (model: string) => {
    onConfigChange({
      ...config,
      model,
    })
  }

  const handleApiKeyChange = (apiKey: string) => {
    onConfigChange({
      ...config,
      apiKey,
    })
    setConnectionStatus("idle")
  }

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      setErrorMessage("Please enter an API key")
      setConnectionStatus("error")
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus("idle")
    setErrorMessage("")

    try {
      const success = await onTestConnection(config)
      setConnectionStatus(success ? "success" : "error")
      if (!success) {
        setErrorMessage("Connection failed. Please check your API key and try again.")
      }
    } catch (error) {
      setConnectionStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "Connection test failed")
    } finally {
      setIsTestingConnection(false)
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
          <Settings className="w-5 h-5" />
          <span>API CONFIGURATION</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">AI Provider</label>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(PROVIDER_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => handleProviderChange(key as APIConfig["provider"])}
                className={`p-3 border-2 text-left transition-colors ${
                  config.provider === key ? "border-black bg-black text-white" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="font-medium">{info.name}</div>
                <div className="text-xs opacity-75">{info.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <select
            value={config.model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full p-2 border-2 border-black focus:ring-0 focus:border-black"
          >
            {PROVIDER_MODELS[config.provider].map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={`Enter your ${PROVIDER_INFO[config.provider].name} API key`}
              className="border-2 border-black focus:ring-0 focus:border-black pr-20"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              {getConnectionStatusIcon()}
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="p-1 hover:bg-gray-100">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600">Format: {PROVIDER_INFO[config.provider].keyFormat}</div>
        </div>

        {/* Base URL (for custom endpoints) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Base URL</label>
          <Input
            value={config.baseUrl || ""}
            onChange={(e) => onConfigChange({ ...config, baseUrl: e.target.value })}
            placeholder="Custom API endpoint (optional)"
            className="border-2 border-black focus:ring-0 focus:border-black"
          />
        </div>

        {/* Test Connection */}
        <div className="space-y-2">
          <Button
            onClick={handleTestConnection}
            disabled={!config.apiKey.trim() || isTestingConnection}
            className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
          >
            {isTestingConnection ? "Testing..." : "Test Connection"}
          </Button>

          {connectionStatus === "success" && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Connection successful! Ready to use {PROVIDER_INFO[config.provider].name}.
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === "error" && (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Provider Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>{PROVIDER_INFO[config.provider].name}:</strong> {PROVIDER_INFO[config.provider].description}
            <br />
            <span className="text-xs">Your API key is stored locally and never sent to our servers.</span>
          </AlertDescription>
        </Alert>

        {/* Current Status */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span>Status:</span>
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

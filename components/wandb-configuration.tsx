"use client"

import { useState } from "react"
import { BarChart3, Eye, EyeOff, Check, X, ExternalLink, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"

interface WandbConfig {
  enabled: boolean
  apiKey: string
  projectName: string
  entityName?: string
  tags: string[]
}

interface WandbConfigurationProps {
  config: WandbConfig
  onConfigChange: (config: WandbConfig) => void
  onTestConnection: (config: WandbConfig) => Promise<boolean>
}

export function WandbConfiguration({ config, onConfigChange, onTestConnection }: WandbConfigurationProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [newTag, setNewTag] = useState("")

  const handleToggleEnabled = (enabled: boolean) => {
    onConfigChange({
      ...config,
      enabled,
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

  const handleProjectNameChange = (projectName: string) => {
    onConfigChange({
      ...config,
      projectName,
    })
  }

  const handleEntityNameChange = (entityName: string) => {
    onConfigChange({
      ...config,
      entityName,
    })
  }

  const handleAddTag = () => {
    if (newTag.trim() && !config.tags.includes(newTag.trim())) {
      onConfigChange({
        ...config,
        tags: [...config.tags, newTag.trim()],
      })
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onConfigChange({
      ...config,
      tags: config.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  const handleTestConnection = async () => {
    if (!config.enabled) {
      setErrorMessage("Please enable Wandb tracking first")
      setConnectionStatus("error")
      return
    }

    if (!config.apiKey.trim()) {
      setErrorMessage("Please enter a Wandb API key")
      setConnectionStatus("error")
      return
    }

    if (!config.projectName.trim()) {
      setErrorMessage("Please enter a project name")
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
        setErrorMessage("Connection failed. Please check your API key and project settings.")
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>WANDB TRACKING</span>
          </div>
          <Switch checked={config.enabled} onCheckedChange={handleToggleEnabled} />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Information Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Weights & Biases</strong> integration allows you to track experiments, log metrics, and monitor
                model performance.
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-xs">Need an API key?</span>
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
            </div>
          </AlertDescription>
        </Alert>

        {config.enabled && (
          <>
            {/* API Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Enter your Wandb API key"
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
                Format: Your Wandb API key from{" "}
                <a
                  href="https://wandb.ai/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  wandb.ai/settings
                </a>
              </div>
            </div>

            {/* Project Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={config.projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  placeholder="pdf-rag-chatbot"
                  className="border-2 border-black focus:ring-0 focus:border-black"
                />
                <div className="text-xs text-gray-600">The project to log experiments to</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Entity (Optional)</label>
                <Input
                  value={config.entityName || ""}
                  onChange={(e) => handleEntityNameChange(e.target.value)}
                  placeholder="your-username"
                  className="border-2 border-black focus:ring-0 focus:border-black"
                />
                <div className="text-xs text-gray-600">Your Wandb username or team name</div>
              </div>
            </div>

            {/* Tags Configuration */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex space-x-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  className="border-2 border-black focus:ring-0 focus:border-black"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                />
                <Button
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                  className="border-2 border-black bg-white text-black hover:bg-black hover:text-white"
                >
                  Add
                </Button>
              </div>
              {config.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-black text-black cursor-pointer hover:bg-black hover:text-white"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-600">Tags help organize and filter your experiments</div>
            </div>

            {/* Test Connection */}
            <div className="space-y-2">
              <Button
                onClick={handleTestConnection}
                disabled={!config.apiKey.trim() || !config.projectName.trim() || isTestingConnection}
                className="w-full border-2 border-black bg-white text-black hover:bg-black hover:text-white"
              >
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>

              {connectionStatus === "success" && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    Connection successful! Wandb tracking is ready to use.
                    <br />
                    <span className="text-xs">
                      Experiments will be logged to project: <strong>{config.projectName}</strong>
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus === "error" && (
                <Alert variant="destructive">
                  <X className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>{errorMessage}</div>
                      <div className="text-xs">
                        <strong>Common issues:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Invalid API key</li>
                          <li>Network connectivity issues</li>
                          <li>Project name contains invalid characters</li>
                          <li>Insufficient permissions</li>
                        </ul>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

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
          </>
        )}

        {!config.enabled && (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Enable Wandb tracking to monitor experiments and log metrics</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

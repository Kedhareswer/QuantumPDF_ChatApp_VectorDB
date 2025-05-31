"use client"

import { useState, useEffect } from "react"
import { Upload, MessageCircle, FileText, Brain, Activity, Settings, Zap, Database, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PDFProcessorFinal } from "@/components/pdf-processor-final"
import { ChatInterface } from "@/components/chat-interface"
import { EnhancedAPIConfiguration } from "@/components/enhanced-api-configuration"
import { WandbConfiguration } from "@/components/wandb-configuration"
import { DocumentLibrary } from "@/components/document-library"
import { SystemStatus } from "@/components/system-status"
import { QuickActions } from "@/components/quick-actions"
import { ErrorHandler, useErrorHandler } from "@/components/error-handler"
import { ErrorBoundary } from "@/components/error-boundary"
import { RAGEngine } from "@/lib/rag-engine"
import { WandbTracker } from "@/lib/wandb-tracker"
import { LoadingIndicator } from "@/components/loading-indicator"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
  metadata?: {
    responseTime: number
    relevanceScore: number
    retrievedChunks: number
  }
}

interface AIConfig {
  provider: "huggingface" | "openai" | "anthropic" | "aiml" | "groq"
  apiKey: string
  model: string
  baseUrl?: string
}

interface WandbConfig {
  enabled: boolean
  apiKey: string
  projectName: string
  entityName?: string
  tags: string[]
}

export default function PDFChatbot() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [ragEngine, setRagEngine] = useState<RAGEngine | null>(null)
  const [wandbTracker, setWandbTracker] = useState<WandbTracker | null>(null)
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error" | "config">("config")
  const [activeTab, setActiveTab] = useState("setup")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { errors, addError, dismissError, clearErrors, addApiError, addNetworkError, addValidationError, addSuccess } =
    useErrorHandler()

  const [apiConfig, setApiConfig] = useState<AIConfig>({
    provider: "huggingface",
    apiKey: "",
    model: "HuggingFaceH4/zephyr-7b-beta",
    baseUrl: "https://api-inference.huggingface.co",
  })

  const [wandbConfig, setWandbConfig] = useState<WandbConfig>({
    enabled: false,
    apiKey: "",
    projectName: "pdf-rag-chatbot",
    entityName: "",
    tags: ["pdf-rag", "chatbot", "ai"],
  })

  useEffect(() => {
    // Initialize RAG Engine
    const rag = new RAGEngine()
    setRagEngine(rag)

    // Load saved configurations from localStorage
    loadSavedConfigurations()
  }, [])

  const loadSavedConfigurations = () => {
    try {
      const savedApiConfig = localStorage.getItem("apiConfig")
      if (savedApiConfig) {
        const parsed = JSON.parse(savedApiConfig)
        // Don't save API keys in localStorage for security
        setApiConfig({ ...parsed, apiKey: "" })
      }

      const savedWandbConfig = localStorage.getItem("wandbConfig")
      if (savedWandbConfig) {
        const parsed = JSON.parse(savedWandbConfig)
        // Don't save API keys in localStorage for security
        setWandbConfig({ ...parsed, apiKey: "" })
      }
    } catch (error) {
      console.warn("Failed to load saved configurations:", error)
    }
  }

  const saveConfiguration = (type: "api" | "wandb", config: any) => {
    try {
      const configToSave = { ...config }
      // Remove API key for security
      delete configToSave.apiKey
      localStorage.setItem(`${type}Config`, JSON.stringify(configToSave))
    } catch (error) {
      console.warn("Failed to save configuration:", error)
    }
  }

  const handleApiConfigChange = (newConfig: AIConfig) => {
    setApiConfig(newConfig)
    setModelStatus("config")
    saveConfiguration("api", newConfig)
  }

  const handleWandbConfigChange = (newConfig: WandbConfig) => {
    setWandbConfig(newConfig)
    saveConfiguration("wandb", newConfig)
  }

  const handleTestApiConnection = async (config: AIConfig): Promise<boolean> => {
    try {
      if (!ragEngine) {
        throw new Error("RAG engine not available")
      }

      setModelStatus("loading")
      await ragEngine.initialize(config)
      setModelStatus("ready")

      // Auto-switch to chat tab after successful connection
      if (documents.length > 0) {
        setActiveTab("chat")
      }

      return true
    } catch (error) {
      console.error("API connection test failed:", error)
      setModelStatus("error")

      if (error instanceof Error) {
        addApiError(config.provider, error.message)
      } else {
        addApiError(config.provider, "Unknown error occurred")
      }

      return false
    }
  }

  const handleTestWandbConnection = async (config: WandbConfig): Promise<boolean> => {
    try {
      if (!config.enabled || !config.apiKey.trim()) {
        throw new Error("Wandb is not properly configured")
      }

      // Initialize Wandb tracker with new config
      const tracker = new WandbTracker()
      await tracker.initialize(config)
      setWandbTracker(tracker)

      return true
    } catch (error) {
      console.error("Wandb connection test failed:", error)

      if (error instanceof Error) {
        addError({
          type: "error",
          title: "Wandb Connection Failed",
          message: error.message,
          dismissible: true,
        })
      }

      return false
    }
  }

  const handleDocumentProcessed = async (document: Document) => {
    try {
      if (!document || typeof document !== "object") {
        throw new Error("Invalid document object")
      }

      setDocuments((prev) => [...prev, document])

      if (ragEngine && modelStatus === "ready") {
        await ragEngine.addDocument(document)
      }

      if (wandbTracker && wandbConfig.enabled) {
        try {
          await wandbTracker.logDocumentIngestion(document)
        } catch (wandbError) {
          console.warn("Failed to log to Wandb:", wandbError)
        }
      }

      addSuccess(`Document "${document.name}" processed successfully`)

      // Auto-switch to chat tab after first document
      if (documents.length === 0 && modelStatus === "ready") {
        setActiveTab("chat")
      }
    } catch (error) {
      console.error("Error handling processed document:", error)

      if (error instanceof Error) {
        addError({
          type: "error",
          title: "Document Processing Error",
          message: error.message,
          dismissible: true,
        })
      }

      // Still add to documents list even if other operations fail
      setDocuments((prev) => [...prev, document])
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      addValidationError("Message", "Please enter a valid message")
      return
    }

    if (!ragEngine) {
      addError({
        type: "error",
        title: "System Error",
        message: "RAG engine is not available. Please refresh the page and try again.",
        dismissible: true,
      })
      return
    }

    if (modelStatus !== "ready") {
      addError({
        type: "warning",
        title: "Configuration Required",
        message: "Please configure and test your AI provider connection first.",
        dismissible: true,
        action: {
          label: "Go to Setup",
          handler: () => setActiveTab("setup"),
        },
      })
      return
    }

    if (documents.length === 0) {
      addError({
        type: "warning",
        title: "No Documents",
        message: "Please upload some documents before asking questions.",
        dismissible: true,
        action: {
          label: "Upload Documents",
          handler: () => setActiveTab("setup"),
        },
      })
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    let response = null
    let startTime = 0
    let endTime = 0

    try {
      if (!ragEngine.isHealthy()) {
        throw new Error("RAG engine is not in a healthy state")
      }

      startTime = Date.now()
      response = await ragEngine.query(content.trim())
      endTime = Date.now()

      if (!response) {
        throw new Error("No response received from RAG engine")
      }

      const answer = response.answer || "I apologize, but I couldn't generate a proper response."
      const sources = Array.isArray(response.sources) ? response.sources : []
      const relevanceScore =
        typeof response.relevanceScore === "number" && !isNaN(response.relevanceScore) ? response.relevanceScore : 0
      const retrievedChunks =
        response.retrievedChunks && Array.isArray(response.retrievedChunks) ? response.retrievedChunks : []

      const responseTime = endTime - startTime

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        sources: sources,
        metadata: {
          responseTime,
          relevanceScore,
          retrievedChunks: retrievedChunks.length,
        },
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Log to Wandb if enabled
      if (wandbTracker && wandbConfig.enabled) {
        try {
          await wandbTracker.logInteraction({
            query: content.trim(),
            response: answer,
            sources: sources,
            responseTime,
            relevanceScore,
            retrievedChunks: retrievedChunks.length,
          })
        } catch (wandbError) {
          console.warn("Failed to log to Wandb:", wandbError)
        }
      }
    } catch (error) {
      console.error("Error processing message:", error)

      let errorMessage = "I apologize, but I encountered an error processing your request."
      let actionable = false

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()

        if (errorMsg.includes("not initialized") || errorMsg.includes("not in a healthy state")) {
          errorMessage = "The system is not properly configured. Please check your API settings and try again."
          actionable = true
        } else if (errorMsg.includes("no documents") || errorMsg.includes("documents available")) {
          errorMessage = "Please upload some documents first before asking questions."
          actionable = true
        } else if (errorMsg.includes("invalid question") || errorMsg.includes("question provided")) {
          errorMessage = "Please provide a valid question."
        } else if (errorMsg.includes("embedding") || errorMsg.includes("generate")) {
          errorMessage =
            "There was an issue processing your question. Please check your API configuration or try rephrasing."
          actionable = true
        } else if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
          addNetworkError("process your message")
          return
        }
      }

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorResponse])

      if (actionable) {
        addError({
          type: "error",
          title: "Message Processing Error",
          message: errorMessage,
          dismissible: true,
          action: {
            label: "Check Settings",
            handler: () => setActiveTab("setup"),
          },
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveDocument = (documentId: string) => {
    try {
      setDocuments((docs) => docs.filter((doc) => doc.id !== documentId))

      if (ragEngine) {
        ragEngine.removeDocument(documentId)
      }

      addSuccess("Document removed successfully")
    } catch (error) {
      console.error("Error removing document:", error)
      addError({
        type: "error",
        title: "Remove Document Error",
        message: "Failed to remove document. Please try again.",
        dismissible: true,
      })
    }
  }

  const getStatusDisplay = () => {
    switch (modelStatus) {
      case "ready":
        return { text: "READY", color: "text-green-600", icon: "●" }
      case "loading":
        return { text: "LOADING", color: "text-yellow-600", icon: "◐" }
      case "error":
        return { text: "ERROR", color: "text-red-600", icon: "●" }
      case "config":
        return { text: "CONFIG", color: "text-blue-600", icon: "○" }
      default:
        return { text: "UNKNOWN", color: "text-gray-600", icon: "○" }
    }
  }

  const status = getStatusDisplay()

  if (modelStatus === "loading") {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-white text-black font-mono flex items-center justify-center">
          <LoadingIndicator message="Initializing AI provider..." />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white text-black font-mono">
        {/* Error Handler */}
        <ErrorHandler errors={errors} onDismiss={dismissError} />

        {/* Enhanced Header */}
        <header className="border-b-2 border-black bg-white sticky top-0 z-40">
          <div className="max-w-full mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo and Title */}
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 border-2 border-black bg-black text-white flex items-center justify-center">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">PDF RAG CHATBOT</h1>
                  <p className="text-xs text-gray-600 mt-1">Enhanced AI Document Analysis & Chat</p>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 px-3 py-2 border border-black">
                  <span className={`${status.color} font-bold`}>{status.icon}</span>
                  <span className="text-sm font-medium">{status.text}</span>
                </div>
                <Badge variant="outline" className="border-black text-black font-mono">
                  <Database className="w-3 h-3 mr-1" />
                  {documents.length} DOCS
                </Badge>
                <Badge variant="outline" className="border-black text-black font-mono">
                  <Zap className="w-3 h-3 mr-1" />
                  {apiConfig.provider.toUpperCase()}
                </Badge>
                {wandbConfig.enabled && (
                  <Badge variant="outline" className="border-green-600 text-green-600 font-mono">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    WANDB
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Application Layout */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Enhanced Sidebar */}
          <div
            className={`${sidebarCollapsed ? "w-16" : "w-80"} border-r-2 border-black bg-gray-50 transition-all duration-300 flex flex-col`}
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-black bg-white">
              <div className="flex items-center justify-between">
                {!sidebarCollapsed && <h2 className="font-bold text-lg">CONTROL PANEL</h2>}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 border border-black hover:bg-black hover:text-white transition-colors"
                >
                  {sidebarCollapsed ? "→" : "←"}
                </button>
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {!sidebarCollapsed ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-4 bg-white border-b border-black rounded-none">
                    <TabsTrigger value="setup" className="data-[state=active]:bg-black data-[state=active]:text-white">
                      <Settings className="w-4 h-4 mr-2" />
                      SETUP
                    </TabsTrigger>
                    <TabsTrigger value="docs" className="data-[state=active]:bg-black data-[state=active]:text-white">
                      <FileText className="w-4 h-4 mr-2" />
                      DOCS
                    </TabsTrigger>
                    <TabsTrigger value="wandb" className="data-[state=active]:bg-black data-[state=active]:text-white">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      WANDB
                    </TabsTrigger>
                    <TabsTrigger value="status" className="data-[state=active]:bg-black data-[state=active]:text-white">
                      <Activity className="w-4 h-4 mr-2" />
                      STATUS
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="setup" className="h-full m-0 p-4 space-y-4 overflow-y-auto">
                      <EnhancedAPIConfiguration
                        config={apiConfig}
                        onConfigChange={handleApiConfigChange}
                        onTestConnection={handleTestApiConnection}
                        onError={(error, details) =>
                          addError({
                            type: "error",
                            title: "API Configuration Error",
                            message: error,
                            details,
                            dismissible: true,
                          })
                        }
                        onSuccess={addSuccess}
                      />

                      <Card className="border-2 border-black shadow-none">
                        <CardHeader className="border-b border-black">
                          <CardTitle className="flex items-center space-x-2">
                            <Upload className="w-5 h-5" />
                            <span>UPLOAD DOCUMENTS</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <PDFProcessorFinal
                            onDocumentProcessed={handleDocumentProcessed}
                            isProcessing={isProcessing}
                            setIsProcessing={setIsProcessing}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="docs" className="h-full m-0 p-4 overflow-y-auto">
                      <DocumentLibrary documents={documents} onRemoveDocument={handleRemoveDocument} />
                    </TabsContent>

                    <TabsContent value="wandb" className="h-full m-0 p-4 overflow-y-auto">
                      <WandbConfiguration
                        config={wandbConfig}
                        onConfigChange={handleWandbConfigChange}
                        onTestConnection={handleTestWandbConnection}
                      />
                    </TabsContent>

                    <TabsContent value="status" className="h-full m-0 p-4 overflow-y-auto">
                      <SystemStatus
                        modelStatus={modelStatus}
                        apiConfig={apiConfig}
                        documents={documents}
                        messages={messages}
                        ragEngine={ragEngine}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              ) : (
                <div className="p-2 space-y-4">
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false)
                      setActiveTab("setup")
                    }}
                    className="w-full p-3 border border-black hover:bg-black hover:text-white transition-colors"
                    title="Setup"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false)
                      setActiveTab("docs")
                    }}
                    className="w-full p-3 border border-black hover:bg-black hover:text-white transition-colors"
                    title="Documents"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false)
                      setActiveTab("wandb")
                    }}
                    className="w-full p-3 border border-black hover:bg-black hover:text-white transition-colors"
                    title="Wandb"
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSidebarCollapsed(false)
                      setActiveTab("status")
                    }}
                    className="w-full p-3 border border-black hover:bg-black hover:text-white transition-colors"
                    title="Status"
                  >
                    <Activity className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="border-b border-black bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">CHAT INTERFACE</h2>
                    <p className="text-sm text-gray-600">
                      {modelStatus === "ready"
                        ? `Ready with ${apiConfig.model} • ${documents.length} documents loaded`
                        : "Configure your AI provider to start chatting"}
                    </p>
                  </div>
                </div>

                {modelStatus === "ready" && (
                  <QuickActions
                    onClearChat={() => {
                      setMessages([])
                      addSuccess("Chat history cleared")
                    }}
                    onNewSession={() => {
                      setMessages([])
                      setDocuments([])
                      if (ragEngine) {
                        ragEngine.clearDocuments()
                      }
                      clearErrors()
                      addSuccess("New session started")
                    }}
                    disabled={isProcessing}
                  />
                )}
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 bg-gray-50">
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                disabled={modelStatus !== "ready" || documents.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Enhanced Footer */}
        <footer className="border-t-2 border-black bg-white p-4">
          <div className="max-w-full mx-auto">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="font-bold">ENHANCED RAG-POWERED PDF CHATBOT</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-600">CONFIGURABLE AI PROVIDERS</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-600">WANDB INTEGRATION</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-600">COMPREHENSIVE ERROR HANDLING</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span>v2.1</span>
                <span>•</span>
                <span>{new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}

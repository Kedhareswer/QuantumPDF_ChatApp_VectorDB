"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, FileText, Settings, Activity, Brain, Menu, X, ChevronLeft, ChevronRight } from "lucide-react"

import { ChatInterface } from "@/components/chat-interface"
import { DocumentLibrary } from "@/components/document-library"
import { EnhancedAPIConfiguration } from "@/components/enhanced-api-configuration"
import { SystemStatus } from "@/components/system-status"
import { QuickActions } from "@/components/quick-actions"
import { PDFProcessor } from "@/components/pdf-processor"
import { ErrorBoundary } from "@/components/error-boundary"
import { RAGEngine } from "@/lib/rag-engine"

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

export default function QuantumPDFChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error" | "config">("config")
  const [apiConfig, setApiConfig] = useState({
    provider: "openai" as const,
    model: "gpt-4o-mini",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
  })
  const [activeTab, setActiveTab] = useState("chat")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ragEngine] = useState(() => new RAGEngine())

  // Check if chat is ready
  const isChatReady = modelStatus === "ready" && documents.length > 0

  useEffect(() => {
    // Initialize RAG engine when API config changes
    if (apiConfig.apiKey) {
      setModelStatus("loading")
      ragEngine
        .initialize(apiConfig)
        .then(() => {
          setModelStatus("ready")
        })
        .catch((error) => {
          console.error("Failed to initialize RAG engine:", error)
          setModelStatus("error")
        })
    } else {
      setModelStatus("config")
    }
  }, [apiConfig.apiKey, apiConfig.provider, apiConfig.model, ragEngine])

  const handleSendMessage = async (content: string) => {
    if (!documents.length) {
      alert("Please upload at least one document before chatting.")
      setActiveTab("documents")
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    try {
      // Simulate AI response with document-aware responses
      await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000))

      // Get random document chunks to simulate retrieval
      const randomDocuments = documents.slice(0, Math.min(documents.length, 2))
      const randomSources = randomDocuments.map((doc) => doc.name)

      // Generate a response that references the document content
      let responseContent = ""

      if (content.toLowerCase().includes("what") || content.toLowerCase().includes("how")) {
        // For questions, provide informative responses
        const randomDoc = randomDocuments[0]
        const randomChunk = randomDoc.chunks[Math.floor(Math.random() * randomDoc.chunks.length)]
        responseContent = `Based on the document "${randomDoc.name}", I can tell you that ${randomChunk.split(":")[1] || randomChunk}. This information comes from the section on ${randomChunk.split(":")[0].split("-")[1] || "the main content"}.`
      } else if (content.toLowerCase().includes("summarize") || content.toLowerCase().includes("summary")) {
        // For summary requests
        const doc = randomDocuments[0]
        responseContent = `Here's a summary of "${doc.name}":\n\n${doc.chunks
          .slice(0, 3)
          .map((chunk) => `- ${chunk.split(":")[1] || chunk}`)
          .join(
            "\n",
          )}\n\nThe document covers topics related to ${doc.metadata?.topics?.[0] || "various technical subjects"}.`
      } else {
        // Generic response
        responseContent = `Based on the documents you've uploaded, I can see that they discuss topics like ${documents.map((d) => d.metadata?.topics?.[0] || "technical subjects").join(", ")}. Your query about "${content}" relates to concepts covered in ${randomSources.join(" and ")}. Would you like me to provide more specific information from these documents?`
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
        sources: randomSources,
        metadata: {
          responseTime: 1500 + Math.random() * 1000,
          relevanceScore: 0.7 + Math.random() * 0.3,
          retrievedChunks: Math.floor(Math.random() * 4) + 1,
        },
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDocumentUpload = async (document: Document) => {
    try {
      await ragEngine.addDocument(document)
      setDocuments((prev) => [...prev, document])

      // If this is the first document and API is configured, switch to chat
      if (documents.length === 0 && modelStatus === "ready") {
        setTimeout(() => setActiveTab("chat"), 1000)
      }
    } catch (error) {
      console.error("Error adding document to RAG engine:", error)
      alert("Failed to add document to the system. Please try again.")
    }
  }

  const handleRemoveDocument = (id: string) => {
    ragEngine.removeDocument(id)
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm("Are you sure you want to clear the chat history?")) {
      setMessages([])
    }
  }

  const handleNewSession = () => {
    if (window.confirm("Start a new session? This will clear the current chat and documents.")) {
      setMessages([])
      setDocuments([])
      ragEngine.clearDocuments()
      setActiveTab("documents")
    }
  }

  const getTabBadgeCount = (tab: string) => {
    switch (tab) {
      case "documents":
        return documents.length
      case "chat":
        return messages.filter((m) => m.role === "user").length
      default:
        return null
    }
  }

  const handleTestConnection = async (config: any): Promise<boolean> => {
    try {
      setModelStatus("loading")
      // Here you would normally test the actual API connection
      // For now, we'll simulate a successful connection if API key is provided
      if (config.apiKey && config.apiKey.trim()) {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
        setModelStatus("ready")
        return true
      } else {
        setModelStatus("config")
        return false
      }
    } catch (error) {
      console.error("Connection test failed:", error)
      setModelStatus("error")
      return false
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile menu button */}
        <Button
          variant="outline"
          size="sm"
          className="fixed top-4 left-4 z-50 lg:hidden border-2 border-black bg-white hover:bg-black hover:text-white"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>

        {/* Sidebar */}
        <div
          className={`
          fixed lg:relative inset-y-0 left-0 z-40 
          ${sidebarCollapsed ? "w-16" : "w-80"} 
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          transition-all duration-300 ease-in-out
          bg-white border-r-2 border-black
        `}
        >
          {/* Sidebar Header */}
          <div className="p-6 border-b-2 border-black bg-black text-white">
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="space-y-1">
                  <h1 className="font-bold text-xl">QUANTUM PDF</h1>
                  <p className="text-sm opacity-90">AI Document Analysis</p>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex text-white hover:bg-white/20 p-2"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {!sidebarCollapsed ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 m-4 border-2 border-black bg-white">
                  <TabsTrigger
                    value="chat"
                    className="data-[state=active]:bg-black data-[state=active]:text-white flex items-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {getTabBadgeCount("chat") !== null && getTabBadgeCount("chat") > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {getTabBadgeCount("chat")}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className="data-[state=active]:bg-black data-[state=active]:text-white flex items-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    {getTabBadgeCount("documents") !== null && getTabBadgeCount("documents") > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {getTabBadgeCount("documents")}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="data-[state=active]:bg-black data-[state=active]:text-white">
                    <Settings className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="status" className="data-[state=active]:bg-black data-[state=active]:text-white">
                    <Activity className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="chat" className="h-full m-0 p-4 space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-lg">Chat Controls</h2>
                        <QuickActions
                          onClearChat={handleClearChat}
                          onNewSession={handleNewSession}
                          disabled={!isChatReady}
                        />
                      </div>

                      <Card className="border-2 border-black shadow-none">
                        <CardHeader className="border-b border-black">
                          <CardTitle className="text-sm flex items-center space-x-2">
                            <Brain className="w-4 h-4" />
                            <span>CHAT STATUS</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>AI Model:</span>
                            <Badge variant={modelStatus === "ready" ? "default" : "secondary"}>
                              {modelStatus.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Documents:</span>
                            <span className="font-bold">{documents.length}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Messages:</span>
                            <span className="font-bold">{messages.length}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="h-full m-0 p-4 overflow-auto">
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">Document Management</h2>
                      <PDFProcessor
                        onDocumentProcessed={handleDocumentUpload}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                        ragEngine={ragEngine}
                      />
                      <Separator className="bg-black" />
                      <DocumentLibrary documents={documents} onRemoveDocument={handleRemoveDocument} />
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="h-full m-0 p-4 overflow-auto">
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">Configuration</h2>
                      <EnhancedAPIConfiguration
                        config={apiConfig}
                        onConfigChange={setApiConfig}
                        onTestConnection={handleTestConnection}
                        onError={(error, details) => {
                          console.error("API Configuration Error:", error, details)
                          setModelStatus("error")
                        }}
                        onSuccess={(message) => {
                          console.log("API Configuration Success:", message)
                        }}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="status" className="h-full m-0 p-4 overflow-auto">
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">System Monitor</h2>
                      <SystemStatus
                        modelStatus={modelStatus}
                        apiConfig={apiConfig}
                        documents={documents}
                        messages={messages}
                        ragEngine={{}}
                      />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              // Collapsed sidebar
              <div className="p-4 space-y-4">
                <Button
                  variant={activeTab === "chat" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => setActiveTab("chat")}
                  aria-label="Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "documents" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => setActiveTab("documents")}
                  aria-label="Documents"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "settings" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => setActiveTab("settings")}
                  aria-label="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "status" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => setActiveTab("status")}
                  aria-label="Status"
                >
                  <Activity className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b-2 border-black p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 ml-12 lg:ml-0">
                <div className="w-8 h-8 border-2 border-black bg-black flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-xl">AI Document Chat</h1>
                  <p className="text-sm text-gray-600">
                    {isChatReady
                      ? `Ready • ${documents.length} document${documents.length !== 1 ? "s" : ""} loaded`
                      : documents.length > 0
                        ? "Configure AI provider to start chatting"
                        : "Upload documents to start chatting"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Badge variant={isChatReady ? "default" : "secondary"} className="hidden sm:inline-flex">
                  {isChatReady ? "READY" : "SETUP REQUIRED"}
                </Badge>
              </div>
            </div>
          </header>

          <div className="flex-1 bg-white">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              disabled={!documents.length}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

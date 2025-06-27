"use client"

import { useEffect, useState, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  FileText,
  Settings,
  Activity,
  Brain,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Zap,
  Database,
} from "lucide-react"

import { ChatInterface } from "@/components/chat-interface"
import { DocumentLibrary } from "@/components/document-library"
import { UnifiedConfiguration } from "@/components/unified-configuration"
import { SystemStatus } from "@/components/system-status"
import { QuickActions } from "@/components/quick-actions"
import { UnifiedPDFProcessor } from "@/components/unified-pdf-processor"
import { EnhancedSearch } from "@/components/enhanced-search"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorHandler } from "@/components/error-handler"
import { useAppStore } from "@/lib/store"
import { RAGEngine } from "@/lib/rag-engine"
import { VectorDatabaseClient } from "@/lib/vector-database-client"
import { LoadingIndicator } from "@/components/loading-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TabContentLoadingSkeleton } from "@/components/skeleton-loaders"

export default function QuantumPDFChatbot() {
  const {
    // State
    messages,
    documents,
    aiConfig,
    vectorDBConfig,
    wandbConfig,
    isProcessing,
    modelStatus,
    activeTab,
    sidebarOpen,
    sidebarCollapsed,
    errors,

    // Actions
    addMessage,
    clearMessages,
    addDocument,
    removeDocument,
    clearDocuments,
    setIsProcessing,
    setModelStatus,
    setActiveTab,
    setSidebarOpen,
    setSidebarCollapsed,
    addError,
    removeError,
  } = useAppStore()

  const [ragEngine] = useState(() => new RAGEngine())
  const [vectorDB, setVectorDB] = useState(() => new VectorDatabaseClient(vectorDBConfig))
  
  // Search state
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isTabLoading, setIsTabLoading] = useState(false)

  // Check if chat is ready
  const isChatReady = modelStatus === "ready" && documents.length > 0

  // Initialize RAG engine with store config
  useEffect(() => {
    const initializeRAG = async () => {
      try {
        if (aiConfig.apiKey && aiConfig.provider) {
      setModelStatus("loading")
          console.log("Initializing RAG engine with config:", {
            provider: aiConfig.provider,
            model: aiConfig.model,
            hasApiKey: !!aiConfig.apiKey
          })
          
          await ragEngine.initialize(aiConfig)
          setModelStatus("ready")
          console.log("RAG engine initialized successfully")
        } else {
          setModelStatus("config")
          console.log("RAG engine waiting for configuration")
        }
      } catch (error) {
          console.error("Failed to initialize RAG engine:", error)
          setModelStatus("error")
        
          addError({
            type: "error",
          title: "RAG Engine Error",
          message: error instanceof Error ? error.message : "Failed to initialize RAG engine",
        })
      }
    }

    initializeRAG()
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.model]) // Re-initialize when config changes

  useEffect(() => {
    // Initialize vector database when config changes
    const newVectorDB = new VectorDatabaseClient(vectorDBConfig)
    setVectorDB(newVectorDB)

    newVectorDB.initialize().catch((error) => {
      console.error("Failed to initialize vector database:", error)
      addError({
        type: "warning",
        title: "Vector DB Warning",
        message: `Using local storage: ${error.message}`,
      })
    })
  }, [vectorDBConfig, addError])

  const handleSendMessage = async (content: string) => {
    if (!documents.length) {
      addError({
        type: "warning",
        title: "No Documents",
        message: "Please upload at least one document before chatting.",
      })
      setActiveTab("documents")
      return
    }

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content,
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setIsProcessing(true)

    try {
      const response = await ragEngine.query(content)

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
        metadata: {
          responseTime: 1500,
          relevanceScore: response.relevanceScore,
          retrievedChunks: response.retrievedChunks.length,
        },
      }

      addMessage(assistantMessage)
    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "I'm sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
      }

      addMessage(errorMessage)
      addError({
        type: "error",
        title: "Chat Error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDocumentUpload = async (document: any) => {
    try {
      await ragEngine.addDocument(document)
      addDocument(document)

      // Add to vector database
      const vectorDocuments = document.chunks.map((chunk: string, index: number) => ({
        id: `${document.id}_${index}`,
        content: chunk,
        embedding: document.embeddings[index] || [],
        metadata: {
          source: document.name,
          chunkIndex: index,
          documentId: document.id,
          timestamp: document.uploadedAt,
        },
      }))

      await vectorDB.addDocuments(vectorDocuments)

      // If this is the first document and AI is configured, switch to chat
      if (documents.length === 0 && modelStatus === "ready") {
        setTimeout(() => setActiveTab("chat"), 1000)
      }

      addError({
        type: "success",
        title: "Document Added",
        message: `Successfully processed ${document.name}`,
      })
    } catch (error) {
      console.error("Error adding document:", error)
      addError({
        type: "error",
        title: "Document Processing Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleRemoveDocument = async (id: string) => {
    try {
      ragEngine.removeDocument(id)
      await vectorDB.deleteDocument(id)
      removeDocument(id)

      addError({
        type: "info",
        title: "Document Removed",
        message: "Document has been removed from the system",
      })
    } catch (error) {
      console.error("Error removing document:", error)
      addError({
        type: "error",
        title: "Removal Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm("Are you sure you want to clear the chat history?")) {
      clearMessages()
    }
  }

  const handleNewSession = () => {
    if (window.confirm("Start a new session? This will clear the current chat and documents.")) {
      clearMessages()
      clearDocuments()
      ragEngine.clearDocuments()
      vectorDB.clear()
      setActiveTab("documents")
    }
  }

  const handleSearch = async (query: string, filters: any) => {
    try {
      setIsSearching(true)
      
      // Generate embedding for the query or use empty array if not available
      let embedding: number[] = []
      try {
        // Call the RAG engine to generate embeddings (avoiding direct access to aiClient)
        embedding = await ragEngine.generateEmbedding(query)
      } catch (err) {
        console.error("Could not generate embedding, using fallback:", err)
      }

      // Search using vector database
      const results = await vectorDB.search(query, embedding, {
        mode: filters.searchMode,
        filters: filters.documentTypes ? { documentId: { $in: filters.documentTypes } } : undefined,
        limit: filters.maxResults,
        threshold: filters.relevanceThreshold,
      })

      // Transform results to match expected format
      const transformedResults = results.map((result, index) => ({
        id: result.id || `result-${index}`,
        content: result.content,
        score: result.score,
        metadata: {
          source: result.metadata?.source || "Unknown Document",
          documentId: result.metadata?.documentId || result.id,
          chunkIndex: result.metadata?.chunkIndex || 0,
          timestamp: result.metadata?.timestamp || new Date().toISOString(),
        }
      }))

      setSearchResults(transformedResults)
      return transformedResults
    } catch (error) {
      console.error("Search failed:", error)
      addError({
        type: "error",
        title: "Search Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
      setSearchResults([])
      return []
    } finally {
      setIsSearching(false)
    }
  }

  const handleTestAI = async (config: any): Promise<boolean> => {
    try {
      setModelStatus("loading")
      await ragEngine.updateConfig(config)
      setModelStatus("ready")
      return true
    } catch (error) {
      console.error("AI test failed:", error)
      setModelStatus("error")
      return false
    }
  }

  const handleTestVectorDB = async (config: any): Promise<boolean> => {
    try {
      const testDB = new VectorDatabaseClient(config)
      await testDB.initialize()
      return await testDB.testConnection()
    } catch (error) {
      console.error("Vector DB test failed:", error)
      return false
    }
  }

  const handleTestWandb = async (config: any): Promise<boolean> => {
    try {
      // Simulate Wandb connection test
      if (config.apiKey && config.projectName) {
        return true
      }
      return false
    } catch (error) {
      console.error("Wandb test failed:", error)
      return false
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

  const handleTabChange = async (newTab: string) => {
    if (newTab === activeTab) return
    
    setIsTabLoading(true)
    
    // Simulate tab content loading
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setActiveTab(newTab)
    setIsTabLoading(false)
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Error Handler */}
        <ErrorHandler errors={errors} onDismiss={removeError} />

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
              <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-5 m-4 border-2 border-black bg-white">
                  <TabsTrigger
                    value="chat"
                    className="data-[state=active]:bg-black data-[state=active]:text-white flex items-center space-x-1"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {getTabBadgeCount("chat") !== null && getTabBadgeCount("chat")! > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {getTabBadgeCount("chat")}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className="data-[state=active]:bg-black data-[state=active]:text-white flex items-center space-x-1"
                  >
                    <FileText className="w-4 h-4" />
                    {getTabBadgeCount("documents") !== null && getTabBadgeCount("documents")! > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {getTabBadgeCount("documents")}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="search" className="data-[state=active]:bg-black data-[state=active]:text-white">
                    <Search className="w-4 h-4" />
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
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
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
                          <div className="flex items-center justify-between text-sm">
                            <span>Vector DB:</span>
                            <Badge variant="outline" className="text-xs">
                              {vectorDBConfig.provider.toUpperCase()}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="h-full m-0 p-4 overflow-auto">
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">Document Management</h2>
                      <UnifiedPDFProcessor onDocumentProcessed={handleDocumentUpload} />
                      <Separator className="bg-black" />
                      <DocumentLibrary documents={documents} onRemoveDocument={handleRemoveDocument} />
                    </div>
                    )}
                  </TabsContent>

                  <TabsContent value="search" className="h-full m-0 p-4 overflow-auto">
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">Document Search</h2>
                      <EnhancedSearch onSearch={handleSearch} documents={documents} />
                    </div>
                    )}
                  </TabsContent>

                  <TabsContent value="settings" className="h-full m-0 p-4 overflow-auto">
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
                    <UnifiedConfiguration
                      onTestAI={handleTestAI}
                      onTestVectorDB={handleTestVectorDB}
                      onTestWandb={handleTestWandb}
                    />
                    )}
                  </TabsContent>

                  <TabsContent value="status" className="h-full m-0 p-4 overflow-auto">
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
                    <div className="space-y-4">
                      <h2 className="font-bold text-lg">System Monitor</h2>
                      <SystemStatus
                        modelStatus={modelStatus}
                        apiConfig={aiConfig}
                        documents={documents}
                        messages={messages}
                        ragEngine={ragEngine ? ragEngine.getStatus() : {}}
                      />
                    </div>
                    )}
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
                  onClick={() => handleTabChange("chat")}
                  aria-label="Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "documents" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("documents")}
                  aria-label="Documents"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "search" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("search")}
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "settings" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("settings")}
                  aria-label="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeTab === "status" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("status")}
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
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                  {vectorDBConfig.provider.toUpperCase()}
                </Badge>
              </div>
            </div>
          </header>

          <div className="flex-1 bg-white">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
              onNewSession={handleNewSession}
              isProcessing={isProcessing}
              disabled={!isChatReady}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

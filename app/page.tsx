"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Activity,
    ChevronLeft,
    ChevronRight,
    FileText,
    Menu,
    Settings,
    X
} from "lucide-react"
import { useEffect, useState } from "react"

import { ChatInterface } from "@/components/chat-interface"
import { DocumentLibrary } from "@/components/document-library"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorHandler } from "@/components/error-handler"
import { TabContentLoadingSkeleton } from "@/components/skeleton-loaders"
import { SystemStatus } from "@/components/system-status"
import { TutorialModal } from "@/components/tutorial-modal"
import { UnifiedConfiguration } from "@/components/unified-configuration"
import { UnifiedPDFProcessor } from "@/components/unified-pdf-processor"
import { AIClient } from "@/lib/ai-client"
import { RAGEngine } from "@/lib/rag-engine"
import { useAppStore } from "@/lib/store"
import { VectorDatabaseClient } from "@/lib/vector-database-client"

export default function QuantumPDFChatbot() {
  const {
    // State
    messages,
    documents,
    aiConfig,
    vectorDBConfig,
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
    updateMessage,
  } = useAppStore()

  const [ragEngine] = useState(() => new RAGEngine())
  const [vectorDB, setVectorDB] = useState(() => new VectorDatabaseClient(vectorDBConfig))
  const [embeddingStatus, setEmbeddingStatus] = useState<{
    active: boolean
    stage: "idle" | "embedding" | "indexing"
    documentName: string
    completed: number
    total: number
    textPreview: string
    startedAt: number | null
  }>({
    active: false,
    stage: "idle",
    documentName: "",
    completed: 0,
    total: 0,
    textPreview: "",
    startedAt: null,
  })
  
  // Search state
  const [isTabLoading, setIsTabLoading] = useState(false)

  // Tutorial modal state
  const [showTutorial, setShowTutorial] = useState(false)

  // Check if chat is ready
  const isChatReady = modelStatus === "ready" && documents.length > 0

  // Check for first-time user on mount
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("quantum-pdf-tutorial-completed")
    if (!hasSeenTutorial) {
      // Show tutorial after a short delay for better UX
      setTimeout(() => setShowTutorial(true), 500)
    }
  }, [])

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
  }, [addError, aiConfig, ragEngine, setModelStatus]) // Re-initialize when config changes

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

  const handleSendMessage = async (content: string, options?: {
    showThinking?: boolean,
    complexityLevel?: 'simple' | 'normal' | 'complex',
    useContext?: boolean,
    documentIds?: string[]
  }) => {
    if ((options?.useContext ?? true) && !documents.length) {
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
      // Determine complexity based on question characteristics
      const detectedComplexity = options?.complexityLevel || detectQuestionComplexity(content)
      const showThinking = options?.showThinking || detectedComplexity === 'complex'

      console.log(`Processing query with complexity: ${detectedComplexity}, thinking: ${showThinking}`)

      let responseAnswer = ""
      let responseSources: string[] = []
      let responseMeta: unknown = {}

      if (options?.useContext === false) {
        const client = new AIClient(aiConfig)
        const assistantId = (Date.now() + 1).toString()
        // Track content locally to avoid stale closure issue with messages array
        let accumulatedContent = ""
        addMessage({
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        })
        await client.generateTextStream([
          { role: "user", content }
        ], (token) => {
          accumulatedContent += token
          updateMessage(assistantId, { content: accumulatedContent })
        })
        return // early since streaming handled
      } else {
      // Get recent conversation history (last 10 messages for context)
      const recentHistory = messages
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      // Build filters if documentIds provided
      const filters = options?.documentIds && options.documentIds.length > 0
        ? { documentIds: options.documentIds }
        : undefined

      const response = await ragEngine.query(content, {
        showThinking,
        complexityLevel: detectedComplexity,
        tokenBudget: 4000,
        conversationHistory: recentHistory,
        filters
      })
        responseAnswer = response.answer
        responseSources = response.sources
        responseMeta = response
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: responseAnswer,
        timestamp: new Date(),
        sources: responseSources,
        metadata: {
          ...(responseMeta.tokenUsage ? {responseTime: responseMeta.tokenUsage.totalTokens * 2} : {}),
          ...(responseMeta.relevanceScore !== undefined ? {relevanceScore: responseMeta.relevanceScore} : {}),
          ...(responseMeta.retrievedChunks ? {retrievedChunks: responseMeta.retrievedChunks} : {}), // Pass full chunks array
          ...(responseMeta.qualityMetrics ? {qualityMetrics: responseMeta.qualityMetrics} : {}),
          ...(responseMeta.tokenUsage ? {tokenUsage: responseMeta.tokenUsage} : {}),
          ...(responseMeta.reasoning ? {reasoning: responseMeta.reasoning} : {}),
          ...(responseMeta.queryAnalysis ? { queryAnalysis: responseMeta.queryAnalysis } : {}),
        },
      }

      addMessage(assistantMessage)

      // Show quality metrics as info if they're particularly good or bad
      if (responseMeta.qualityMetrics?.finalRating >= 85) {
        addError({
          type: "success",
          title: "High Quality Response",
          message: `Response quality: ${responseMeta.qualityMetrics.finalRating.toFixed(1)}% - Enhanced analysis completed`,
        })
      } else if (responseMeta.qualityMetrics?.finalRating < 60) {
        addError({
          type: "warning",
          title: "Response Quality Notice",
          message: `Response quality: ${responseMeta.qualityMetrics.finalRating.toFixed(1)}% - Consider rephrasing your question for better results`,
        })
      }

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

  // Helper function to detect question complexity
  const detectQuestionComplexity = (question: string): 'simple' | 'normal' | 'complex' => {
    
    // Simple questions - direct factual queries
    if (/(what is|when|where|who|date|name|title)/i.test(question) && question.length < 50) {
      return 'simple'
    }
    
    // Complex questions - analysis, comparison, synthesis
    if (/(analyze|compare|evaluate|synthesize|implications|relationships|comprehensive|detailed analysis)/i.test(question) || 
        question.length > 150 ||
        (question.match(/\?/g) || []).length > 1) {
      return 'complex'
    }
    
    // Default to normal for everything else
    return 'normal'
  }

  const handleDocumentUpload = async (document: unknown) => {
    try {
      console.log("=== Page: Document upload started ===")
      console.log("Received document:", {
        name: document.name,
        id: document.id,
        hasChunks: !!document.chunks,
        chunksLength: document.chunks?.length,
        hasEmbeddings: !!document.embeddings,
        embeddingsLength: document.embeddings?.length,
        uploadedAt: document.uploadedAt
      })

      // Check RAG engine status before adding document
      console.log("RAG Engine status before adding document:")
      console.log("- RAG Engine available:", !!ragEngine)
      console.log("- RAG Engine healthy:", ragEngine ? ragEngine.isHealthy() : false)
      if (ragEngine) {
        const status = ragEngine.getStatus()
        console.log("- RAG Engine initialized:", status.initialized)
        console.log("- Current document count:", status.documentCount)
        console.log("- Current provider:", status.currentProvider)
        console.log("- Current model:", status.currentModel)
      }

      console.log("🔄 Adding document to RAG engine...")
      setEmbeddingStatus({
        active: true,
        stage: "embedding",
        documentName: document.name || "document",
        completed: 0,
        total: Array.isArray(document.chunks) ? document.chunks.length : 0,
        textPreview: "",
        startedAt: Date.now(),
      })

      await ragEngine.addDocument(document, (progress) => {
        setEmbeddingStatus((prev) => ({
          ...prev,
          active: true,
          stage: "embedding",
          documentName: progress.documentName || prev.documentName,
          completed: progress.completed,
          total: progress.total,
          textPreview: progress.textPreview,
        }))
      })
      console.log("✅ Document successfully added to RAG engine")
      
      console.log("🔄 Adding document to store...")
      addDocument(document)
      console.log("✅ Document successfully added to store")

      // Add to vector database
      console.log("🔄 Preparing vector database documents...")
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
      console.log("- Vector documents prepared:", vectorDocuments.length)

      console.log("🔄 Adding documents to vector database...")
      setEmbeddingStatus((prev) => ({ ...prev, stage: "indexing" }))
      await vectorDB.addDocuments(vectorDocuments)
      console.log("✅ Documents successfully added to vector database")

      // If this is the first document and AI is configured, keep sidebar focused on docs
      if (documents.length === 0 && modelStatus === "ready") {
        console.log("🔄 First document added - keeping document tab active")
        setTimeout(() => setActiveTab("documents"), 1000)
      }

      // Final status check
      console.log("Final status after document upload:")
      if (ragEngine) {
        const finalStatus = ragEngine.getStatus()
        console.log("- RAG Engine document count:", finalStatus.documentCount)
        console.log("- RAG Engine total chunks:", finalStatus.totalChunks)
      }
      console.log("- Store document count:", documents.length + 1) // +1 because state update is async

      addError({
        type: "success",
        title: "Document Added",
        message: `Successfully processed ${document.name} with ${document.chunks?.length || 0} chunks`,
      })
      
      console.log("=== Page: Document upload completed successfully ===")
    } catch (error) {
      console.error("❌ Error in handleDocumentUpload:", error)
      console.error("Document that failed:", {
        name: document?.name,
        id: document?.id,
        hasChunks: !!document?.chunks,
        chunksLength: document?.chunks?.length,
        hasEmbeddings: !!document?.embeddings,
        embeddingsLength: document?.embeddings?.length
      })
      
      addError({
        type: "error",
        title: "Document Processing Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setEmbeddingStatus((prev) => ({
        ...prev,
        active: false,
        stage: "idle",
        textPreview: "",
      }))
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


  const handleTestAI = async (config: unknown): Promise<boolean> => {
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

  const handleTestVectorDB = async (config: unknown): Promise<boolean> => {
    try {
      const testDB = new VectorDatabaseClient(config)
      await testDB.initialize()
      return await testDB.testConnection()
    } catch (error) {
      console.error("Vector DB test failed:", error)
      return false
    }
  }

  const getTabBadgeCount = (tab: string) => {
    switch (tab) {
      case "documents":
        return documents.length
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

  const sidebarTabValue = activeTab === "chat" ? "documents" : activeTab

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden bg-gray-50 flex">
        {/* Tutorial Modal */}
        <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

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
        <aside
          className={`
          fixed lg:sticky inset-y-0 left-0 top-0 z-40
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-80"}
          ${sidebarOpen ? "w-full sm:w-80 translate-x-0" : "w-full sm:w-80 -translate-x-full lg:translate-x-0"}
          transition-all duration-300 ease-in-out
          bg-white border-r-2 border-black flex flex-col h-screen shrink-0
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
          <div className="flex-1 min-h-0 overflow-auto">
            {!sidebarCollapsed ? (
              <Tabs value={sidebarTabValue} onValueChange={handleTabChange} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 m-4 border-2 border-black bg-white">
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
                  <TabsTrigger value="settings" className="data-[state=active]:bg-black data-[state=active]:text-white">
                    <Settings className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="status" className="data-[state=active]:bg-black data-[state=active]:text-white">
                    <Activity className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-auto">
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


                  <TabsContent value="settings" className="h-full m-0 p-4 overflow-auto">
                    {isTabLoading ? (
                      <TabContentLoadingSkeleton />
                    ) : (
                    <UnifiedConfiguration
                      onTestAI={handleTestAI}
                      onTestVectorDB={handleTestVectorDB}
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
                  variant={sidebarTabValue === "documents" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("documents")}
                  aria-label="Documents"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant={sidebarTabValue === "settings" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("settings")}
                  aria-label="Settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant={sidebarTabValue === "status" ? "default" : "outline"}
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
        </aside>

        {/* Overlay for mobile */}
          <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 bg-white">
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              onAddMessage={addMessage}
              onClearChat={handleClearChat}
              onNewSession={handleNewSession}
              isProcessing={isProcessing}
              disabled={!isChatReady}
              ragEngine={ragEngine}
              documentContext={documents.map(d => d.chunks?.join('\n') || '').join('\n\n')}
              aiClient={modelStatus === 'ready' ? new AIClient(aiConfig) : undefined}
              embeddingStatus={embeddingStatus}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

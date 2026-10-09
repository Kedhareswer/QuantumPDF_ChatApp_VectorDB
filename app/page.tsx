"use client"

import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
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
import { useEffect, useMemo, useState } from "react"

import { ChatInterface } from "@/components/chat-interface"
import { DocumentLibrary } from "@/components/document-library"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorHandler } from "@/components/error-handler"
import { OnboardingTour } from "@/components/onboarding-tour"
import { SystemStatus } from "@/components/system-status"
import { UnifiedConfiguration } from "@/components/unified-configuration"
import { UnifiedPDFProcessor } from "@/components/unified-pdf-processor"
import { AIClient, type AIConfig } from "@/lib/ai-client"
import { prefetchAnydoc } from "@/lib/anydoc-client"
import { RAGEngine, type EnhancedQueryResponse } from "@/lib/rag-engine"
import { SessionPersistence, createIndexedDBStore } from "@/lib/session-persistence"
import { useAppStore, type Document } from "@/lib/store"
import type { VectorDBConfig } from "@/lib/vector-database-types"
import { VectorDatabaseClient } from "@/lib/vector-database-client"

const SIDEBAR_TAB_CLASS =
  "rounded-none h-10 gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none"
const SIDEBAR_HEADING_CLASS = "font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500"

/**
 * Generates a unique id for chat messages. Defined at module scope so the
 * impure time/random calls are not flagged by the react-hooks purity rule
 * (and to avoid the previous `Date.now() + 1` collision hack).
 */
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

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
    restoreSession,
  } = useAppStore()

  const [ragEngine] = useState(() => new RAGEngine())
  // Documents (with embeddings) and chat history survive reloads via IndexedDB.
  const [persistence] = useState(() => new SessionPersistence(createIndexedDBStore()))
  const [sessionRestored, setSessionRestored] = useState(false)
  const vectorDB = useMemo(() => new VectorDatabaseClient(vectorDBConfig), [vectorDBConfig])
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
  

  // Check if chat is ready
  const isChatReady = modelStatus === "ready" && documents.length > 0

  // Warm anydoc's wasm module in the background; it schedules its own idle deferral.
  useEffect(() => {
    prefetchAnydoc()
  }, [])

  // Query the external vector store (Pinecone/Weaviate) at retrieval time too.
  useEffect(() => {
    ragEngine.setVectorSearch(
      vectorDB.isRemote ? (embedding, limit, documentIds) => vectorDB.searchChunks(embedding, limit, documentIds) : null,
    )
  }, [ragEngine, vectorDB])

  // Restore the previous session once, before anything is saved over it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [savedDocuments, savedMessages] = await Promise.all([persistence.loadDocuments(), persistence.loadMessages()])
      if (cancelled) return
      for (const doc of savedDocuments) {
        try {
          // Embeddings are restored with the document; the engine re-embeds
          // only if the current provider uses a different embedding model.
          await ragEngine.addDocument(doc)
        } catch (error) {
          console.error(`Failed to restore document ${doc.name}:`, error)
        }
      }
      if (cancelled) return
      if (savedDocuments.length > 0 || savedMessages.length > 0) {
        restoreSession({ documents: savedDocuments, messages: savedMessages })
        logger.debug(`Restored ${savedDocuments.length} document(s) and ${savedMessages.length} message(s)`)
      }
      setSessionRestored(true)
    })()
    return () => {
      cancelled = true
    }
  }, [persistence, ragEngine, restoreSession])

  // Save the chat history (debounced; streaming updates a message many times).
  useEffect(() => {
    if (!sessionRestored) return
    const timer = setTimeout(() => void persistence.saveMessages(messages), 500)
    return () => clearTimeout(timer)
  }, [messages, persistence, sessionRestored])

  // Initialize RAG engine with store config. Debounced: aiConfig changes on
  // every API-key keystroke and slider tick, and each initialize() makes live
  // API calls. `cancelled` drops results from a run a newer config superseded.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if (aiConfig.apiKey && aiConfig.provider) {
          setModelStatus("loading")
          logger.debug("Initializing RAG engine with config:", {
            provider: aiConfig.provider,
            model: aiConfig.model,
            hasApiKey: !!aiConfig.apiKey
          })

          const { reembeddedDocuments } = await ragEngine.initialize(aiConfig)
          if (cancelled) return
          if (reembeddedDocuments > 0) {
            // New embedding model: persist the re-embedded vectors.
            await Promise.all(ragEngine.getDocuments().map((doc) => persistence.saveDocument(doc)))
          }
          setModelStatus("ready")
          logger.debug("RAG engine initialized successfully")
        } else {
          setModelStatus("config")
          logger.debug("RAG engine waiting for configuration")
        }
      } catch (error) {
        if (cancelled) return
        console.error("Failed to initialize RAG engine:", error)
        setModelStatus("error")
        addError({
          type: "error",
          title: "RAG Engine Error",
          message: error instanceof Error ? error.message : "Failed to initialize RAG engine",
        })
      }
    }, 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [addError, aiConfig, persistence, ragEngine, setModelStatus]) // Re-initialize when config changes

  useEffect(() => {
    // Initialize the (memoized) vector database client whenever it is recreated.
    vectorDB.initialize().catch((error) => {
      console.error("Failed to initialize vector database:", error)
      addError({
        type: "warning",
        title: "Vector DB Warning",
        message: `Using local storage: ${error.message}`,
      })
    })
  }, [vectorDB, addError])

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
      id: createId(),
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

      logger.debug(`Processing query with complexity: ${detectedComplexity}, thinking: ${showThinking}`)

      let responseAnswer = ""
      let responseSources: string[] = []
      let responseMeta: Partial<EnhancedQueryResponse> = {}

      if (options?.useContext === false) {
        const client = new AIClient(aiConfig)
        const assistantId = createId()
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
        }, undefined, (streamError) => {
          updateMessage(assistantId, {
            content: accumulatedContent || "I'm sorry, I encountered an error while generating a response.",
          })
          addError({ type: "error", title: "Chat Error", message: streamError.message })
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
        id: createId(),
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
      const rating = responseMeta.qualityMetrics?.finalRating
      if (rating !== undefined && rating >= 85) {
        addError({
          type: "success",
          title: "High Quality Response",
          message: `Response quality: ${rating.toFixed(1)}% - Enhanced analysis completed`,
        })
      } else if (rating !== undefined && rating < 60) {
        addError({
          type: "warning",
          title: "Response Quality Notice",
          message: `Response quality: ${rating.toFixed(1)}% - Consider rephrasing your question for better results`,
        })
      }

    } catch (error) {
      console.error("Error sending message:", error)

      const errorMessage = {
        id: createId(),
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

  const handleDocumentUpload = async (document: Document) => {
    try {
      logger.debug("=== Page: Document upload started ===")
      logger.debug("Received document:", {
        name: document.name,
        id: document.id,
        hasChunks: !!document.chunks,
        chunksLength: document.chunks?.length,
        hasEmbeddings: !!document.embeddings,
        embeddingsLength: document.embeddings?.length,
        uploadedAt: document.uploadedAt
      })

      // Check RAG engine status before adding document
      logger.debug("RAG Engine status before adding document:")
      logger.debug("- RAG Engine available:", !!ragEngine)
      logger.debug("- RAG Engine healthy:", ragEngine ? ragEngine.isHealthy() : false)
      if (ragEngine) {
        const status = ragEngine.getStatus()
        logger.debug("- RAG Engine initialized:", status.initialized)
        logger.debug("- Current document count:", status.documentCount)
        logger.debug("- Current provider:", status.currentProvider)
        logger.debug("- Current model:", status.currentModel)
      }

      logger.debug("🔄 Adding document to RAG engine...")
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
      logger.debug("✅ Document successfully added to RAG engine")
      
      logger.debug("🔄 Adding document to store...")
      addDocument(document)
      void persistence.saveDocument(document)
      logger.debug("✅ Document successfully added to store")

      // Add to vector database
      logger.debug("🔄 Preparing vector database documents...")
      const vectorDocuments = document.chunks.map((chunk: string, index: number) => ({
        id: `${document.id}_${index}`,
        content: chunk,
        embedding: document.embeddings[index] || [],
        metadata: {
          source: document.name,
          chunkIndex: index,
          documentId: document.id,
          timestamp: document.uploadedAt,
          ...(typeof document.chunkPages?.[index] === "number" && { page: document.chunkPages[index] }),
        },
      }))
      logger.debug("- Vector documents prepared:", vectorDocuments.length)

      logger.debug("🔄 Adding documents to vector database...")
      setEmbeddingStatus((prev) => ({ ...prev, stage: "indexing" }))
      await vectorDB.addDocuments(vectorDocuments)
      logger.debug("✅ Documents successfully added to vector database")

      // If this is the first document and AI is configured, keep sidebar focused on docs
      if (documents.length === 0 && modelStatus === "ready") {
        logger.debug("🔄 First document added - keeping document tab active")
        setTimeout(() => setActiveTab("documents"), 1000)
      }

      // Final status check
      logger.debug("Final status after document upload:")
      if (ragEngine) {
        const finalStatus = ragEngine.getStatus()
        logger.debug("- RAG Engine document count:", finalStatus.documentCount)
        logger.debug("- RAG Engine total chunks:", finalStatus.totalChunks)
      }
      logger.debug("- Store document count:", documents.length + 1) // +1 because state update is async

      addError({
        type: "success",
        title: "Document Added",
        message: `Successfully processed ${document.name} with ${document.chunks?.length || 0} chunks`,
      })
      
      logger.debug("=== Page: Document upload completed successfully ===")
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
      removeDocument(id)
      await persistence.deleteDocument(id)
      await vectorDB.deleteDocument(id)

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
      void persistence.clear()
      vectorDB.clear().catch((error) => console.error("Failed to clear vector database:", error))
      setActiveTab("documents")
    }
  }


  const handleTestAI = async (config: AIConfig): Promise<boolean> => {
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

  const handleTestVectorDB = async (config: VectorDBConfig): Promise<boolean> => {
    try {
      const testDB = new VectorDatabaseClient(config)
      await testDB.initialize()
      return await testDB.testConnection()
    } catch (error) {
      console.error("Vector DB test failed:", error)
      return false
    }
  }

  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) setActiveTab(newTab)
  }

  const sidebarTabValue = activeTab === "chat" ? "documents" : activeTab

  return (
    <ErrorBoundary>
      {/* h-dvh, not h-screen: on phones 100vh sits behind the browser toolbar and hides the chat input */}
      <div className="h-dvh overflow-hidden bg-gray-50 flex">
        {/* First-run product tour */}
        <OnboardingTour />

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
          bg-white border-r-2 border-black flex flex-col h-dvh shrink-0
        `}
        >
          {/* Sidebar Header (max-lg:pl-16 clears the fixed mobile menu button) */}
          <div className="p-6 max-lg:pl-16 border-b-2 border-black bg-black text-white">
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
                <TabsList className="grid w-auto h-auto grid-cols-3 m-4 p-0 gap-0 rounded-none border-2 border-black bg-white">
                  <TabsTrigger
                    value="documents"
                    data-tour="tab-documents"
                    className={SIDEBAR_TAB_CLASS}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Docs</span>
                    {documents.length > 0 && (
                      <span className="font-mono text-[10px] leading-none px-1 py-0.5 border border-current">{documents.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings" data-tour="tab-settings" className={`${SIDEBAR_TAB_CLASS} border-x-2 border-black`}>
                    <Settings className="w-4 h-4" />
                    <span>Setup</span>
                  </TabsTrigger>
                  <TabsTrigger value="status" className={SIDEBAR_TAB_CLASS}>
                    <Activity className="w-4 h-4" />
                    <span>Status</span>
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-auto">
                  <TabsContent value="documents" className="h-full m-0 px-4 pb-4 overflow-auto">
                    <div className="space-y-6">
                      <section className="space-y-3">
                        <h2 className={SIDEBAR_HEADING_CLASS}>Upload</h2>
                        <UnifiedPDFProcessor onDocumentProcessed={handleDocumentUpload} />
                      </section>
                      <section className="space-y-3">
                        <h2 className={SIDEBAR_HEADING_CLASS}>Library</h2>
                        <DocumentLibrary documents={documents} onRemoveDocument={handleRemoveDocument} />
                      </section>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="h-full m-0 px-4 pb-4 overflow-auto">
                    <UnifiedConfiguration
                      onTestAI={handleTestAI}
                      onTestVectorDB={handleTestVectorDB}
                    />
                  </TabsContent>

                  <TabsContent value="status" className="h-full m-0 px-4 pb-4 overflow-auto">
                    <section className="space-y-3">
                      <h2 className={SIDEBAR_HEADING_CLASS}>System Monitor</h2>
                      <SystemStatus
                        modelStatus={modelStatus}
                        apiConfig={aiConfig}
                        documents={documents}
                        messages={messages}
                        ragEngine={ragEngine ? ragEngine.getStatus() : {}}
                      />
                    </section>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              // Collapsed sidebar
              <div className="p-4 space-y-4">
                <Button
                  variant={sidebarTabValue === "documents" ? "default" : "outline"}
                  size="sm"
                  data-tour="tab-documents"
                  className="w-full justify-center p-3"
                  onClick={() => handleTabChange("documents")}
                  aria-label="Documents"
                >
                  <FileText className="w-4 h-4" />
                </Button>
                <Button
                  variant={sidebarTabValue === "settings" ? "default" : "outline"}
                  size="sm"
                  data-tour="tab-settings"
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
          className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
              isRestoring={!sessionRestored}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

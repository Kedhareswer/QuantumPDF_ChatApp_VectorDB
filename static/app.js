class MultiDocumentChatbot {
  constructor() {
    this.sessionId = this.generateSessionId()
    this.isProcessing = false
    this.documents = []
    this.conversationCount = 0
    this.initializeEventListeners()
    this.checkServerHealth()
    this.updateSessionDisplay()
  }

  generateSessionId() {
    return "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  }

  initializeEventListeners() {
    const pdfInput = document.getElementById("pdfInput")
    const uploadArea = document.getElementById("uploadArea")
    const questionInput = document.getElementById("questionInput")
    const sendButton = document.getElementById("sendButton")

    // File input change (supports multiple files)
    pdfInput.addEventListener("change", (e) => this.handleFileSelect(e))

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => this.handleDragOver(e))
    uploadArea.addEventListener("dragleave", (e) => this.handleDragLeave(e))
    uploadArea.addEventListener("drop", (e) => this.handleDrop(e))

    // Question input
    questionInput.addEventListener("input", (e) => this.handleQuestionInput(e))
    questionInput.addEventListener("keypress", (e) => this.handleKeyPress(e))

    // Send button
    sendButton.addEventListener("click", () => this.askQuestion())
  }

  async checkServerHealth() {
    try {
      const response = await fetch("/health")
      const data = await response.json()

      if (data.status === "healthy") {
        this.updateStatus("ready", "Ready")
      } else {
        this.updateStatus("error", "Server Error")
      }
    } catch (error) {
      console.error("Health check failed:", error)
      this.updateStatus("error", "Server Offline")
    }
  }

  updateStatus(type, text) {
    const indicator = document.getElementById("statusIndicator")
    const statusText = document.getElementById("statusText")

    indicator.className = `status-indicator ${type}`
    statusText.textContent = text
  }

  updateSessionDisplay() {
    document.getElementById("currentSession").textContent = this.sessionId.split("_")[1]
  }

  handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    document.getElementById("uploadArea").classList.add("dragover")
  }

  handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    document.getElementById("uploadArea").classList.remove("dragover")
  }

  handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    document.getElementById("uploadArea").classList.remove("dragover")

    const files = Array.from(e.dataTransfer.files).filter((file) => file.type === "application/pdf")
    if (files.length > 0) {
      this.processMultiplePDFs(files)
    } else {
      this.showError("Please drop valid PDF files")
    }
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files).filter((file) => file.type === "application/pdf")
    if (files.length > 0) {
      this.processMultiplePDFs(files)
    } else {
      this.showError("Please select valid PDF files")
    }
  }

  async processMultiplePDFs(files) {
    if (this.isProcessing) return

    this.isProcessing = true
    this.updateStatus("processing", "Processing PDFs...")
    this.showProgress(true)

    let successCount = 0
    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
      try {
        await this.processSinglePDF(files[i], i + 1, totalFiles)
        successCount++
      } catch (error) {
        console.error(`Error processing ${files[i].name}:`, error)
        this.showError(`Error processing ${files[i].name}: ${error.message}`)
      }
    }

    this.isProcessing = false
    this.showProgress(false)

    if (successCount > 0) {
      await this.loadSessionDocuments()
      this.updateStatus("ready", "Documents Ready")
      this.showSuccess(`Successfully processed ${successCount} of ${totalFiles} documents`)
      this.enableChat()
    } else {
      this.updateStatus("error", "Processing Failed")
    }
  }

  async processSinglePDF(file, current, total) {
    const formData = new FormData()
    formData.append("pdf", file)
    formData.append("session_id", this.sessionId)

    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Upload failed")
    }

    // Update progress
    const progress = (current / total) * 100
    document.getElementById("progressFill").style.width = `${progress}%`
    document.getElementById("progressText").textContent = `Processing ${current}/${total}: ${file.name}`

    return data
  }

  async loadSessionDocuments() {
    try {
      const response = await fetch(`/documents/${this.sessionId}`)
      const data = await response.json()

      this.documents = data.documents || []
      this.updateDocumentLibrary()
      this.updateSessionSummary()
    } catch (error) {
      console.error("Error loading session documents:", error)
    }
  }

  updateDocumentLibrary() {
    const documentList = document.getElementById("documentList")

    if (this.documents.length === 0) {
      documentList.innerHTML = `
        <div class="no-documents">
          <i class="fas fa-folder-open"></i>
          <p>No documents uploaded yet</p>
        </div>
      `
      return
    }

    documentList.innerHTML = this.documents
      .map(
        (doc) => `
      <div class="document-item" data-doc-id="${doc.doc_id}">
        <div class="document-info">
          <div class="document-name">${doc.filename}</div>
          <div class="document-meta">
            ${doc.chunks ? doc.chunks.length : "Unknown"} chunks • 
            ${new Date(doc.upload_time).toLocaleDateString()}
          </div>
        </div>
        <div class="document-actions">
          <button class="btn btn-small btn-danger" onclick="chatbot.removeDocument('${doc.doc_id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  async removeDocument(docId) {
    if (!confirm("Are you sure you want to remove this document?")) return

    try {
      const response = await fetch(`/documents/${this.sessionId}/${docId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await this.loadSessionDocuments()
        this.showSuccess("Document removed successfully")
      } else {
        throw new Error("Failed to remove document")
      }
    } catch (error) {
      console.error("Error removing document:", error)
      this.showError("Failed to remove document")
    }
  }

  updateSessionSummary() {
    const totalChunks = this.documents.reduce((sum, doc) => sum + (doc.chunks ? doc.chunks.length : 0), 0)

    document.getElementById("docCount").textContent = this.documents.length
    document.getElementById("chunkCount").textContent = totalChunks
    document.getElementById("questionCount").textContent = this.conversationCount
  }

  showProgress(show) {
    const uploadSection = document.getElementById("uploadSection")
    const uploadProgress = document.getElementById("uploadProgress")

    if (show) {
      uploadProgress.style.display = "block"
    } else {
      uploadProgress.style.display = "none"
    }
  }

  enableChat() {
    document.getElementById("questionInput").disabled = false
    this.updateSendButton()
  }

  handleQuestionInput(e) {
    this.updateSendButton()
  }

  handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.askQuestion()
    }
  }

  updateSendButton() {
    const questionInput = document.getElementById("questionInput")
    const sendButton = document.getElementById("sendButton")

    sendButton.disabled = !questionInput.value.trim() || this.isProcessing || this.documents.length === 0
  }

  async askQuestion() {
    const questionInput = document.getElementById("questionInput")
    const question = questionInput.value.trim()

    if (!question || this.isProcessing || this.documents.length === 0) return

    this.isProcessing = true
    this.updateSendButton()
    this.updateStatus("processing", "Generating Answer...")

    // Add user message to chat
    this.addMessage("user", question)
    questionInput.value = ""
    this.conversationCount++

    // Add loading message
    const loadingId = this.addMessage("assistant", '<div class="loading"></div>')

    try {
      const modelType = document.getElementById("modelType").value
      const apiKey = document.getElementById("apiKey").value
      const aimlModel = document.getElementById("aimlModel").value

      const requestData = {
        question: question,
        session_id: this.sessionId,
        model_type: modelType,
        api_key: apiKey,
      }

      if (modelType === "aiml") {
        requestData.aiml_model = aimlModel
      }

      const response = await fetch("/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Remove loading message
      this.removeMessage(loadingId)

      if (data.error) {
        throw new Error(data.error)
      }

      // Show context indicator if conversation context was used
      let contextIndicator = ""
      if (data.conversation_context_used) {
        contextIndicator = `
          <div class="context-indicator">
            <i class="fas fa-memory"></i>
            Using conversation context
          </div>
        `
      }

      // Add assistant response
      this.addMessage("assistant", contextIndicator + data.answer, data.sources)
      this.updateStatus("ready", "Ready")

      // Update session summary
      document.getElementById("contextUsed").textContent = data.conversation_context_used ? "Yes" : "No"
      this.updateSessionSummary()
    } catch (error) {
      console.error("Error asking question:", error)
      this.removeMessage(loadingId)
      this.addMessage("assistant", `Error: ${error.message}`)
      this.updateStatus("error", "Error")
    } finally {
      this.isProcessing = false
      this.updateSendButton()
    }
  }

  addMessage(role, content, sources = null) {
    const chatMessages = document.getElementById("chatMessages")
    const messageId = `msg-${Date.now()}-${Math.random()}`

    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector(".welcome-message")
    if (welcomeMessage) {
      welcomeMessage.remove()
    }

    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${role}`
    messageDiv.id = messageId

    let sourcesHtml = ""
    if (sources && sources.length > 0) {
      sourcesHtml = `
        <div class="message-sources">
          <h4><i class="fas fa-quote-left"></i> Sources (${sources.length}):</h4>
          ${sources
            .map(
              (source, index) => `
              <div class="source-item">
                <div class="source-doc">📄 ${source.doc_name}</div>
                <strong>Chunk ${source.chunk_index + 1}:</strong> ${source.text}
              </div>
            `,
            )
            .join("")}
        </div>
      `
    }

    messageDiv.innerHTML = `
      <div class="message-content">
        ${content}
      </div>
      ${sourcesHtml}
    `

    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight

    return messageId
  }

  removeMessage(messageId) {
    const message = document.getElementById(messageId)
    if (message) {
      message.remove()
    }
  }

  async clearConversation() {
    if (!confirm("Are you sure you want to clear the conversation history?")) return

    try {
      const response = await fetch(`/conversation/${this.sessionId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Clear chat messages
        const chatMessages = document.getElementById("chatMessages")
        chatMessages.innerHTML = `
          <div class="welcome-message">
            <i class="fas fa-comments"></i>
            <h3>Multi-Document Chat Ready!</h3>
            <p>Upload PDFs and ask questions across all documents.</p>
            <div class="features">
              <div class="feature">
                <i class="fas fa-files"></i>
                <span>Multi-document search</span>
              </div>
              <div class="feature">
                <i class="fas fa-memory"></i>
                <span>Conversation memory</span>
              </div>
              <div class="feature">
                <i class="fas fa-link"></i>
                <span>Context-aware responses</span>
              </div>
            </div>
          </div>
        `

        this.conversationCount = 0
        this.updateSessionSummary()
        this.showSuccess("Conversation cleared successfully")
      } else {
        throw new Error("Failed to clear conversation")
      }
    } catch (error) {
      console.error("Error clearing conversation:", error)
      this.showError("Failed to clear conversation")
    }
  }

  async exportSession() {
    try {
      const response = await fetch(`/session/${this.sessionId}/summary`)
      const data = await response.json()

      const conversationResponse = await fetch(`/conversation/${this.sessionId}`)
      const conversationData = await conversationResponse.json()

      const exportData = {
        session_summary: data,
        conversation_history: conversationData.conversation,
        export_date: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `session_${this.sessionId}_${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.showSuccess("Session exported successfully")
    } catch (error) {
      console.error("Error exporting session:", error)
      this.showError("Failed to export session")
    }
  }

  showError(message) {
    // Create a toast notification
    const toast = document.createElement("div")
    toast.className = "toast toast-error"
    toast.innerHTML = `
      <i class="fas fa-exclamation-circle"></i>
      <span>${message}</span>
    `
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 5000)
  }

  showSuccess(message) {
    // Create a toast notification
    const toast = document.createElement("div")
    toast.className = "toast toast-success"
    toast.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 3000)
  }
}

// Global functions
function newSession() {
  if (confirm("Start a new session? This will clear current documents and conversation.")) {
    window.chatbot = new MultiDocumentChatbot()
  }
}

function toggleApiKey() {
  const modelType = document.getElementById("modelType").value
  const apiKeyGroup = document.getElementById("apiKeyGroup")
  const aimlModelGroup = document.getElementById("aimlModelGroup")

  if (modelType === "huggingface") {
    apiKeyGroup.style.display = "none"
    aimlModelGroup.style.display = "none"
  } else if (modelType === "aiml") {
    apiKeyGroup.style.display = "block"
    aimlModelGroup.style.display = "block"
  } else {
    apiKeyGroup.style.display = "block"
    aimlModelGroup.style.display = "none"
  }
}

function clearConversation() {
  if (window.chatbot) {
    window.chatbot.clearConversation()
  }
}

function exportSession() {
  if (window.chatbot) {
    window.chatbot.exportSession()
  }
}

// Initialize the chatbot when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.chatbot = new MultiDocumentChatbot()
})

// Legacy functions for backward compatibility
function handleKeyPress(event) {
  if (window.chatbot) {
    window.chatbot.handleKeyPress(event)
  }
}

function askQuestion() {
  if (window.chatbot) {
    window.chatbot.askQuestion()
  }
}

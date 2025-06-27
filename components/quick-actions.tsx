"use client"

import { useState, useRef } from "react"
import { RotateCcw, Trash2, Download, Share, FileText, Link2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/lib/store"
import { QuickActionsLoadingSkeleton } from "@/components/skeleton-loaders"

interface QuickActionsProps {
  onClearChat: () => void
  onNewSession: () => void
  disabled?: boolean
}

export function QuickActions({ onClearChat, onNewSession, disabled = false }: QuickActionsProps) {
  const { toast } = useToast()
  const { messages, documents, aiConfig, vectorDBConfig } = useAppStore()
  const [isExporting, setIsExporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null)

  const handleExportChat = async (format: 'json' | 'markdown' | 'txt' | 'pdf') => {
    if (!messages.length) {
      toast({
        title: "No Chat to Export",
        description: "Start a conversation first to export chat history.",
        variant: "destructive"
      })
      return
    }

    setLoadingOperation(format)
    setIsExporting(true)

    try {
      let content = ""
      let filename = `quantum-pdf-chat-${new Date().toISOString().split('T')[0]}`
      let mimeType = ""

      switch (format) {
        case 'json':
          content = JSON.stringify({
            exportedAt: new Date().toISOString(),
            chatSession: {
              messages: messages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp.toISOString(),
                sources: msg.sources,
                metadata: msg.metadata
              })),
              documents: documents.map(doc => ({
                id: doc.id,
                name: doc.name,
                uploadedAt: doc.uploadedAt.toISOString(),
                chunks: doc.chunks.length,
                metadata: doc.metadata
              })),
              configuration: {
                aiProvider: aiConfig.provider,
                model: aiConfig.model,
                vectorDBType: vectorDBConfig.provider
              }
            }
          }, null, 2)
          filename += '.json'
          mimeType = 'application/json'
          break

        case 'markdown':
          content = `# QuantumPDF Chat Export\n\n`
          content += `**Exported:** ${new Date().toLocaleString()}\n`
          content += `**Documents:** ${documents.map(d => d.name).join(', ')}\n`
          content += `**AI Provider:** ${aiConfig.provider} (${aiConfig.model})\n\n`
          content += `---\n\n`
          
          messages.forEach((msg, index) => {
            content += `## ${msg.role === 'user' ? '👤 User' : '🤖 Assistant'} - ${msg.timestamp.toLocaleTimeString()}\n\n`
            content += `${msg.content}\n\n`
            
            if (msg.sources && msg.sources.length > 0) {
              content += `**Sources:**\n`
              msg.sources.forEach((source, i) => {
                content += `${i + 1}. ${source}\n`
              })
              content += `\n`
            }
            
            if (msg.metadata) {
              content += `*Response time: ${msg.metadata.responseTime}ms, Relevance: ${(msg.metadata.relevanceScore || 0 * 100).toFixed(1)}%*\n\n`
            }
            
            content += `---\n\n`
          })
          filename += '.md'
          mimeType = 'text/markdown'
          break

        case 'txt':
          content = `QUANTUM PDF CHAT EXPORT\n`
          content += `========================\n\n`
          content += `Exported: ${new Date().toLocaleString()}\n`
          content += `Documents: ${documents.map(d => d.name).join(', ')}\n`
          content += `AI Provider: ${aiConfig.provider} (${aiConfig.model})\n\n`
          
          messages.forEach((msg, index) => {
            content += `[${msg.timestamp.toLocaleTimeString()}] ${msg.role.toUpperCase()}:\n`
            content += `${msg.content}\n`
            
            if (msg.sources && msg.sources.length > 0) {
              content += `\nSOURCES:\n`
              msg.sources.forEach((source, i) => {
                content += `  ${i + 1}. ${source}\n`
              })
            }
            content += `\n${'='.repeat(50)}\n\n`
          })
          filename += '.txt'
          mimeType = 'text/plain'
          break

        case 'pdf':
          // For PDF export, we'll use a simple HTML to PDF approach
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>QuantumPDF Chat Export</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                .message { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; }
                .user { background-color: #f8f9fa; }
                .assistant { background-color: #e3f2fd; }
                .metadata { font-size: 12px; color: #666; margin-top: 10px; }
                .sources { background-color: #fff3cd; padding: 15px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>QuantumPDF Chat Export</h1>
                <p><strong>Exported:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Documents:</strong> ${documents.map(d => d.name).join(', ')}</p>
                <p><strong>AI Provider:</strong> ${aiConfig.provider} (${aiConfig.model})</p>
              </div>
              ${messages.map(msg => `
                <div class="message ${msg.role}">
                  <h3>${msg.role === 'user' ? '👤 User' : '🤖 Assistant'} - ${msg.timestamp.toLocaleTimeString()}</h3>
                  <p>${msg.content.replace(/\n/g, '<br>')}</p>
                  ${msg.sources && msg.sources.length > 0 ? `
                    <div class="sources">
                      <strong>Sources:</strong>
                      <ol>
                        ${msg.sources.map(source => `<li>${source}</li>`).join('')}
                      </ol>
                    </div>
                  ` : ''}
                  ${msg.metadata ? `
                    <div class="metadata">
                      Response time: ${msg.metadata.responseTime}ms | 
                      Relevance: ${((msg.metadata.relevanceScore || 0) * 100).toFixed(1)}%
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </body>
            </html>
          `
          
          // Create a new window and print to PDF
          const printWindow = window.open('', '_blank')
          if (printWindow) {
            printWindow.document.write(htmlContent)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
              printWindow.print()
              printWindow.close()
            }, 500)
          }
          
          toast({
            title: "PDF Export Initiated",
            description: "Print dialog opened. Choose 'Save as PDF' in your print options."
          })
          return
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Chat Exported Successfully",
        description: `Downloaded as ${filename}`
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the chat.",
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
      setLoadingOperation(null)
    }
  }

  const handleShareSession = async (method: 'link' | 'email' | 'clipboard') => {
    if (!messages.length) {
      toast({
        title: "No Session to Share",
        description: "Start a conversation first to share the session.",
        variant: "destructive"
      })
      return
    }

    setLoadingOperation(method)
    setIsSharing(true)

    try {
      // Create a shareable session object
      const sessionData = {
        id: `session-${Date.now()}`,
        createdAt: new Date().toISOString(),
        messages: messages.slice(-10), // Last 10 messages for sharing
        documentNames: documents.map(d => d.name),
        summary: `Chat session with ${documents.length} document(s) using ${aiConfig.provider}`
      }

      const shareText = `🤖 QuantumPDF Chat Session

Documents: ${sessionData.documentNames.join(', ')}
AI Provider: ${aiConfig.provider} (${aiConfig.model})
Messages: ${sessionData.messages.length}
Created: ${new Date(sessionData.createdAt).toLocaleString()}

Recent conversation:
${sessionData.messages.slice(-3).map(msg => 
  `${msg.role === 'user' ? '👤' : '🤖'} ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
).join('\n')}

Powered by QuantumPDF ChatApp`

      switch (method) {
        case 'clipboard':
          await navigator.clipboard.writeText(shareText)
          toast({
            title: "Session Copied to Clipboard",
            description: "Share the session details anywhere you like!"
          })
          break

        case 'email':
          const emailSubject = encodeURIComponent(`QuantumPDF Chat Session - ${sessionData.documentNames.join(', ')}`)
          const emailBody = encodeURIComponent(shareText)
          window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`)
          break

        case 'link':
          // In a real app, you'd save to a database and create a shareable link
          // For now, we'll create a data URL
          const sessionBlob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' })
          const sessionUrl = URL.createObjectURL(sessionBlob)
          
          // Copy the blob URL to clipboard (in production, this would be a real URL)
          await navigator.clipboard.writeText(`${window.location.origin}?session=${btoa(JSON.stringify(sessionData))}`)
          
          toast({
            title: "Share Link Created",
            description: "Link copied to clipboard! Recipients can restore this session."
          })
          break
      }
    } catch (error) {
      console.error('Share failed:', error)
      toast({
        title: "Sharing Failed",
        description: "An error occurred while sharing the session.",
        variant: "destructive"
      })
    } finally {
      setIsSharing(false)
      setLoadingOperation(null)
    }
  }

  if (isExporting || isSharing) {
    return <QuickActionsLoadingSkeleton />
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onClearChat}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Clear Chat History"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onNewSession}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="New Session"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>

      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
      <Button
        size="sm"
        variant="outline"
            disabled={disabled || !messages.length}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Export Chat"
      >
        <Download className="w-4 h-4" />
      </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExportChat('json')}>
            <FileText className="w-4 h-4 mr-2" />
            JSON Data
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportChat('markdown')}>
            <FileText className="w-4 h-4 mr-2" />
            Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportChat('txt')}>
            <FileText className="w-4 h-4 mr-2" />
            Plain Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportChat('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            PDF (Print)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
      <Button
        size="sm"
        variant="outline"
            disabled={disabled || !messages.length}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Share Session"
      >
        <Share className="w-4 h-4" />
      </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Share Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleShareSession('clipboard')}>
            <Link2 className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShareSession('email')}>
            <Mail className="w-4 h-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShareSession('link')}>
            <Share className="w-4 h-4 mr-2" />
            Create Share Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

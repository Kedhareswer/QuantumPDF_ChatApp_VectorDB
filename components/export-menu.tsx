"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Copy, Download, File, FileText } from "lucide-react"
import { useState } from "react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: string[]
}

interface ExportMenuProps {
  messages: Message[]
  className?: string
}

export function ExportMenu({ messages, className = "" }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const exportAsMarkdown = () => {
    setIsExporting(true)
    try {
      let markdown = "# Chat Export\n\n"
      markdown += `**Exported:** ${new Date().toLocaleString()}\n`
      markdown += `**Messages:** ${messages.length}\n\n`
      markdown += "---\n\n"

      messages.forEach((message, index) => {
        markdown += `## ${message.role === "user" ? "User" : "Assistant"} (${index + 1})\n\n`
        markdown += `**Time:** ${message.timestamp.toLocaleString()}\n\n`
        markdown += `${message.content}\n\n`
        
        if (message.sources && message.sources.length > 0) {
          markdown += "### Sources\n\n"
          message.sources.forEach((source, i) => {
            markdown += `${i + 1}. ${source}\n`
          })
          markdown += "\n"
        }
        
        markdown += "---\n\n"
      })

      const blob = new Blob([markdown], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `chat-export-${new Date().toISOString().split("T")[0]}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Chat exported as Markdown",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsPDF = async () => {
    setIsExporting(true)
    try {
      // For PDF export, we'll use the browser's print functionality
      // In a production app, you might want to use a library like jsPDF or pdfmake
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        throw new Error("Popup blocked. Please allow popups for this site.")
      }

      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chat Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 30px; }
            .message { margin: 20px 0; padding: 15px; border-left: 4px solid #333; background: #f9f9f9; }
            .user { border-left-color: #000; }
            .assistant { border-left-color: #666; }
            .timestamp { color: #999; font-size: 0.9em; }
            .sources { margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; }
            .sources ul { margin: 5px 0; padding-left: 20px; }
            @media print {
              body { padding: 0; }
              .message { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>Chat Export</h1>
          <p><strong>Exported:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Messages:</strong> ${messages.length}</p>
      `

      messages.forEach((message, index) => {
        html += `
          <div class="message ${message.role}">
            <h2>${message.role === "user" ? "User" : "Assistant"} Message ${index + 1}</h2>
            <div class="timestamp">${message.timestamp.toLocaleString()}</div>
            <div>${message.content.replace(/\n/g, "<br>")}</div>
        `
        
        if (message.sources && message.sources.length > 0) {
          html += `
            <div class="sources">
              <strong>Sources:</strong>
              <ul>
                ${message.sources.map(source => `<li>${source}</li>`).join("")}
              </ul>
            </div>
          `
        }
        
        html += `</div>`
      })

      html += `
          </body>
        </html>
      `

      printWindow.document.write(html)
      printWindow.document.close()
      
      // Wait for content to load, then trigger print
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)

      toast({
        title: "Export Successful",
        description: "Chat exported as PDF (print dialog opened)",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      let text = `Chat Export - ${new Date().toLocaleString()}\n`
      text += `${"=".repeat(50)}\n\n`

      messages.forEach((message, index) => {
        text += `${message.role === "user" ? "USER" : "ASSISTANT"} (${index + 1})\n`
        text += `Time: ${message.timestamp.toLocaleString()}\n`
        text += `${"-".repeat(30)}\n`
        text += `${message.content}\n\n`
        
        if (message.sources && message.sources.length > 0) {
          text += "Sources:\n"
          message.sources.forEach((source, i) => {
            text += `  ${i + 1}. ${source}\n`
          })
          text += "\n"
        }
        
        text += "\n"
      })

      await navigator.clipboard.writeText(text)

      toast({
        title: "Copied to Clipboard",
        description: "Chat content copied successfully",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  if (messages.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className={`h-8 px-3 border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 ${className}`}
        >
          <Download className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Conversation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportAsMarkdown} disabled={isExporting}>
          <FileText className="w-4 h-4 mr-2" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsPDF} disabled={isExporting}>
          <File className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard}>
          <Copy className="w-4 h-4 mr-2" />
          Copy to Clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


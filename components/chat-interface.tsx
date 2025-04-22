"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, AlertCircle, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Source {
  pdfName: string
  pdfId: string
  snippet: string
}

interface Message {
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  error?: string
  usingFallback?: boolean
}

interface ChatInterfaceProps {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  activePdf: { id: string; name: string } | null
  isAllPdfs: boolean
}

export function ChatInterface({ messages, setMessages, activePdf, isAllPdfs }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim()) return

    if (!activePdf && !isAllPdfs) {
      toast({
        title: "No PDF selected",
        description: "Please select a PDF or 'All PDFs' to chat with",
        variant: "destructive",
      })
      return
    }

    // Reset any previous API errors
    setApiError(null)

    // Add user message
    const userMessage: Message = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Focus the textarea after sending
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 0)

    try {
      // Get the last 5 messages for context
      const recentMessages = messages.slice(-5).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // Send request to API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: input,
          pdfId: isAllPdfs ? "all" : activePdf?.id,
          history: recentMessages,
        }),
      })

      if (!response.ok) {
        let errorMessage = `Error: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If we can't parse the JSON, just use the status
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Check if there was an error with the Gemini API
      if (data.error) {
        setApiError(data.error)
      }

      // Add assistant message with sources
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          sources: data.sources,
          error: data.error,
          usingFallback: data.usingFallback,
        },
      ])
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm sorry, I encountered an error processing your request. Please try again.",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-2">
        <h2 className="text-sm font-medium">
          Chatting with: <span className="font-semibold">{isAllPdfs ? "All PDFs" : activePdf?.name}</span>
        </h2>
      </div>

      {apiError && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Error</AlertTitle>
          <AlertDescription>There was an issue with the AI service: {apiError}</AlertDescription>
        </Alert>
      )}

      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="text-lg font-medium">Start chatting with your PDF</p>
              <p className="text-sm text-muted-foreground">Ask questions about the content of your document</p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-5 py-4 border ${msg.role === "user" ? "bg-blue-50 ml-auto max-w-[75%] border-blue-200" : "bg-gray-100 mr-auto max-w-[75%] border-gray-300"}`}
                  style={{ wordBreak: "break-word" }}
                >
                  <div className="mb-1 text-xs text-gray-500 flex items-center gap-2">
                    {msg.role === "user" ? "You" : "AI Assistant"}
                    {msg.usingFallback && (
                      <span className="text-yellow-600 font-semibold">(Fallback Mode)</span>
                    )}
                  </div>
                  <div className="text-base text-gray-800 whitespace-pre-line">
                    {msg.content}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 text-xs text-gray-600">
                      <span className="font-semibold">Sources:</span>
                      <ul className="list-disc ml-6">
                        {msg.sources.map((src, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{src.pdfName}:</span> {src.snippet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {msg.error && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{msg.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      {apiError && (
        <Alert variant="destructive" className="my-3">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-white px-4 py-3 border border-gray-200 rounded-lg shadow"
        style={{ minHeight: "72px" }}
      >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activePdf ? `Ask about "${activePdf.name}"...` : isAllPdfs ? "Ask about all PDFs..." : "Ask a question..."}
            className="flex-1 resize-none rounded-md border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            className="ml-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
    </div>
  )
}

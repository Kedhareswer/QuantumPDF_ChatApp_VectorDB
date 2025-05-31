"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Loader2, FileText, Brain, Clock, Target, Sparkles, MessageSquare, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  isProcessing: boolean
  disabled: boolean
  embeddingFallbackActive?: boolean
  documentsCount?: number
}

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
    fallbackMode?: boolean
  }
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the most important conclusions?",
  "How do the documents relate to each other?",
]

export function ChatInterface({
  messages,
  onSendMessage,
  isProcessing,
  disabled,
  embeddingFallbackActive = false,
  documentsCount = 0,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isProcessing && !disabled) {
      onSendMessage(input.trim())
      setInput("")
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    if (!isProcessing && !disabled) {
      onSendMessage(question)
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const renderEmptyState = () => (
    <div className="flex items-center justify-center h-full min-h-[500px] px-4">
      <div className="text-center space-y-8 max-w-2xl w-full">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="w-20 h-20 border-4 border-black mx-auto flex items-center justify-center bg-gray-50">
            <Brain className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-3">QUANTUM PDF READY</h3>
            <p className="text-gray-600 text-base leading-relaxed">
              {disabled
                ? "Upload PDF documents and configure your AI provider to start chatting"
                : `Ask questions about your uploaded documents (${documentsCount} loaded)`}
            </p>
          </div>
        </div>

        {/* Embedding Fallback Warning */}
        {embeddingFallbackActive && !disabled && (
          <Alert className="border-2 border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm">
              <strong>Fallback Mode Active:</strong> Your selected AI provider doesn't support embeddings. Using
              keyword-based search with reduced accuracy. Consider switching to OpenAI, Hugging Face, or Cohere for
              better results.
            </AlertDescription>
          </Alert>
        )}

        {!disabled && (
          <div className="space-y-6">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Suggested Questions:</h4>
            <div className="grid gap-3 max-w-xl mx-auto">
              {SUGGESTED_QUESTIONS.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="p-4 text-left border-2 border-gray-300 hover:border-black hover:bg-gray-50 transition-all duration-200 text-sm bg-white shadow-sm"
                  disabled={isProcessing}
                >
                  <div className="flex items-start space-x-3">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span className="leading-relaxed">{question}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200">
          <div className="text-center space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 font-medium">Multi-document chat</p>
          </div>
          <div className="text-center space-y-2">
            <Brain className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 font-medium">AI-powered analysis</p>
          </div>
          <div className="text-center space-y-2">
            <FileText className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-xs text-gray-500 font-medium">Source citations</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Message Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge
                      variant="outline"
                      className={`border-2 font-bold px-3 py-1 ${
                        message.role === "user" ? "border-black bg-black text-white" : "border-gray-400 text-gray-700"
                      }`}
                    >
                      {message.role === "user" ? "USER" : "ASSISTANT"}
                    </Badge>
                    <span className="text-xs text-gray-500 font-mono">{formatTimestamp(message.timestamp)}</span>
                    {message.metadata?.fallbackMode && (
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Fallback Mode
                      </Badge>
                    )}
                  </div>

                  {message.metadata && (
                    <div className="flex items-center space-x-2">
                      {message.metadata.responseTime && (
                        <Badge variant="outline" className="text-xs border-gray-300">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatResponseTime(message.metadata.responseTime)}
                        </Badge>
                      )}
                      {message.metadata.relevanceScore && (
                        <Badge variant="outline" className="text-xs border-gray-300">
                          <Target className="w-3 h-3 mr-1" />
                          {(message.metadata.relevanceScore * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex">
                  <div
                    className={`flex-1 p-4 border-2 ${
                      message.role === "user"
                        ? "border-black bg-black text-white ml-8 max-w-3xl"
                        : "border-gray-300 bg-white mr-8 max-w-3xl"
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>

                    {message.sources && message.sources.length > 0 && (
                      <Card className="mt-4 border border-gray-200 bg-gray-50">
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2 mb-3">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <span className="text-xs font-bold text-gray-700">SOURCES ({message.sources.length})</span>
                          </div>
                          <div className="space-y-2">
                            {message.sources.map((source, index) => (
                              <div
                                key={index}
                                className="text-xs bg-white p-2 border border-gray-200 font-mono rounded"
                              >
                                <span className="text-gray-600">#{index + 1}</span> {source}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="space-y-3 max-w-4xl mx-auto px-4">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="border-gray-400 text-gray-700 font-bold px-3 py-1">
                    ASSISTANT
                  </Badge>
                  <span className="text-xs text-gray-500 font-mono">{formatTimestamp(new Date())}</span>
                  {embeddingFallbackActive && (
                    <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Fallback Mode
                    </Badge>
                  )}
                </div>
                <div className="flex">
                  <div className="flex-1 p-4 border-2 border-gray-300 bg-white mr-8 max-w-3xl">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">
                        {embeddingFallbackActive
                          ? "Searching documents using keyword matching..."
                          : "Analyzing documents and generating response..."}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-gray-500 space-y-1">
                      {embeddingFallbackActive ? (
                        <>
                          <div>• Performing keyword-based search</div>
                          <div>• Matching document content</div>
                          <div>• Generating response with AI model</div>
                        </>
                      ) : (
                        <>
                          <div>• Searching relevant content</div>
                          <div>• Generating embeddings</div>
                          <div>• Processing with AI model</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t-2 border-black bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex space-x-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  disabled
                    ? "Configure AI provider and upload documents to start chatting..."
                    : embeddingFallbackActive
                      ? "Ask a question (using keyword search)..."
                      : "Ask a question about your documents..."
                }
                disabled={disabled || isProcessing}
                className="flex-1 border-2 border-black focus:ring-0 focus:border-black font-mono h-12"
              />
              <Button
                type="submit"
                disabled={disabled || isProcessing || !input.trim()}
                className="border-2 border-black bg-black text-white hover:bg-white hover:text-black px-8 h-12"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>

            {!disabled && (
              <div className="text-center text-xs text-gray-500">
                <span className="font-bold">TIP:</span>
                {embeddingFallbackActive
                  ? " Use specific keywords from your documents for better results in fallback mode"
                  : " Ask specific questions about your documents for better results"}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

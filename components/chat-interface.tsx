"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Loader2, FileText, Brain, Clock, Target, Sparkles, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

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

interface ChatInterfaceProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  isProcessing: boolean
  disabled: boolean
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the most important conclusions?",
  "How do the documents relate to each other?",
]

export function ChatInterface({ messages, onSendMessage, isProcessing, disabled }: ChatInterfaceProps) {
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 border-4 border-black mx-auto flex items-center justify-center bg-gray-50">
                <Brain className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">QUANTUM PDF READY</h3>
                <p className="text-gray-600 mb-6">
                  {disabled
                    ? "Upload PDF documents and configure your AI provider to start chatting"
                    : "Ask questions about your uploaded documents"}
                </p>

                {!disabled && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-800">SUGGESTED QUESTIONS:</h4>
                    <div className="grid gap-2">
                      {SUGGESTED_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestedQuestion(question)}
                          className="p-3 text-left border-2 border-gray-300 hover:border-black hover:bg-gray-50 transition-colors text-sm"
                          disabled={isProcessing}
                        >
                          <Sparkles className="w-4 h-4 inline mr-2" />
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
                <div className="text-center">
                  <MessageSquare className="w-6 h-6 mx-auto mb-1" />
                  <p>Multi-document chat</p>
                </div>
                <div className="text-center">
                  <Brain className="w-6 h-6 mx-auto mb-1" />
                  <p>AI-powered analysis</p>
                </div>
                <div className="text-center">
                  <FileText className="w-6 h-6 mx-auto mb-1" />
                  <p>Source citations</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Message Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge
                      variant="outline"
                      className={`border-2 font-bold ${
                        message.role === "user" ? "border-black bg-black text-white" : "border-gray-400 text-gray-700"
                      }`}
                    >
                      {message.role === "user" ? "USER" : "ASSISTANT"}
                    </Badge>
                    <span className="text-xs text-gray-500 font-mono">{formatTimestamp(message.timestamp)}</span>
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
                <div
                  className={`p-4 border-2 ${
                    message.role === "user"
                      ? "border-black bg-black text-white ml-12"
                      : "border-gray-300 bg-white mr-12"
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
                            <div key={index} className="text-xs bg-white p-2 border border-gray-200 font-mono">
                              <span className="text-gray-600">#{index + 1}</span> {source}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="border-gray-400 text-gray-700 font-bold">
                    ASSISTANT
                  </Badge>
                  <span className="text-xs text-gray-500 font-mono">{formatTimestamp(new Date())}</span>
                </div>
                <div className="p-4 border-2 border-gray-300 bg-white mr-12">
                  <div className="flex items-center space-x-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Analyzing documents and generating response...</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 space-y-1">
                    <div>• Searching relevant content</div>
                    <div>• Generating embeddings</div>
                    <div>• Processing with AI model</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t-2 border-black bg-white p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex space-x-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                disabled
                  ? "Configure AI provider and upload documents to start chatting..."
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
              <span className="font-bold">TIP:</span> Ask specific questions about your documents for better results
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

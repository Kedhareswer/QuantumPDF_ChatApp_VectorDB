"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Send,
  Loader2,
  FileText,
  Brain,
  Clock,
  Target,
  Sparkles,
  MessageSquare,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  RotateCcw,
  Download,
  Share,
  ChevronDown,
  ChevronRight,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { QuickActions } from "@/components/quick-actions"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

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
  onClearChat: () => void
  onNewSession: () => void
  isProcessing: boolean
  disabled: boolean
}

const SUGGESTED_QUESTIONS = [
  "What are the main topics covered in the documents?",
  "Can you summarize the key findings?",
  "What are the most important conclusions?",
  "How do the documents relate to each other?",
]

// Component to parse and render message content with thinking sections
function MessageContent({ content }: { content: string }) {
  const [expandedThinking, setExpandedThinking] = useState<{[key: string]: boolean}>({})

  // Parse content to extract thinking sections
  const parseContent = (text: string) => {
    const parts = []
    let currentIndex = 0
    let thinkingCounter = 0

    // Replace newlines with a placeholder to simulate the 's' flag behavior
    const processedText = text.replace(/\n/g, '\n')
    
    // Regex to match <think> or <thinking> tags (compatible with older JS)
    const thinkingRegex = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/g
    let match

    while ((match = thinkingRegex.exec(processedText)) !== null) {
      // Add text before thinking section
      if (match.index > currentIndex) {
        const beforeText = processedText.slice(currentIndex, match.index).trim()
        if (beforeText) {
          parts.push({
            type: 'text',
            content: beforeText,
            id: `text-${parts.length}`
          })
        }
      }

      // Add thinking section
      const thinkingContent = match[1].trim()
      if (thinkingContent) {
        thinkingCounter++
        parts.push({
          type: 'thinking',
          content: thinkingContent,
          id: `thinking-${thinkingCounter}`
        })
      }

      currentIndex = match.index + match[0].length
    }

    // Add remaining text after last thinking section
    if (currentIndex < processedText.length) {
      const remainingText = processedText.slice(currentIndex).trim()
      if (remainingText) {
        parts.push({
          type: 'text',
          content: remainingText,
          id: `text-${parts.length}`
        })
      }
    }

    // If no thinking sections found, return original text
    if (parts.length === 0) {
      parts.push({
        type: 'text',
        content: text,
        id: 'text-0'
      })
    }

    return parts
  }

  const toggleThinking = (id: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const parts = parseContent(content)

  return (
    <div className="space-y-3">
      {parts.map((part) => {
        if (part.type === 'thinking') {
          const isExpanded = expandedThinking[part.id] || false
          
          return (
            <Collapsible
              key={part.id}
              open={isExpanded}
              onOpenChange={() => toggleThinking(part.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-left h-7 px-2 py-1 text-xs bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-800 font-medium"
                >
                  <div className="flex items-center space-x-1.5">
                    <Brain className="w-3 h-3" />
                    <span>Thinking</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-3.5 border-amber-300 text-amber-700">
                      {part.content.length > 1000 ? `${Math.round(part.content.length / 100) / 10}k` : `${part.content.length}c`}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <Card className="mt-2 border border-amber-200 bg-amber-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Eye className="w-3 h-3 text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        Internal Reasoning
                      </span>
                    </div>
                    <div className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed bg-white/60 p-3 rounded border border-amber-200/50 font-mono">
                      {part.content}
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )
        } else {
          return (
            <div
              key={part.id}
              className="whitespace-pre-wrap leading-relaxed text-base"
            >
              {part.content}
            </div>
          )
        }
      })}
    </div>
  )
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  onNewSession, 
  isProcessing, 
  disabled 
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isProcessing && !disabled) {
      onSendMessage(input.trim())
      setInput("")
      setIsExpanded(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    if (!isProcessing && !disabled) {
      onSendMessage(question)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
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
    <div className="flex flex-col h-full bg-white">
      {/* Enhanced mobile-friendly chat header */}
      <div className="border-b border-gray-200 mobile-container safe-area-top">
        <div className="flex items-center justify-between">
          <h2 className="text-lg lg:text-xl font-semibold">Chat</h2>
          <div className="desktop-only">
            <QuickActions
              onClearChat={onClearChat}
              onNewSession={onNewSession}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
      
      {/* Skip to content link for accessibility */}
      <a href="#chat-messages" className="skip-to-content">
        Skip to chat messages
      </a>

      {/* Enhanced messages area with mobile optimization */}
      <ScrollArea className="flex-1 mobile-container lg:px-8" ref={scrollAreaRef}>
        <div id="chat-messages" className="max-w-4xl mx-auto py-4 lg:py-6 space-content-lg">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50vh] lg:min-h-[60vh]">
              <div className="text-center space-y-6 lg:space-y-8 max-w-2xl px-4">
                <div className="w-16 h-16 lg:w-24 lg:h-24 border-4 border-black mx-auto flex items-center justify-center bg-gray-50 card-enhanced">
                  <Brain className="w-8 h-8 lg:w-12 lg:h-12" />
                </div>

                <div className="space-y-3 lg:space-y-4">
                  <h1 className="text-hierarchy-1">QUANTUM PDF READY</h1>
                  <p className="text-base lg:text-lg text-gray-600 leading-relaxed">
                    {disabled
                      ? "Upload PDF documents and configure your AI provider to start chatting"
                      : "Ask questions about your uploaded documents"}
                  </p>
                </div>

                {!disabled && (
                  <div className="space-y-4 lg:space-y-6">
                    <h2 className="text-hierarchy-3 text-gray-800">SUGGESTED QUESTIONS:</h2>
                    <div className="grid gap-2 lg:gap-3 max-w-xl mx-auto">
                      {SUGGESTED_QUESTIONS.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestedQuestion(question)}
                          className="p-3 lg:p-4 text-left border-2 border-gray-300 hover:border-black hover:bg-gray-50 transition-all duration-200 text-sm group btn-enhanced touch-target"
                          disabled={isProcessing}
                          aria-label={`Ask: ${question}`}
                        >
                          <div className="flex items-start space-x-2 lg:space-x-3">
                            <Sparkles className="w-4 h-4 mt-0.5 text-gray-500 group-hover:text-black transition-colors flex-shrink-0" />
                            <span className="leading-relaxed text-left">{question}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 pt-6 lg:pt-8 text-sm text-gray-500">
                  <div className="text-center space-y-2">
                    <MessageSquare className="w-6 h-6 lg:w-8 lg:h-8 mx-auto" />
                    <p className="font-medium">Multi-document chat</p>
                  </div>
                  <div className="text-center space-y-2">
                    <Brain className="w-6 h-6 lg:w-8 lg:h-8 mx-auto" />
                    <p className="font-medium">AI-powered analysis</p>
                  </div>
                  <div className="text-center space-y-2">
                    <FileText className="w-6 h-6 lg:w-8 lg:h-8 mx-auto" />
                    <p className="font-medium">Source citations</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 lg:space-y-8">
              {messages.map((message) => (
                <div key={message.id} className="space-y-3 lg:space-y-4" role="article" aria-label={`${message.role} message`}>
                  {/* Enhanced message header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2 lg:space-x-4">
                      <Badge
                        variant="outline"
                        className={`border-2 font-bold px-2 py-1 lg:px-3 lg:py-1 text-xs lg:text-sm ${
                          message.role === "user" ? "border-black bg-black text-white" : "border-gray-400 text-gray-700"
                        }`}
                      >
                        {message.role === "user" ? "USER" : "ASSISTANT"}
                      </Badge>
                      <time className="text-xs lg:text-sm text-gray-500 font-mono" dateTime={message.timestamp.toISOString()}>
                        {formatTimestamp(message.timestamp)}
                      </time>
                    </div>

                    {message.metadata && (
                      <div className="flex items-center space-x-2 lg:space-x-3">
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

                  {/* Enhanced message content */}
                  <div
                    className={`message-bubble ${message.role === "user" ? "message-bubble-user" : "message-bubble-assistant"} group`}
                  >
                    <div className="flex justify-between items-start gap-2 lg:gap-4">
                      <div className="flex-1 min-w-0">
                        <MessageContent content={message.content} />
                      </div>

                      {/* Enhanced message actions for mobile */}
                      <div className="flex items-start space-x-1 lg:space-x-2 opacity-70 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(message.content)}
                          className={`h-8 w-8 p-0 touch-target ${message.role === "user" ? "text-white hover:bg-white/20" : "text-gray-600 hover:bg-gray-100"}`}
                          aria-label="Copy message"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {message.role === "assistant" && (
                          <div className="hidden lg:flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 touch-target"
                              aria-label="Thumbs up"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 touch-target"
                              aria-label="Thumbs down"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <Card className="mt-4 lg:mt-6 border border-gray-200 bg-gray-50">
                        <CardContent className="p-3 lg:p-4">
                          <div className="flex items-center space-x-2 mb-3 lg:mb-4">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-bold text-gray-700">SOURCES ({message.sources.length})</span>
                          </div>
                          <div className="space-y-2 lg:space-y-3">
                            {message.sources.map((source, index) => (
                              <div
                                key={index}
                                className="text-sm bg-white p-2 lg:p-3 border border-gray-200 font-mono rounded-sm break-words"
                              >
                                <span className="text-gray-600 font-bold">#{index + 1}</span> {source}
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
                <div className="space-y-3 lg:space-y-4" role="status" aria-live="polite" aria-label="AI is processing your request">
                  <div className="flex items-center space-x-2 lg:space-x-4">
                    <Badge variant="outline" className="border-gray-400 text-gray-700 font-bold px-2 py-1 lg:px-3 lg:py-1 text-xs lg:text-sm">
                      ASSISTANT
                    </Badge>
                    <time className="text-xs lg:text-sm text-gray-500 font-mono">{formatTimestamp(new Date())}</time>
                  </div>
                  <div className="message-bubble message-bubble-assistant">
                    <div className="flex items-center space-x-3 lg:space-x-4">
                      <Loader2 className="w-5 h-5 lg:w-6 lg:h-6 animate-spin flex-shrink-0" />
                      <span className="text-sm lg:text-base">Analyzing documents and generating response...</span>
                    </div>
                    <div className="mt-3 lg:mt-4 text-xs lg:text-sm text-gray-500 space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        <span>Searching relevant content</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <span>Generating embeddings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                        <span>Processing with AI model</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Enhanced mobile-optimized input area */}
      <div className="border-t-2 border-black bg-white safe-area-bottom">
        <div className="max-w-4xl mx-auto mobile-container lg:px-8 py-3 lg:py-6">
          {/* Mobile action buttons */}
          <div className="mobile-only mb-3">
            <QuickActions
              onClearChat={onClearChat}
              onNewSession={onNewSession}
              disabled={disabled}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4 form-enhanced">
            <div className="flex space-x-3 lg:space-x-4">
              <div className="flex-1">
                <label htmlFor="chat-input" className="sr-only">
                  Ask a question about your documents
                </label>
                <Textarea
                  id="chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    disabled
                      ? "Upload documents and configure AI to start chatting..."
                      : "Ask a question about your documents..."
                  }
                  className="resize-none border-2 border-black focus:ring-0 focus:border-black min-h-[44px] lg:min-h-[52px] text-base lg:text-sm"
                  rows={1}
                  disabled={disabled || isProcessing}
                  maxLength={2000}
                />
              </div>
              
              <Button
                type="submit"
                disabled={!input.trim() || isProcessing || disabled}
                className="bg-black text-white hover:bg-gray-800 border-2 border-black touch-target min-w-[44px] lg:min-w-[52px] h-[44px] lg:h-[52px] px-3 lg:px-4"
                aria-label="Send message"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 lg:w-5 lg:h-5" />
                )}
              </Button>
            </div>

            {/* Enhanced status info */}
            <div className="flex items-center justify-between text-xs lg:text-sm text-gray-500">
              <div className="flex items-center space-x-3 lg:space-x-4">
                <span>
                  {input.length}/2000 characters
                </span>
                {!disabled && (
                  <span className="text-green-600 font-medium">
                    Ready to chat
                  </span>
                )}
              </div>
              
              <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-400">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-gray-100">Enter</kbd>
                <span>to send</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

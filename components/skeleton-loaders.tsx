"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Loader2, Brain, MessageSquare, FileText, Upload, Zap } from "lucide-react"

// Enhanced Chat Message Skeleton with typing animation
export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

// Enhanced Chat Typing Indicator with realistic animation
export function ChatTypingIndicator() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
        </div>
        <span className="text-sm text-gray-500">AI is thinking...</span>
      </div>
    </div>
  )
}

// Sophisticated AI Response Generation Skeleton
export function AIResponseGenerationSkeleton({ phase = "analyzing" }: { phase?: "analyzing" | "thinking" | "generating" | "formatting" }) {
  const getPhaseConfig = (currentPhase: string) => {
    switch (currentPhase) {
      case "analyzing":
        return { 
          icon: Brain, 
          text: "Analyzing documents", 
          iconColor: "text-blue-600",
          cardBorder: "border-blue-200",
          cardBg: "bg-blue-50/50",
          spinnerColor: "text-blue-600",
          progressColor: "bg-blue-500"
        }
      case "thinking":
        return { 
          icon: Brain, 
          text: "Processing with AI", 
          iconColor: "text-purple-600",
          cardBorder: "border-purple-200",
          cardBg: "bg-purple-50/50",
          spinnerColor: "text-purple-600",
          progressColor: "bg-purple-500"
        }
      case "generating":
        return { 
          icon: MessageSquare, 
          text: "Generating response", 
          iconColor: "text-green-600",
          cardBorder: "border-green-200",
          cardBg: "bg-green-50/50",
          spinnerColor: "text-green-600",
          progressColor: "bg-green-500"
        }
      case "formatting":
        return { 
          icon: Zap, 
          text: "Formatting output", 
          iconColor: "text-orange-600",
          cardBorder: "border-orange-200",
          cardBg: "bg-orange-50/50",
          spinnerColor: "text-orange-600",
          progressColor: "bg-orange-500"
        }
      default:
        return { 
          icon: Brain, 
          text: "Processing", 
          iconColor: "text-gray-600",
          cardBorder: "border-gray-200",
          cardBg: "bg-gray-50/50",
          spinnerColor: "text-gray-600",
          progressColor: "bg-gray-500"
        }
    }
  }
  
  const phaseConfig = getPhaseConfig(phase)
  const Icon = phaseConfig.icon

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
          <Icon className={`w-4 h-4 ${phaseConfig.iconColor} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700">{phaseConfig.text}</span>
        </div>
        <time className="text-sm text-gray-500 font-mono">{new Date().toLocaleTimeString()}</time>
      </div>
      
      <Card className={`border-2 ${phaseConfig.cardBorder} ${phaseConfig.cardBg}`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center space-x-3">
              <Loader2 className={`w-5 h-5 animate-spin ${phaseConfig.spinnerColor}`} />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Processing</span>
                  <span className="text-gray-500">∞</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${phaseConfig.progressColor} h-2 rounded-full animate-pulse`} style={{width: "60%"}}></div>
                </div>
              </div>
            </div>
            
            {/* Simulated thinking process */}
            <div className="space-y-2">
              {phase === "analyzing" && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.2s" }}>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <Skeleton className="h-3 w-36" />
                  </div>
                </>
              )}
              
              {phase === "thinking" && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.3s" }}>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <Skeleton className="h-3 w-44" />
                  </div>
                </>
              )}
              
              {phase === "generating" && (
                <>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </>
              )}
              
              {phase === "formatting" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Enhanced Document Card Skeleton with processing states
export function DocumentCardSkeleton({ processingState = "idle" }: { processingState?: "idle" | "uploading" | "processing" | "embedding" }) {
  const getStateConfig = (state: string) => {
    switch (state) {
      case "uploading":
        return {
          text: "Uploading",
          cardClasses: "border-blue-200 bg-blue-50",
          borderClasses: "border-b border-blue-200",
          dotClasses: "bg-blue-500",
          textClasses: "text-blue-600",
          progressClasses: "bg-blue-500"
        }
      case "processing":
        return {
          text: "Processing",
          cardClasses: "border-yellow-200 bg-yellow-50",
          borderClasses: "border-b border-yellow-200",
          dotClasses: "bg-yellow-500",
          textClasses: "text-yellow-600",
          progressClasses: "bg-yellow-500"
        }
      case "embedding":
        return {
          text: "Embedding",
          cardClasses: "border-green-200 bg-green-50",
          borderClasses: "border-b border-green-200",
          dotClasses: "bg-green-500",
          textClasses: "text-green-600",
          progressClasses: "bg-green-500"
        }
      default:
        return {
          text: "Loading",
          cardClasses: "border-gray-200 bg-white",
          borderClasses: "border-b border-gray-200",
          dotClasses: "bg-gray-500",
          textClasses: "text-gray-600",
          progressClasses: "bg-gray-500"
        }
    }
  }

  const stateConfig = getStateConfig(processingState)

  return (
    <Card className={`border-2 ${stateConfig.cardClasses} transition-all duration-500`}>
      <CardHeader className={stateConfig.borderClasses}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Skeleton className="h-5 w-5" />
                {processingState !== 'idle' && (
                  <div className={`absolute -top-1 -right-1 w-2 h-2 ${stateConfig.dotClasses} rounded-full animate-pulse`}></div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Skeleton className="h-5 w-48" />
                {processingState !== 'idle' && (
                  <div className={`text-xs ${stateConfig.textClasses} font-medium`}>{stateConfig.text}...</div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            
            {/* Processing progress bar */}
            {processingState !== 'idle' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={stateConfig.textClasses}>{stateConfig.text}</span>
                  <span className={stateConfig.textClasses}>∞</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`${stateConfig.progressClasses} h-1.5 rounded-full animate-pulse`} style={{width: "45%"}}></div>
                </div>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardHeader>
      
      {/* Additional content for processing states */}
      {processingState === "processing" && (
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-yellow-700">
              <Zap className="w-4 h-4" />
              <span>Extracting text and generating chunks...</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center space-y-1">
                <Skeleton className="h-4 w-8 mx-auto" />
                <span className="text-yellow-600">Pages</span>
              </div>
              <div className="text-center space-y-1">
                <Skeleton className="h-4 w-8 mx-auto" />
                <span className="text-yellow-600">Chunks</span>
              </div>
              <div className="text-center space-y-1">
                <Skeleton className="h-4 w-8 mx-auto" />
                <span className="text-yellow-600">Words</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
      
      {processingState === "embedding" && (
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm text-green-700">
              <Brain className="w-4 h-4" />
              <span>Generating AI embeddings...</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-green-600">Vector dimension: 1536</span>
              <span className="text-green-600">Progress: ∞%</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Enhanced Document Library Skeleton with multiple processing states
export function DocumentLibrarySkeleton({ hasDocuments = false, isProcessing = false }: { hasDocuments?: boolean, isProcessing?: boolean }) {
  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload/Processing Area */}
      {isProcessing && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <Upload className="w-8 h-8 text-blue-600 animate-bounce" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: "70%"}}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-4">
          {Array.from({ length: hasDocuments ? 3 : 1 }).map((_, i) => (
            <DocumentCardSkeleton 
              key={i} 
              processingState={isProcessing && i === 0 ? "processing" : "idle"}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// New Chat Interface Skeleton for initial loading
export function ChatInterfaceSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 p-4 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center justify-end space-x-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="bg-gray-100 p-3 rounded space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
            
            {/* Assistant message */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Chat Processing with multiple phases
export function EnhancedChatProcessingSkeleton({ 
  phase = "retrieving",
  progress = 0 
}: { 
  phase?: "retrieving" | "embedding" | "analyzing" | "thinking" | "generating" | "formatting",
  progress?: number 
}) {
  const getPhaseConfig = (currentPhase: string) => {
    switch (currentPhase) {
      case "retrieving":
        return {
          text: "Retrieving relevant documents",
          icon: FileText,
          iconColor: "text-blue-600",
          cardBorder: "border-blue-200",
          cardBg: "bg-blue-50/30",
          spinnerColor: "text-blue-600",
          textColor: "text-blue-800",
          progressTextColor: "text-blue-700",
          progressValueColor: "text-blue-600",
          progressBgColor: "bg-blue-500"
        }
      case "embedding":
        return {
          text: "Generating query embeddings",
          icon: Brain,
          iconColor: "text-purple-600",
          cardBorder: "border-purple-200",
          cardBg: "bg-purple-50/30",
          spinnerColor: "text-purple-600",
          textColor: "text-purple-800",
          progressTextColor: "text-purple-700",
          progressValueColor: "text-purple-600",
          progressBgColor: "bg-purple-500"
        }
      case "analyzing":
        return {
          text: "Analyzing document context",
          icon: Brain,
          iconColor: "text-indigo-600",
          cardBorder: "border-indigo-200",
          cardBg: "bg-indigo-50/30",
          spinnerColor: "text-indigo-600",
          textColor: "text-indigo-800",
          progressTextColor: "text-indigo-700",
          progressValueColor: "text-indigo-600",
          progressBgColor: "bg-indigo-500"
        }
      case "thinking":
        return {
          text: "AI reasoning and planning",
          icon: Brain,
          iconColor: "text-violet-600",
          cardBorder: "border-violet-200",
          cardBg: "bg-violet-50/30",
          spinnerColor: "text-violet-600",
          textColor: "text-violet-800",
          progressTextColor: "text-violet-700",
          progressValueColor: "text-violet-600",
          progressBgColor: "bg-violet-500"
        }
      case "generating":
        return {
          text: "Generating response",
          icon: MessageSquare,
          iconColor: "text-green-600",
          cardBorder: "border-green-200",
          cardBg: "bg-green-50/30",
          spinnerColor: "text-green-600",
          textColor: "text-green-800",
          progressTextColor: "text-green-700",
          progressValueColor: "text-green-600",
          progressBgColor: "bg-green-500"
        }
      case "formatting":
        return {
          text: "Formatting and finalizing",
          icon: Zap,
          iconColor: "text-orange-600",
          cardBorder: "border-orange-200",
          cardBg: "bg-orange-50/30",
          spinnerColor: "text-orange-600",
          textColor: "text-orange-800",
          progressTextColor: "text-orange-700",
          progressValueColor: "text-orange-600",
          progressBgColor: "bg-orange-500"
        }
      default:
        return {
          text: "Processing",
          icon: Brain,
          iconColor: "text-gray-600",
          cardBorder: "border-gray-200",
          cardBg: "bg-gray-50/30",
          spinnerColor: "text-gray-600",
          textColor: "text-gray-800",
          progressTextColor: "text-gray-700",
          progressValueColor: "text-gray-600",
          progressBgColor: "bg-gray-500"
        }
    }
  }
  
  const phaseConfig = getPhaseConfig(phase)
  const Icon = phaseConfig.icon

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full border">
          <div className="w-6 h-6 flex items-center justify-center">
            <Icon className={`w-4 h-4 ${phaseConfig.iconColor}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">ASSISTANT</span>
        </div>
        <time className="text-sm text-gray-500 font-mono">
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </time>
      </div>
      
      <Card className={`border-2 ${phaseConfig.cardBorder} ${phaseConfig.cardBg}`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Main status */}
            <div className="flex items-center space-x-3">
              <Loader2 className={`w-5 h-5 animate-spin ${phaseConfig.spinnerColor}`} />
              <span className={`text-base font-medium ${phaseConfig.textColor}`}>
                {phaseConfig.text}
              </span>
            </div>
            
            {/* Progress bar */}
            {progress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={phaseConfig.progressTextColor}>Progress</span>
                  <span className={phaseConfig.progressValueColor}>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`${phaseConfig.progressBgColor} h-2 rounded-full transition-all duration-300`}
                    style={{width: `${progress}%`}}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Phase-specific details */}
            <div className="space-y-2 text-sm">
              {phase === "retrieving" && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-700">Searching document database</span>
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.2s" }}>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-blue-700">Ranking by relevance</span>
                  </div>
                </>
              )}
              
              {phase === "embedding" && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-purple-700">Converting query to vectors</span>
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.2s" }}>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-purple-700">Computing similarities</span>
                  </div>
                </>
              )}
              
              {(phase === "analyzing" || phase === "thinking") && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    <span className="text-indigo-700">Reading context carefully</span>
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.3s" }}>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    <span className="text-indigo-700">Planning comprehensive response</span>
                  </div>
                </>
              )}
              
              {phase === "generating" && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-700">Writing structured response</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                </>
              )}
              
              {phase === "formatting" && (
                <>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-orange-700">Applying markdown formatting</span>
                  </div>
                  <div className="flex items-center space-x-2" style={{ animationDelay: "0.2s" }}>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-orange-700">Finalizing response</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ConfigurationSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />

      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-2 border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex justify-end space-x-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SystemStatusSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />

      <div className="grid gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PDFProcessorSkeleton() {
  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
            <Skeleton className="h-8 w-8 mx-auto mb-3" />
            <Skeleton className="h-4 w-48 mx-auto mb-2" />
            <Skeleton className="h-3 w-32 mx-auto" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
      <div className="border-t border-gray-200 p-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  )
}

export function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />

      <Card className="border-2 border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// New skeleton loaders for missing states

export function SearchResultsSkeleton() {
  return (
    <Card className="border-2 border-black shadow-none">
      <CardHeader className="border-b border-black">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-4 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function EnhancedSearchLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-black shadow-none">
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-3 w-48 mx-auto" />
            </div>
            <div className="w-full max-w-xs">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function APITestingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
          <div className="flex items-center justify-center space-x-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i}
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConfigurationTestingSkeleton() {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-1 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ChatProcessingSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Card className="border-2 border-gray-200 bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4 mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function QuickActionsLoadingSkeleton() {
  return (
    <div className="flex items-center space-x-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BulkExportLoadingSkeleton() {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-6 w-8 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RealTimeMetricsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, cardIndex) => (
        <Card key={cardIndex} className="border-2 border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
            {cardIndex === 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TabContentLoadingSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function MainAppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar skeleton */}
      <div className="w-80 bg-white border-r-2 border-black">
        <div className="p-6 border-b-2 border-black bg-black">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 bg-white/20" />
            <Skeleton className="h-4 w-48 bg-white/10" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-2 border-gray-200">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-2 border-black p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-8 w-8" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-black" />
              <Skeleton className="h-6 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VectorDatabaseLoadingSkeleton() {
  return (
    <Card className="border-2 border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WandbConfigurationLoadingSkeleton() {
  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

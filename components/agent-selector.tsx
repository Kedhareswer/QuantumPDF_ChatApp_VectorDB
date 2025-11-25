"use client"

import React, { useState, useCallback } from "react"
import {
  Brain,
  Scale,
  FileSearch,
  BookOpen,
  Sparkles,
  Loader2,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type AgentType, type AgentOutput, type AgentInput, getAgentManager } from "@/lib/domain-agents"

interface AgentInfo {
  type: AgentType
  name: string
  description: string
  icon: React.ElementType
  color: string
  useCase: string
}

const AVAILABLE_AGENTS: AgentInfo[] = [
  {
    type: "analogy-maker",
    name: "Analogy Maker",
    description: "Creates relatable analogies for complex concepts",
    icon: Sparkles,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    useCase: "Best for: Technical docs, scientific papers, complex explanations",
  },
  {
    type: "compliance-checker",
    name: "Compliance Checker",
    description: "Identifies ambiguous clauses and policy issues",
    icon: Scale,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    useCase: "Best for: Legal documents, policies, contracts, HR docs",
  },
  {
    type: "key-terms",
    name: "Key Terms Extractor",
    description: "Extracts and defines important terminology",
    icon: BookOpen,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    useCase: "Best for: Any document with specialized vocabulary",
  },
  {
    type: "summary",
    name: "Quick Summary",
    description: "Generates concise document summaries",
    icon: FileSearch,
    color: "text-green-600 bg-green-50 border-green-200",
    useCase: "Best for: Long documents, quick understanding",
  },
]

interface AgentSelectorProps {
  disabled?: boolean
  context?: string // Document context for agent processing
  question?: string // Current question/topic
  chunks?: Array<{
    content: string
    source: string
    similarity: number
    chunkType?: string
  }>
  onAgentResult?: (result: AgentOutput) => void
  aiClient?: any // Optional AI client for enhanced agent processing
}

export function AgentSelector({
  disabled = false,
  context = "",
  question = "",
  chunks = [],
  onAgentResult,
  aiClient,
}: AgentSelectorProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [runningAgent, setRunningAgent] = useState<AgentType | null>(null)
  const [results, setResults] = useState<Map<AgentType, AgentOutput>>(new Map())
  const [showResults, setShowResults] = useState(false)
  const [selectedResult, setSelectedResult] = useState<AgentOutput | null>(null)

  const runAgent = useCallback(async (agentType: AgentType) => {
    if (isRunning || disabled) return

    // Check if we have context to analyze
    if (!context && chunks.length === 0) {
      console.warn("No context available for agent processing")
      return
    }

    setIsRunning(true)
    setRunningAgent(agentType)

    try {
      const agentManager = getAgentManager({ 
        enabled: true, 
        aiClient,
        useLocalModels: !aiClient, // Use local models if no AI client
      })

      const input: AgentInput = {
        question: question || "Analyze this document",
        context: context || chunks.map(c => c.content).join("\n\n"),
        chunks,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      const result = await agentManager.runAgent(agentType, input)
      
      // Store result
      setResults(prev => new Map(prev).set(agentType, result))
      
      // Notify parent
      onAgentResult?.(result)

      // Show result dialog
      setSelectedResult(result)
      setShowResults(true)
    } catch (error) {
      console.error(`Agent ${agentType} failed:`, error)
    } finally {
      setIsRunning(false)
      setRunningAgent(null)
    }
  }, [isRunning, disabled, context, chunks, question, aiClient, onAgentResult])

  const runAllAgents = useCallback(async () => {
    if (isRunning || disabled) return

    setIsRunning(true)

    try {
      const agentManager = getAgentManager({ 
        enabled: true, 
        aiClient,
        useLocalModels: !aiClient,
      })

      const input: AgentInput = {
        question: question || "Analyze this document",
        context: context || chunks.map(c => c.content).join("\n\n"),
        chunks,
      }

      const allResults = await agentManager.runAgents(
        AVAILABLE_AGENTS.map(a => a.type),
        input
      )

      setResults(allResults)
      setShowResults(true)
    } catch (error) {
      console.error("Failed to run all agents:", error)
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, disabled, context, chunks, question, aiClient])

  const getAgentInfo = (type: AgentType): AgentInfo | undefined => {
    return AVAILABLE_AGENTS.find(a => a.type === type)
  }

  const formatConfidence = (confidence: number): string => {
    return `${Math.round(confidence * 100)}%`
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "text-green-600"
    if (confidence >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || isRunning || (!context && chunks.length === 0)}
                    className="h-8 px-3 border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4 mr-1" />
                    )}
                    <span className="hidden sm:inline">Agents</span>
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Run specialized analysis agents</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Domain Agents
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {AVAILABLE_AGENTS.map((agent) => {
                const Icon = agent.icon
                const hasResult = results.has(agent.type)
                const isCurrentlyRunning = runningAgent === agent.type

                return (
                  <DropdownMenuItem
                    key={agent.type}
                    onClick={() => runAgent(agent.type)}
                    disabled={isRunning}
                    className="flex items-start gap-3 py-2 cursor-pointer"
                  >
                    <div className={`p-1.5 rounded ${agent.color}`}>
                      {isCurrentlyRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{agent.name}</span>
                        {hasResult && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {agent.description}
                      </p>
                    </div>
                  </DropdownMenuItem>
                )
              })}

              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={runAllAgents}
                disabled={isRunning}
                className="flex items-center gap-2 py-2 cursor-pointer"
              >
                <div className="p-1.5 rounded bg-gradient-to-r from-purple-100 to-blue-100">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <span className="font-medium text-sm">Run All Agents</span>
                  <p className="text-xs text-gray-500">Comprehensive analysis</p>
                </div>
              </DropdownMenuItem>

              {results.size > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowResults(true)}
                    className="flex items-center gap-2 py-2 cursor-pointer"
                  >
                    <FileSearch className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">View Results ({results.size})</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>

        {/* Quick status badges */}
        {results.size > 0 && (
          <Badge 
            variant="secondary" 
            className="text-xs cursor-pointer hover:bg-gray-200"
            onClick={() => setShowResults(true)}
          >
            {results.size} analysis{results.size > 1 ? "es" : ""} ready
          </Badge>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Agent Analysis Results
            </DialogTitle>
            <DialogDescription>
              Results from specialized document analysis agents
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={selectedResult?.agentType || AVAILABLE_AGENTS[0].type} className="flex-1">
            <TabsList className="grid grid-cols-4 mb-4">
              {AVAILABLE_AGENTS.map((agent) => {
                const hasResult = results.has(agent.type)
                const Icon = agent.icon
                
                return (
                  <TabsTrigger
                    key={agent.type}
                    value={agent.type}
                    disabled={!hasResult}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{agent.name.split(" ")[0]}</span>
                    {hasResult && <CheckCircle className="w-3 h-3 text-green-500" />}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {AVAILABLE_AGENTS.map((agent) => {
              const result = results.get(agent.type)
              const Icon = agent.icon

              return (
                <TabsContent key={agent.type} value={agent.type} className="mt-0">
                  {result ? (
                    <Card className={`border-2 ${agent.color}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Icon className="w-5 h-5" />
                            {agent.name}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span>{result.processingTime}ms</span>
                            </div>
                            <div className={`flex items-center gap-1 ${getConfidenceColor(result.confidence)}`}>
                              {result.confidence >= 0.7 ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                              <span>{formatConfidence(result.confidence)}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                            {result.result}
                          </div>
                          
                          {result.details && Object.keys(result.details).length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-semibold mb-2 text-gray-600">
                                Processing Details
                              </h4>
                              <div className="text-xs text-gray-500 space-y-1">
                                {Object.entries(result.details).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="font-medium">{key}:</span>
                                    <span>
                                      {typeof value === "object" 
                                        ? JSON.stringify(value) 
                                        : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-2 border-dashed border-gray-200">
                      <CardContent className="py-12 text-center">
                        <Icon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600 mb-2">
                          {agent.name} Not Run
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                          {agent.useCase}
                        </p>
                        <Button
                          onClick={() => {
                            setShowResults(false)
                            runAgent(agent.type)
                          }}
                          disabled={isRunning}
                          variant="outline"
                          className={agent.color}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          Run {agent.name}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AgentSelector


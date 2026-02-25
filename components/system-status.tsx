"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Activity, Brain, FileText, Gauge, MessageSquare, Target } from "lucide-react"
import { useMemo } from "react"

interface SystemStatusProps {
  modelStatus: "loading" | "ready" | "error" | "config"
  apiConfig: unknown
  documents: unknown[]
  messages: unknown[]
  ragEngine: unknown
}

interface QueryAnalysisSnapshot {
  originalQuery: string
  rewrittenQuery: string
  queryType: string
  complexity: "simple" | "moderate" | "complex"
  requiresHyDE: boolean
  requiresStepBack: boolean
  alternativeQueries: string[]
  hasHypotheticalAnswer: boolean
  hasStepBackQuestion: boolean
  confidence: number
}

interface AssistantMetadata {
  responseTime?: number
  relevanceScore?: number
  qualityMetrics?: {
    finalRating: number
  }
  tokenUsage?: {
    totalTokens: number
  }
  queryAnalysis?: QueryAnalysisSnapshot
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

export function SystemStatus({
  modelStatus = "config",
  apiConfig = {},
  documents = [],
  messages = [],
  ragEngine = {},
}: SystemStatusProps) {
  const safeMessages = useMemo(() => (Array.isArray(messages) ? messages : []), [messages])
  const safeDocuments = useMemo(() => (Array.isArray(documents) ? documents : []), [documents])

  const rag = asRecord(ragEngine)
  const ai = asRecord(apiConfig)

  const stats = useMemo(() => {
    const assistantMessages = safeMessages.filter((m) => asRecord(m).role === "assistant")
    const userMessages = safeMessages.filter((m) => asRecord(m).role === "user")

    const avgResponseTime = assistantMessages.length
      ? Math.round(
          assistantMessages.reduce((sum, msg) => {
            const metadata = asRecord(asRecord(msg).metadata) as AssistantMetadata
            return sum + (metadata.responseTime || 0)
          }, 0) / assistantMessages.length,
        )
      : 0

    const documentChunks = safeDocuments.reduce((sum, doc) => {
      const chunks = asRecord(doc).chunks
      return sum + (Array.isArray(chunks) ? chunks.length : 0)
    }, 0)

    const lastAssistant = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null
    const lastUser = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null

    const lastAssistantMeta = (asRecord(lastAssistant && asRecord(lastAssistant).metadata) as AssistantMetadata) || {}
    const queryAnalysis = lastAssistantMeta.queryAnalysis

    return {
      queries: userMessages.length,
      responses: assistantMessages.length,
      avgResponseTime,
      documentChunks,
      lastAssistant,
      lastUser,
      lastAssistantMeta,
      queryAnalysis,
    }
  }, [safeDocuments, safeMessages])

  const engineInitialized = Boolean(rag.initialized)
  const engineHealthy = Boolean(rag.healthy)
  const provider = (rag.currentProvider as string) || (ai.provider as string) || "not-set"
  const model = (rag.currentModel as string) || (ai.model as string) || "not-set"
  const queryCache = asRecord(rag.queryCache)

  const statusTone =
    modelStatus === "ready"
      ? "text-green-700"
      : modelStatus === "loading"
      ? "text-yellow-700"
      : modelStatus === "error"
      ? "text-red-700"
      : "text-gray-700"

  return (
    <div className="space-y-4">
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>SYSTEM SNAPSHOT</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">AI Status</span>
              <Badge variant="outline" className={statusTone}>{modelStatus.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">RAG Engine</span>
              <Badge variant="outline" className={engineHealthy ? "text-green-700" : "text-red-700"}>
                {engineHealthy ? "HEALTHY" : engineInitialized ? "DEGRADED" : "NOT READY"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Provider</span>
              <span className="font-mono text-xs">{provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Model</span>
              <span className="font-mono text-xs">{model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Documents</span>
              <span className="font-bold">{safeDocuments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Chunks</span>
              <span className="font-bold">{stats.documentChunks}</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Queries</span>
              <span className="font-bold">{stats.queries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Responses</span>
              <span className="font-bold">{stats.responses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Response</span>
              <span className="font-bold">{stats.avgResponseTime}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cache</span>
              <span className="font-bold">
                {(queryCache.size as number) || 0}/{(queryCache.maxSize as number) || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>QUERY PIPELINE</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3 text-sm">
          {stats.queryAnalysis ? (
            <>
              <div className="space-y-1">
                <div className="text-gray-600">Original Query</div>
                <div className="text-xs bg-gray-50 p-2 border rounded">{stats.queryAnalysis.originalQuery}</div>
              </div>

              <div className="space-y-1">
                <div className="text-gray-600">Rewritten Query</div>
                <div className="text-xs bg-gray-50 p-2 border rounded">{stats.queryAnalysis.rewrittenQuery}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Type</span>
                  <Badge variant="outline">{stats.queryAnalysis.queryType}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Complexity</span>
                  <Badge variant="outline">{stats.queryAnalysis.complexity}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">HyDE</span>
                  <span className="font-bold">{stats.queryAnalysis.requiresHyDE ? "ON" : "OFF"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Step-back</span>
                  <span className="font-bold">{stats.queryAnalysis.requiresStepBack ? "ON" : "OFF"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Alt Queries</span>
                  <span className="font-bold">{stats.queryAnalysis.alternativeQueries?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Confidence</span>
                  <span className="font-bold">{Math.round((stats.queryAnalysis.confidence || 0) * 100)}%</span>
                </div>
              </div>
            </>
          ) : (
            <Alert>
              <AlertDescription>
                Query pipeline data will appear after the next assistant response.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="w-5 h-5" />
            <span>LAST RESPONSE METRICS</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Quality</span>
              <span className="font-bold">{Math.round(stats.lastAssistantMeta.qualityMetrics?.finalRating || 0)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Relevance</span>
              <span className="font-bold">{Math.round((stats.lastAssistantMeta.relevanceScore || 0) * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Latency</span>
              <span className="font-bold">{stats.lastAssistantMeta.responseTime || 0}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tokens</span>
              <span className="font-bold">{stats.lastAssistantMeta.tokenUsage?.totalTokens || 0}</span>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-gray-600">
              <MessageSquare className="w-3 h-3" />
              <span>Last User Query</span>
            </div>
            <div className="bg-gray-50 p-2 border rounded">{String(asRecord(stats.lastUser).content || "-")}</div>

            <div className="flex items-center space-x-2 text-gray-600">
              <FileText className="w-3 h-3" />
              <span>Last Assistant Snippet</span>
            </div>
            <div className="bg-gray-50 p-2 border rounded">
              {String(asRecord(stats.lastAssistant).content || "-").slice(0, 200)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>RUNTIME FLAGS</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Initialized</span>
              <span className="font-bold">{engineInitialized ? "YES" : "NO"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Healthy</span>
              <span className="font-bold">{engineHealthy ? "YES" : "NO"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Cache Hit Rate</span>
              <span className="font-bold">{Number(queryCache.hitRate || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Vector Mode</span>
              <span className="font-bold">{String(asRecord(ai).provider || "-")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Activity, Brain, FileText, Gauge, MessageSquare, Target } from "lucide-react"
import type React from "react"
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
          assistantMessages.reduce<number>((sum, msg) => {
            const metadata = asRecord(asRecord(msg).metadata) as AssistantMetadata
            return sum + (metadata.responseTime || 0)
          }, 0) / assistantMessages.length,
        )
      : 0

    const documentChunks = safeDocuments.reduce<number>((sum, doc) => {
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

  const lastQuery = String(asRecord(stats.lastUser).content || "-")
  const lastSnippet = String(asRecord(stats.lastAssistant).content || "-").slice(0, 200)

  return (
    <div className="space-y-4">
      <Panel icon={<Activity className="w-4 h-4" />} title="System snapshot">
        <StatGrid>
          <Stat label="AI status"><span className={statusTone}>{modelStatus.toUpperCase()}</span></Stat>
          <Stat label="RAG engine">
            <span className={engineHealthy ? "text-green-700" : "text-red-700"}>
              {engineHealthy ? "HEALTHY" : engineInitialized ? "DEGRADED" : "NOT READY"}
            </span>
          </Stat>
          <Stat label="Provider" mono>{provider}</Stat>
          <Stat label="Model" mono>{model}</Stat>
          <Stat label="Documents">{safeDocuments.length}</Stat>
          <Stat label="Chunks">{stats.documentChunks}</Stat>
          <Stat label="Queries">{stats.queries}</Stat>
          <Stat label="Responses">{stats.responses}</Stat>
          <Stat label="Avg response">{stats.avgResponseTime}ms</Stat>
          <Stat label="Cache">
            {(queryCache.size as number) || 0}/{(queryCache.maxSize as number) || 0}
          </Stat>
        </StatGrid>
      </Panel>

      <Panel icon={<Brain className="w-4 h-4" />} title="Query pipeline">
        {stats.queryAnalysis ? (
          <div className="space-y-3">
            <Quote label="Original query">{stats.queryAnalysis.originalQuery}</Quote>
            <Quote label="Rewritten query">{stats.queryAnalysis.rewrittenQuery}</Quote>
            <StatGrid>
              <Stat label="Type">{stats.queryAnalysis.queryType}</Stat>
              <Stat label="Complexity">{stats.queryAnalysis.complexity}</Stat>
              <Stat label="HyDE">{stats.queryAnalysis.requiresHyDE ? "ON" : "OFF"}</Stat>
              <Stat label="Step-back">{stats.queryAnalysis.requiresStepBack ? "ON" : "OFF"}</Stat>
              <Stat label="Alt queries">{stats.queryAnalysis.alternativeQueries?.length || 0}</Stat>
              <Stat label="Confidence">{Math.round((stats.queryAnalysis.confidence || 0) * 100)}%</Stat>
            </StatGrid>
          </div>
        ) : (
          <Alert>
            <AlertDescription>Query pipeline data will appear after the next assistant response.</AlertDescription>
          </Alert>
        )}
      </Panel>

      <Panel icon={<Gauge className="w-4 h-4" />} title="Last response">
        <div className="space-y-3">
          <StatGrid>
            <Stat label="Quality">{Math.round(stats.lastAssistantMeta.qualityMetrics?.finalRating || 0)}%</Stat>
            <Stat label="Relevance">{Math.round((stats.lastAssistantMeta.relevanceScore || 0) * 100)}%</Stat>
            <Stat label="Latency">{((stats.lastAssistantMeta.responseTime || 0) / 1000).toFixed(1)}s</Stat>
            <Stat label="Tokens">{(stats.lastAssistantMeta.tokenUsage?.totalTokens || 0).toLocaleString()}</Stat>
          </StatGrid>
          <Quote label="Last user query" icon={<MessageSquare className="w-3 h-3" />}>{lastQuery}</Quote>
          <Quote label="Last answer snippet" icon={<FileText className="w-3 h-3" />}>{lastSnippet}</Quote>
        </div>
      </Panel>

      <Panel icon={<Target className="w-4 h-4" />} title="Runtime flags">
        <StatGrid>
          <Stat label="Initialized">{engineInitialized ? "YES" : "NO"}</Stat>
          <Stat label="Healthy">{engineHealthy ? "YES" : "NO"}</Stat>
          <Stat label="Cache hit rate">{Number(queryCache.hitRate || 0).toFixed(2)}</Stat>
          <Stat label="Vector mode" mono>{String(asRecord(ai).provider || "-")}</Stat>
        </StatGrid>
      </Panel>
    </div>
  )
}

// Sidebar is ~280px wide, so every stat stacks label over value; side-by-side
// label/value pairs in a 2-col grid collided ("Latency13918ms").
function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-black bg-white">
      <h3 className="flex items-center gap-2 px-3 py-2 border-b-2 border-black text-xs font-bold uppercase tracking-wider">
        {icon}
        {title}
      </h3>
      <div className="p-3 text-sm">{children}</div>
    </section>
  )
}

function StatGrid({ children }: { children: React.ReactNode }) {
  // gap-px on a black background draws 1px rules between tiles
  return <div className="grid grid-cols-2 gap-px bg-black border border-black">{children}</div>
}

function Stat({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-2.5 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 truncate">{label}</div>
      <div className={`font-bold truncate ${mono ? "font-mono text-xs" : "text-sm"}`}>{children}</div>
    </div>
  )
}

function Quote({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">
        {icon}
        {label}
      </div>
      <div className="text-xs bg-gray-50 p-2 border border-black break-words">{children}</div>
    </div>
  )
}

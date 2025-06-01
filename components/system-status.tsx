"use client"

import { useState, useEffect } from "react"
import { Activity, Zap, Database, Clock, Target, Cpu, Wifi } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface SystemStatusProps {
  modelStatus: "loading" | "ready" | "error" | "config"
  apiConfig: any
  documents: any[]
  messages: any[]
  ragEngine: { isHealthy?: () => boolean } | any
}

export function SystemStatus({ modelStatus, apiConfig, documents, messages, ragEngine }: SystemStatusProps) {
  const [systemMetrics, setSystemMetrics] = useState({
    uptime: 0,
    totalQueries: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics((prev) => ({
        ...prev,
        uptime: prev.uptime + 1,
        totalQueries: messages.filter((m) => m.role === "user").length,
        avgResponseTime: calculateAvgResponseTime(),
        memoryUsage: Math.random() * 100, // Simulated
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [messages])

  const calculateAvgResponseTime = () => {
    const assistantMessages = messages.filter((m) => m.role === "assistant" && m.metadata?.responseTime)
    if (assistantMessages.length === 0) return 0

    const totalTime = assistantMessages.reduce((sum, msg) => sum + (msg.metadata?.responseTime || 0), 0)
    return Math.round(totalTime / assistantMessages.length)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "text-green-600"
      case "loading":
        return "text-yellow-600"
      case "error":
        return "text-red-600"
      case "config":
        return "text-blue-600"
      default:
        return "text-gray-600"
    }
  }

  const getHealthScore = () => {
    let score = 0
    if (modelStatus === "ready") score += 40
    if (documents.length > 0) score += 30
    if (apiConfig.apiKey) score += 20
    if (ragEngine && typeof ragEngine.isHealthy === "function" && ragEngine.isHealthy()) score += 10
    return score
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const healthScore = getHealthScore()

  return (
    <div className="space-y-4">
      {/* System Health */}
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>SYSTEM HEALTH</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Health</span>
                <span className="text-sm font-bold">{healthScore}%</span>
              </div>
              <Progress value={healthScore} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">AI Status:</span>
                <Badge variant="outline" className={`border-black ${getStatusColor(modelStatus)}`}>
                  {modelStatus.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Documents:</span>
                <span className="font-bold">{documents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Provider:</span>
                <span className="font-bold">{apiConfig.provider.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Model:</span>
                <span className="font-bold text-xs truncate">{apiConfig.model.split("/").pop()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>PERFORMANCE</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <div>
                <div className="text-gray-600">Uptime</div>
                <div className="font-bold font-mono">{formatUptime(systemMetrics.uptime)}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-gray-600" />
              <div>
                <div className="text-gray-600">Queries</div>
                <div className="font-bold">{systemMetrics.totalQueries}</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-gray-600" />
              <div>
                <div className="text-gray-600">Avg Response</div>
                <div className="font-bold">{systemMetrics.avgResponseTime}ms</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-gray-600" />
              <div>
                <div className="text-gray-600">Memory</div>
                <div className="font-bold">{systemMetrics.memoryUsage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="w-5 h-5" />
            <span>CONNECTIONS</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">AI Provider:</span>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${modelStatus === "ready" ? "bg-green-500" : modelStatus === "error" ? "bg-red-500" : "bg-yellow-500"}`}
                />
                <span className="font-bold">{apiConfig.provider}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">RAG Engine:</span>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${ragEngine && typeof ragEngine.isHealthy === "function" && ragEngine.isHealthy() ? "bg-green-500" : "bg-red-500"}`}
                />
                <span className="font-bold">
                  {ragEngine && typeof ragEngine.isHealthy === "function" && ragEngine.isHealthy()
                    ? "HEALTHY"
                    : "ERROR"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Wandb Tracking:</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-bold">ACTIVE</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {messages.length > 0 && (
        <Card className="border-2 border-black shadow-none">
          <CardHeader className="border-b border-black">
            <CardTitle className="text-sm">RECENT ACTIVITY</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 text-xs">
              {messages
                .slice(-3)
                .reverse()
                .map((message, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1 border-b border-gray-200 last:border-b-0"
                  >
                    <span className="text-gray-600 truncate flex-1">
                      {message.role === "user" ? "Query" : "Response"}: {message.content.substring(0, 30)}...
                    </span>
                    <span className="font-mono text-gray-500 ml-2">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

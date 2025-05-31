"use client"

import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface APIStatus {
  huggingface: "checking" | "connected" | "error"
  wandb: "checking" | "connected" | "error"
}

export function APIStatus() {
  const [status, setStatus] = useState<APIStatus>({
    huggingface: "checking",
    wandb: "checking",
  })

  useEffect(() => {
    checkAPIStatus()
  }, [])

  const checkAPIStatus = async () => {
    // Check Hugging Face API
    try {
      const hfResponse = await fetch("/api/test/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })

      setStatus((prev) => ({
        ...prev,
        huggingface: hfResponse.ok ? "connected" : "error",
      }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, huggingface: "error" }))
    }

    // Check Wandb API
    try {
      const wandbResponse = await fetch("/api/test/wandb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })

      setStatus((prev) => ({
        ...prev,
        wandb: wandbResponse.ok ? "connected" : "error",
      }))
    } catch (error) {
      setStatus((prev) => ({ ...prev, wandb: "error" }))
    }
  }

  const getStatusIcon = (apiStatus: string) => {
    switch (apiStatus) {
      case "checking":
        return <Loader2 className="w-4 h-4 animate-spin" />
      case "connected":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusColor = (apiStatus: string) => {
    switch (apiStatus) {
      case "connected":
        return "border-green-600 text-green-600"
      case "error":
        return "border-red-600 text-red-600"
      default:
        return "border-yellow-600 text-yellow-600"
    }
  }

  return (
    <Card className="border-2 border-black shadow-none">
      <CardHeader className="border-b border-black">
        <CardTitle className="text-sm">API STATUS</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Hugging Face</span>
          <Badge variant="outline" className={getStatusColor(status.huggingface)}>
            {getStatusIcon(status.huggingface)}
            <span className="ml-1 text-xs">{status.huggingface.toUpperCase()}</span>
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Wandb</span>
          <Badge variant="outline" className={getStatusColor(status.wandb)}>
            {getStatusIcon(status.wandb)}
            <span className="ml-1 text-xs">{status.wandb.toUpperCase()}</span>
          </Badge>
        </div>

        {(status.huggingface === "error" || status.wandb === "error") && (
          <div className="mt-3 p-2 border border-red-300 bg-red-50 text-red-700 text-xs">
            <p>Some APIs are not responding. Check your API keys and try again.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

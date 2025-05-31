"use client"

import { RotateCcw, Trash2, Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuickActionsProps {
  onClearChat: () => void
  onNewSession: () => void
  disabled?: boolean
}

export function QuickActions({ onClearChat, onNewSession, disabled = false }: QuickActionsProps) {
  const handleExportChat = () => {
    // Implementation for exporting chat history
    console.log("Export chat functionality")
  }

  const handleShareSession = () => {
    // Implementation for sharing session
    console.log("Share session functionality")
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onClearChat}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Clear Chat History"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onNewSession}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="New Session"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleExportChat}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Export Chat"
      >
        <Download className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleShareSession}
        disabled={disabled}
        className="border-black text-black hover:bg-black hover:text-white"
        title="Share Session"
      >
        <Share className="w-4 h-4" />
      </Button>
    </div>
  )
}

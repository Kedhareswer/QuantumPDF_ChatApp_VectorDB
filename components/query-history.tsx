"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { ChevronRight, Clock, History, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

interface QueryHistoryItem {
  id: string
  query: string
  timestamp: Date
  responseLength?: number
}

interface QueryHistoryProps {
  onSelectQuery: (query: string) => void
  className?: string
}

const STORAGE_KEY = "quantum-pdf-query-history"
const MAX_HISTORY = 50

declare global {
  interface Window {
    __addQueryToHistory?: (query: string, responseLength?: number) => void
  }
}

export function QueryHistory({ onSelectQuery, className = "" }: QueryHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState<QueryHistoryItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []

      const parsed = JSON.parse(stored) as unknown
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter(
          (item): item is { id: string; query: string; timestamp: string; responseLength?: number } =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { query?: unknown }).query === "string" &&
            typeof (item as { timestamp?: unknown }).timestamp === "string"
        )
        .map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }))
    } catch (error) {
      console.error("Failed to load query history:", error)
      return []
    }
  })
  const [searchTerm, setSearchTerm] = useState("")

  const addToHistory = useCallback((query: string, responseLength?: number) => {
    if (!query.trim()) return

    const newItem: QueryHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      timestamp: new Date(),
      responseLength
    }

    setHistory(prev => {
      // Remove duplicates (same query)
      const filtered = prev.filter(item => item.query.toLowerCase() !== query.toLowerCase().trim())
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY)

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        console.error("Failed to save query history:", error)
      }

      return updated
    })
  }, [])

  useEffect(() => {
    window.__addQueryToHistory = addToHistory
    return () => {
      delete window.__addQueryToHistory
    }
  }, [addToHistory])

  const clearHistory = () => {
    if (window.confirm("Clear all query history?")) {
      setHistory([])
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error("Failed to clear query history:", error)
      }
    }
  }

  const filteredHistory = history.filter(item =>
    item.query.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 px-3 border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 ${className}`}
          >
            <History className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">History</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:w-[320px] md:w-[400px] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Query History
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  {history.length} saved {history.length === 1 ? 'query' : 'queries'}
                </SheetDescription>
              </div>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="h-8 px-2 text-xs text-gray-600 hover:text-gray-900"
                >
                  Clear
                </Button>
              )}
            </div>
          </SheetHeader>

          {history.length > 0 && (
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <History className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-sm text-gray-500 mb-2">
                  {searchTerm ? "No queries match your search" : "No query history yet"}
                </p>
                <p className="text-xs text-gray-400">
                  {searchTerm ? "Try a different search term" : "Your queries will appear here"}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectQuery(item.query)
                      setIsOpen(false)
                    }}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 line-clamp-2 group-hover:text-gray-950">
                          {item.query}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTime(item.timestamp)}
                          </Badge>
                          {item.responseLength && (
                            <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50">
                              {item.responseLength} chars
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}

// Hook to add queries to history from outside
export function useQueryHistory() {
  const addToHistory = (query: string, responseLength?: number) => {
    if (typeof window !== 'undefined' && window.__addQueryToHistory) {
      window.__addQueryToHistory(query, responseLength)
    }
  }
  return { addQueryHistory: addToHistory }
}


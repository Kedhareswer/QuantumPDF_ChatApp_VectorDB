"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Search, Filter, FileText, Clock, Target, Zap } from "lucide-react"

interface SearchResult {
  id: string
  content: string
  score: number
  metadata: {
    source: string
    documentId: string
    chunkIndex: number
    timestamp: string
  }
}

interface SearchFilters {
  searchMode: "semantic" | "keyword" | "hybrid"
  documentTypes: string[]
  maxResults: number
  relevanceThreshold: number
}

interface EnhancedSearchProps {
  onSearch: (query: string, filters: SearchFilters) => Promise<SearchResult[]>
  documents: any[]
}

export function EnhancedSearch({ onSearch, documents }: EnhancedSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    searchMode: "hybrid",
    documentTypes: [],
    maxResults: 10,
    relevanceThreshold: 0.1,
  })
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const searchResults = await onSearch(query, filters)
      setResults(searchResults)
    } catch (error) {
      console.error("Search failed:", error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const getSearchModeIcon = (mode: string) => {
    switch (mode) {
      case "semantic":
        return <Target className="w-4 h-4" />
      case "keyword":
        return <Search className="w-4 h-4" />
      case "hybrid":
        return <Zap className="w-4 h-4" />
      default:
        return <Search className="w-4 h-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600"
    if (score >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString()
    } catch {
      return "Unknown"
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <Card className="border-2 border-black shadow-none">
        <CardHeader className="border-b border-black">
          <CardTitle className="text-sm flex items-center space-x-2">
            <Search className="w-4 h-4" />
            <span>DOCUMENT SEARCH</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search through your documents..."
                className="border-2 border-black pr-10"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="border-2 border-black hover:bg-black hover:text-white"
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="border-2 border-black bg-black text-white hover:bg-gray-800"
            >
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Search Filters */}
          {showFilters && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Search Mode</Label>
                  <Select
                    value={filters.searchMode}
                    onValueChange={(value: any) => setFilters({ ...filters, searchMode: value })}
                  >
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semantic">
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4" />
                          <span>Semantic</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="keyword">
                        <div className="flex items-center space-x-2">
                          <Search className="w-4 h-4" />
                          <span>Keyword</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="hybrid">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4" />
                          <span>Hybrid</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Results: {filters.maxResults}</Label>
                  <Slider
                    value={[filters.maxResults]}
                    onValueChange={([value]) => setFilters({ ...filters, maxResults: value })}
                    max={50}
                    min={5}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Relevance Threshold: {(filters.relevanceThreshold * 100).toFixed(0)}%
                </Label>
                <Slider
                  value={[filters.relevanceThreshold]}
                  onValueChange={([value]) => setFilters({ ...filters, relevanceThreshold: value })}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {documents.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filter by Documents</Label>
                  <div className="flex flex-wrap gap-2">
                    {documents.map((doc) => (
                      <Badge
                        key={doc.id}
                        variant={filters.documentTypes.includes(doc.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newTypes = filters.documentTypes.includes(doc.id)
                            ? filters.documentTypes.filter((id) => id !== doc.id)
                            : [...filters.documentTypes, doc.id]
                          setFilters({ ...filters, documentTypes: newTypes })
                        }}
                      >
                        {doc.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card className="border-2 border-black shadow-none">
          <CardHeader className="border-b border-black">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>SEARCH RESULTS ({results.length})</span>
              <div className="flex items-center space-x-2">
                {getSearchModeIcon(filters.searchMode)}
                <Badge variant="outline" className="text-xs">
                  {filters.searchMode.toUpperCase()}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div key={result.id} className="p-4 border-b border-gray-200 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{result.metadata.source}</span>
                      <Badge variant="outline" className="text-xs">
                        Chunk {result.metadata.chunkIndex + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-medium ${getScoreColor(result.score)}`}>
                        {(result.score * 100).toFixed(1)}%
                      </span>
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{formatTimestamp(result.metadata.timestamp)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">{result.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <Card className="border-2 border-black shadow-none">
          <CardContent className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-gray-500">No results found for "{query}"</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms or filters</p>
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      {!query && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-center">
            <Target className="w-3 h-3 mr-1 text-blue-500" />
            <strong>Semantic:</strong> Finds content by meaning and context
          </p>
          <p className="flex items-center">
            <Search className="w-3 h-3 mr-1 text-green-500" />
            <strong>Keyword:</strong> Finds exact word matches
          </p>
          <p className="flex items-center">
            <Zap className="w-3 h-3 mr-1 text-purple-500" />
            <strong>Hybrid:</strong> Combines both semantic and keyword search
          </p>
        </div>
      )}
    </div>
  )
}

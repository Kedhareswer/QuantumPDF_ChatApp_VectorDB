"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  Globe, 
  BookOpen, 
  TrendingUp,
  Clock,
  Filter
} from 'lucide-react'

interface SearchControlsProps {
  onSourcesChange?: (sources: string[]) => void
  onTimeRangeChange?: (timeRange: string) => void
  onSummaryLevelChange?: (level: 'quick' | 'standard' | 'detailed') => void
  onMaxResultsChange?: (maxResults: number) => void
  defaultSources?: string[]
  defaultTimeRange?: string
  defaultSummaryLevel?: 'quick' | 'standard' | 'detailed'
  defaultMaxResults?: number
}

export function SearchControls({
  onSourcesChange,
  onTimeRangeChange,
  onSummaryLevelChange,
  onMaxResultsChange,
  defaultSources = ['web', 'arxiv', 'news'],
  defaultTimeRange = 'all',
  defaultSummaryLevel = 'standard',
  defaultMaxResults = 10
}: SearchControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedSources, setSelectedSources] = useState<string[]>(defaultSources)
  const [timeRange, setTimeRange] = useState(defaultTimeRange)
  const [summaryLevel, setSummaryLevel] = useState(defaultSummaryLevel)
  const [maxResults, setMaxResults] = useState(defaultMaxResults)

  const handleSourceToggle = (source: string) => {
    const newSources = selectedSources.includes(source)
      ? selectedSources.filter(s => s !== source)
      : [...selectedSources, source]
    
    setSelectedSources(newSources)
    onSourcesChange?.(newSources)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    onTimeRangeChange?.(value)
  }

  const handleSummaryLevelChange = (value: 'quick' | 'standard' | 'detailed') => {
    setSummaryLevel(value)
    onSummaryLevelChange?.(value)
  }

  const handleMaxResultsChange = (value: string) => {
    const num = parseInt(value)
    setMaxResults(num)
    onMaxResultsChange?.(num)
  }

  const sourceOptions = [
    { id: 'web', label: 'Web Search', icon: Globe, description: 'General web results via Brave Search' },
    { id: 'arxiv', label: 'arXiv Papers', icon: BookOpen, description: 'Academic papers and preprints' },
    { id: 'news', label: 'News & HN', icon: TrendingUp, description: 'News articles and Hacker News' }
  ]

  return (
    <Card className="mb-4 border-2 border-gray-200">
      <CardHeader className="pb-3">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-600" />
                <CardTitle className="text-sm font-semibold">Search Controls</CardTitle>
                <div className="flex gap-1">
                  {selectedSources.map(source => (
                    <Badge key={source} variant="outline" className="text-xs">
                      {sourceOptions.find(s => s.id === source)?.label}
                    </Badge>
                  ))}
                </div>
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Data Sources
                  </Label>
                  <div className="space-y-2">
                    {sourceOptions.map((source) => {
                      const Icon = source.icon
                      return (
                        <div key={source.id} className="flex items-center space-x-3">
                          <Switch
                            id={source.id}
                            checked={selectedSources.includes(source.id)}
                            onCheckedChange={() => handleSourceToggle(source.id)}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Icon className="w-4 h-4 text-gray-500" />
                            <div>
                              <Label htmlFor={source.id} className="text-sm font-medium cursor-pointer">
                                {source.label}
                              </Label>
                              <p className="text-xs text-gray-500">{source.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Advanced Options */}
                <div className="space-y-4">
                  {/* Time Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time Range
                    </Label>
                    <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="1y">Last year</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary Level */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Summary Detail</Label>
                    <Select value={summaryLevel} onValueChange={handleSummaryLevelChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick">Quick (1-2 sentences)</SelectItem>
                        <SelectItem value="standard">Standard (paragraph)</SelectItem>
                        <SelectItem value="detailed">Detailed (comprehensive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Max Results */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Max Results</Label>
                    <Select value={maxResults.toString()} onValueChange={handleMaxResultsChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 results</SelectItem>
                        <SelectItem value="10">10 results</SelectItem>
                        <SelectItem value="15">15 results</SelectItem>
                        <SelectItem value="20">20 results</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span>Sources: {selectedSources.length}</span>
                  <span>•</span>
                  <span>Time: {timeRange === 'all' ? 'All time' : timeRange}</span>
                  <span>•</span>
                  <span>Detail: {summaryLevel}</span>
                  <span>•</span>
                  <span>Results: {maxResults}</span>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  )
}

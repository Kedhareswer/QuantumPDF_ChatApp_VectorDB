"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  MessageSquare, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  Globe,
  Calendar,
  User,
  BookOpen,
  TrendingUp,
  FileText
} from 'lucide-react'

interface SourceItem {
  id: number
  title: string
  url: string
  provider: string
  publishedAt?: string
  authors?: string[]
  snippet?: string
  summary?: string
  reliability?: number
  sentiment?: 'pos' | 'neu' | 'neg'
  bias?: { leaning: 'left' | 'right' | 'center' | 'unknown'; strength?: number }
}

interface ClaimCheck {
  claim: string
  status: 'verified' | 'disputed' | 'unverified'
  sources: number[]
  confidence: number
}

interface EnhancedSearchResultsProps {
  sources: SourceItem[]
  claims?: ClaimCheck[]
  onFollowUp?: (sourceId: number, question: string) => void
  onDeepDive?: (sourceId: number) => void
  onCrossReference?: (sourceId: number) => void
  onExportCitation?: (sourceId: number, format: 'bibtex' | 'apa' | 'mla') => void
}

export function EnhancedSearchResults({
  sources,
  claims = [],
  onFollowUp,
  onDeepDive,
  onCrossReference,
  onExportCitation
}: EnhancedSearchResultsProps) {
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [expandedClaims, setExpandedClaims] = useState(false)

  const toggleSource = (id: number) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSources(newExpanded)
  }

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'arxiv': return <BookOpen className="w-4 h-4" />
      case 'links': return <ExternalLink className="w-4 h-4" />
      case 'local': return <FileText className="w-4 h-4" />
      case 'brave':
      case 'web': return <Globe className="w-4 h-4" />
      case 'hn':
      case 'news': return <TrendingUp className="w-4 h-4" />
      default: return <Globe className="w-4 h-4" />
    }
  }

  const getReliabilityColor = (reliability?: number) => {
    if (!reliability) return 'border-gray-300 text-gray-600'
    if (reliability >= 0.8) return 'border-green-500 text-green-700'
    if (reliability >= 0.6) return 'border-yellow-500 text-yellow-700'
    return 'border-red-500 text-red-700'
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'pos': return 'border-green-500 text-green-700 bg-green-50'
      case 'neg': return 'border-red-500 text-red-700 bg-red-50'
      case 'neu': return 'border-blue-500 text-blue-700 bg-blue-50'
      default: return 'border-gray-300 text-gray-600'
    }
  }

  const getBiasColor = (leaning?: string) => {
    switch (leaning) {
      case 'left': return 'border-blue-500 text-blue-700 bg-blue-50'
      case 'right': return 'border-red-500 text-red-700 bg-red-50'
      case 'center': return 'border-green-500 text-green-700 bg-green-50'
      default: return 'border-gray-300 text-gray-600'
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Fact-checking Claims Section */}
      {claims.length > 0 && (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <Collapsible open={expandedClaims} onOpenChange={setExpandedClaims}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-800">
                      Fact-checking Results ({claims.length} claims analyzed)
                    </span>
                  </div>
                  {expandedClaims ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-3">
                  {claims.map((claim, idx) => (
                    <div key={idx} className="p-3 border border-purple-200 rounded bg-purple-50/30">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {claim.status === 'verified' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {claim.status === 'disputed' && <XCircle className="w-4 h-4 text-red-600" />}
                          {claim.status === 'unverified' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 mb-1">{claim.claim}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Badge variant="outline" className={`text-xs ${
                              claim.status === 'verified' ? 'border-green-500 text-green-700' :
                              claim.status === 'disputed' ? 'border-red-500 text-red-700' :
                              'border-yellow-500 text-yellow-700'
                            }`}>
                              {claim.status.toUpperCase()}
                            </Badge>
                            <span>Sources: {claim.sources.map(s => `[${s}]`).join(', ')}</span>
                            <span>Confidence: {Math.round(claim.confidence * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      )}

      {/* Sources Grid */}
      <div className="grid gap-4">
        {sources.map((source) => {
          const isExpanded = expandedSources.has(source.id)
          
          return (
            <Card key={source.id} className="border-2 hover:border-gray-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        <span className="flex items-center gap-1">
                          {getProviderIcon(source.provider)}
                          [{source.id}] {source.provider.toUpperCase()}
                        </span>
                      </Badge>
                      {source.publishedAt && (
                        <Badge variant="outline" className="text-xs border-gray-300">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(source.publishedAt)}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 leading-tight mb-2 line-clamp-2">
                      {source.title}
                    </h3>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {typeof source.reliability === 'number' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`text-xs ${getReliabilityColor(source.reliability)}`}>
                                Reliability: {Math.round(source.reliability * 100)}%
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Domain reliability score based on source credibility</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {source.sentiment && (
                        <Badge variant="outline" className={`text-xs ${getSentimentColor(source.sentiment)}`}>
                          {source.sentiment.toUpperCase()}
                        </Badge>
                      )}
                      
                      {source.bias && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={`text-xs ${getBiasColor(source.bias.leaning)}`}>
                                {source.bias.leaning.toUpperCase()}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Political leaning: {source.bias.leaning}</p>
                              {source.bias.strength && <p className="text-xs">Strength: {source.bias.strength}/10</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    
                    {source.authors && source.authors.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                        <User className="w-3 h-3" />
                        <span>{source.authors.slice(0, 3).join(', ')}</span>
                        {source.authors.length > 3 && <span>+{source.authors.length - 3} more</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSource(source.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(source.url, '_blank')}
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <Collapsible open={isExpanded} onOpenChange={() => toggleSource(source.id)}>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Summary/Snippet */}
                    {(source.summary || source.snippet) && (
                      <div className="mb-4 p-3 bg-gray-50 rounded border">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {source.summary || source.snippet}
                        </p>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {onFollowUp && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onFollowUp(source.id, `Tell me more about "${source.title}"`)}
                          className="h-8 text-xs"
                        >
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Follow-up Question
                        </Button>
                      )}
                      
                      {onDeepDive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeepDive(source.id)}
                          className="h-8 text-xs"
                        >
                          <Search className="w-3 h-3 mr-1" />
                          Deep Dive
                        </Button>
                      )}
                      
                      {onCrossReference && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCrossReference(source.id)}
                          className="h-8 text-xs"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Cross-reference
                        </Button>
                      )}
                      
                      {onExportCitation && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onExportCitation(source.id, 'apa')}
                            className="h-8 text-xs"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            APA
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onExportCitation(source.id, 'bibtex')}
                            className="h-8 text-xs"
                          >
                            BibTeX
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Full URL */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 break-all font-mono">
                        {source.url}
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

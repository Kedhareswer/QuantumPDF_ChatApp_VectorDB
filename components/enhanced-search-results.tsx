"use client"

import React, { useEffect, useState } from 'react'
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
  FileText,
  Github,
  Microscope,
  GraduationCap,
  Dna,
  Heart,
  Library,
  Building2,
  Link,
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown
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
  onBookmarkToggle?: (sourceId: number, bookmarked: boolean) => void
  onCredibilityVote?: (sourceId: number, vote: 'up' | 'down', newScore: number) => void
  initialBookmarks?: number[]
  initialVotes?: Record<number, number>
}

export function EnhancedSearchResults({
  sources,
  claims = [],
  onFollowUp,
  onDeepDive,
  onCrossReference,
  onExportCitation,
  onBookmarkToggle,
  onCredibilityVote,
  initialBookmarks = [],
  initialVotes = {}
}: EnhancedSearchResultsProps) {
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())
  const [expandedClaims, setExpandedClaims] = useState(false)
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set(initialBookmarks))
  const [votes, setVotes] = useState<Record<number, number>>({ ...initialVotes })
  const [bookmarksOnly, setBookmarksOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'default'|'date_desc'|'reliability_desc'|'votes_desc'>('default')

  // Persist to localStorage
  useEffect(() => {
    try {
      const savedB = localStorage.getItem('qpdf_bookmarks')
      const savedV = localStorage.getItem('qpdf_votes')
      if (savedB) {
        const arr: number[] = JSON.parse(savedB)
        if (Array.isArray(arr)) setBookmarked(new Set(arr))
      }
      if (savedV) {
        const obj = JSON.parse(savedV)
        if (obj && typeof obj === 'object') setVotes(obj)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('qpdf_bookmarks', JSON.stringify(Array.from(bookmarked)))
    } catch {}
  }, [bookmarked])

  useEffect(() => {
    try {
      localStorage.setItem('qpdf_votes', JSON.stringify(votes))
    } catch {}
  }, [votes])

  const toggleSource = (id: number) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedSources(newExpanded)
  }

  const formatYear = (dateStr?: string) => {
    if (!dateStr) return ''
    try { return new Date(dateStr).getFullYear().toString() } catch { return '' }
  }

  const formatAuthors = (authors?: string[]) => {
    if (!authors || authors.length === 0) return ''
    const first = authors[0]
    const etal = authors.length > 1 ? ' et al.' : ''
    return `${first}${etal}`
  }

  const makeCitation = (s: SourceItem, style: 'apa' | 'mla' | 'bibtex') => {
    const year = formatYear(s.publishedAt)
    const authors = formatAuthors(s.authors)
    if (style === 'bibtex') {
      const key = `${(s.authors?.[0] || 'unknown').split(' ')[0] || 'ref'}${year || 'noyear'}`.replace(/[^a-zA-Z0-9]/g, '')
      return `@article{${key},\n  title={${s.title}},\n  author={${(s.authors || []).join(' and ')}},\n  year={${year || 'n.d.'}},\n  url={${s.url}}\n}`
    }
    if (style === 'mla') {
      return `${authors ? authors + '. ' : ''}"${s.title}." ${s.provider}, ${year || 'n.d.'}. ${s.url}`
    }
    // apa
    return `${authors ? authors + ' ' : ''}(${year || 'n.d.'}). ${s.title}. ${s.provider}. ${s.url}`
  }

  const copyCitation = async (s: SourceItem, style: 'apa' | 'mla' | 'bibtex') => {
    try {
      await navigator.clipboard.writeText(makeCitation(s, style))
    } catch {}
  }

  const toggleBookmark = (id: number) => {
    const next = new Set(bookmarked)
    let now = false
    if (next.has(id)) { next.delete(id); now = false } else { next.add(id); now = true }
    setBookmarked(next)
    onBookmarkToggle?.(id, now)
  }

  const castVote = (id: number, delta: 1 | -1) => {
    const current = votes[id] || 0
    const nextScore = current + delta
    setVotes(prev => ({ ...prev, [id]: nextScore }))
    onCredibilityVote?.(id, delta === 1 ? 'up' : 'down', nextScore)
  }

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'arxiv': return <BookOpen className="w-4 h-4" />
      case 'openalex': return <Library className="w-4 h-4" />
      case 'semanticscholar': return <GraduationCap className="w-4 h-4" />
      case 'pubmed': return <Microscope className="w-4 h-4" />
      case 'biorxiv': return <Dna className="w-4 h-4" />
      case 'medrxiv': return <Heart className="w-4 h-4" />
      case 'doaj': return <Library className="w-4 h-4" />
      case 'crossref': return <Link className="w-4 h-4" />
      case 'ssrn': return <Building2 className="w-4 h-4" />
      case 'links': return <ExternalLink className="w-4 h-4" />
      case 'local': return <FileText className="w-4 h-4" />
      case 'github': return <Github className="w-4 h-4" />
      case 'reddit': return <MessageSquare className="w-4 h-4" />
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

  // Derived list: filter by bookmarks and sort
  const filtered = sources.filter(s => (bookmarksOnly ? bookmarked.has(s.id) : true))
  const view = [...filtered].sort((a, b) => {
    if (sortBy === 'date_desc') {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      return tb - ta
    }
    if (sortBy === 'reliability_desc') {
      const ra = typeof a.reliability === 'number' ? a.reliability : 0
      const rb = typeof b.reliability === 'number' ? b.reliability : 0
      return rb - ra
    }
    if (sortBy === 'votes_desc') {
      const va = votes[a.id] || 0
      const vb = votes[b.id] || 0
      return vb - va
    }
    return 0
  })

  const exportBookmarkedBibtex = async () => {
    try {
      const list = sources.filter(s => bookmarked.has(s.id))
      const bib = list.map(s => makeCitation(s, 'bibtex')).join('\n\n')
      if (bib) await navigator.clipboard.writeText(bib)
    } catch {}
  }

  const copyViewUrls = async () => {
    try {
      const txt = view.map(s => s.url).join('\n')
      if (txt) await navigator.clipboard.writeText(txt)
    } catch {}
  }

  const copyViewMarkdown = async () => {
    try {
      const md = view.map(s => `[#${s.id}] ${s.title} - ${s.url}`).join('\n')
      if (md) await navigator.clipboard.writeText(md)
    } catch {}
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
      <div>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Button variant={bookmarksOnly ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setBookmarksOnly(v => !v)}>
              {bookmarksOnly ? 'Bookmarked Only' : 'All Sources'}
            </Button>
            <Button variant="outline" className="h-8 text-xs" onClick={exportBookmarkedBibtex} disabled={bookmarked.size === 0}>
              Export Bookmarked (BibTeX)
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="default">Default</option>
              <option value="date_desc">Date (newest)</option>
              <option value="reliability_desc">Reliability (high→low)</option>
              <option value="votes_desc">Credibility (high→low)</option>
            </select>
            <Button variant="outline" className="h-8 text-xs" onClick={copyViewUrls}>
              Copy URLs
            </Button>
            <Button variant="outline" className="h-8 text-xs" onClick={copyViewMarkdown}>
              Copy Markdown refs
            </Button>
          </div>
        </div>
        <div className="grid gap-4">
        {view.map((source) => {
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
                    
                    {/* Bookmark / Pin */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleBookmark(source.id)}
                      className="h-8 w-8 p-0"
                      aria-label={bookmarked.has(source.id) ? 'Unbookmark' : 'Bookmark'}
                    >
                      {bookmarked.has(source.id) ? <BookmarkCheck className="w-4 h-4 text-green-600" /> : <Bookmark className="w-4 h-4" />}
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
                      
                      {/* Credibility voting */}
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => castVote(source.id, 1)} aria-label="Upvote credibility">
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <span className="text-xs min-w-[1.5rem] text-center">{votes[source.id] || 0}</span>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => castVote(source.id, -1)} aria-label="Downvote credibility">
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Citations export (fallback to copy if no handler) */}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onExportCitation ? onExportCitation(source.id, 'apa') : copyCitation(source, 'apa')}
                          className="h-8 text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          APA
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onExportCitation ? onExportCitation(source.id, 'bibtex') : copyCitation(source, 'bibtex')}
                          className="h-8 text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          BibTeX
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onExportCitation ? onExportCitation(source.id, 'mla') : copyCitation(source, 'mla')}
                          className="h-8 text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          MLA
                        </Button>
                      </div>
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
    </div>
  )
}

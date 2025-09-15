"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Globe,
  Download,
  Upload,
  Lightbulb,
  Info
} from 'lucide-react'

interface URLGuidanceProps {
  detectedUrls?: string[]
  errorMessage?: string
  onRetry?: () => void
  className?: string
}

export function URLGuidance({ detectedUrls = [], errorMessage, onRetry, className }: URLGuidanceProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getUrlType = (url: string) => {
    if (url.includes('arxiv.org')) return 'arXiv Paper'
    if (url.includes('.pdf')) return 'PDF Document'
    if (url.includes('pubmed') || url.includes('ncbi.nlm.nih.gov')) return 'PubMed Article'
    if (url.includes('github.com')) return 'GitHub Repository'
    return 'Web Page'
  }

  const getUrlIcon = (url: string) => {
    if (url.includes('arxiv.org')) return <FileText className="w-4 h-4" />
    if (url.includes('.pdf')) return <FileText className="w-4 h-4" />
    if (url.includes('pubmed')) return <FileText className="w-4 h-4" />
    if (url.includes('github.com')) return <Globe className="w-4 h-4" />
    return <Globe className="w-4 h-4" />
  }

  const getSuggestions = (url: string) => {
    if (url.includes('arxiv.org')) {
      return [
        'The abstract and metadata will be automatically extracted',
        'For full content analysis, download and upload the PDF',
        'arXiv papers are processed with enhanced metadata extraction'
      ]
    }
    if (url.includes('.pdf')) {
      return [
        'PDF content extraction is available but limited',
        'For best results, download and upload the PDF directly',
        'Large PDFs may have processing timeouts'
      ]
    }
    return [
      'Web page content will be extracted automatically',
      'JavaScript-heavy pages may not be fully processed',
      'Consider providing specific excerpts for complex pages'
    ]
  }

  if (!detectedUrls.length && !errorMessage) {
    return null
  }

  return (
    <Card className={`border-blue-200 bg-blue-50/30 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-sm font-medium text-blue-800">
              URL Processing Guide
            </CardTitle>
          </div>
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {errorMessage && (
              <div className="mb-4 p-3 border border-red-200 rounded bg-red-50">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium mb-1">Processing Error</p>
                    <p className="text-sm text-red-700">{errorMessage}</p>
                    {onRetry && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={onRetry}
                        className="mt-2 h-7 text-xs border-red-300 text-red-700 hover:bg-red-100"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detectedUrls.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Detected {detectedUrls.length} URL{detectedUrls.length > 1 ? 's' : ''}
                  </span>
                </div>

                {detectedUrls.map((url, index) => (
                  <div key={index} className="border border-gray-200 rounded p-3 bg-white">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getUrlIcon(url)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {getUrlType(url)}
                          </Badge>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-sm text-gray-600 break-all mb-2 font-mono">
                          {url}
                        </p>
                        <div className="space-y-1">
                          {getSuggestions(url).map((suggestion, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Lightbulb className="w-3 h-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-700">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 border border-gray-200 rounded bg-gray-50">
              <div className="flex items-start gap-2 mb-2">
                <Info className="w-4 h-4 text-gray-600 mt-0.5" />
                <span className="text-sm font-medium text-gray-800">Best Practices</span>
              </div>
              <ul className="text-xs text-gray-700 space-y-1 ml-6">
                <li>• For research papers, include the full URL (arXiv, PubMed, etc.)</li>
                <li>• For PDFs, consider uploading directly for better processing</li>
                <li>• Provide context about what specific information you're looking for</li>
                <li>• If a URL fails, try providing key excerpts or quotes instead</li>
              </ul>
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Upload className="w-3 h-3 mr-1" />
                Upload PDF Instead
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" />
                Download & Upload
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// Hook for detecting URLs in text
export function useURLDetection(text: string) {
  const urlRegex = /https?:\/\/[^\s]+/gi
  const detectedUrls = text.match(urlRegex) || []
  
  return {
    hasUrls: detectedUrls.length > 0,
    urls: Array.from(new Set(detectedUrls)), // Remove duplicates
    urlCount: detectedUrls.length
  }
}

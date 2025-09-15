"use client"

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface SearchAnalyticsProps {
  providerCounts?: Record<string, number>
  domainCoverage?: string[]
  sources?: Array<{ publishedAt?: string; title: string; snippet?: string }>
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function computeTimelineLast12Months(sources?: Array<{ publishedAt?: string }>) {
  if (!sources || sources.length === 0) return { order: [], counts: {} as Record<string, number> }
  const now = new Date()
  const order: string[] = []
  const counts: Record<string, number> = {}
  for (let i=11; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    const key = monthKey(d)
    order.push(key)
    counts[key] = 0
  }
  sources.forEach(s => {
    if (!s.publishedAt) return
    const t = new Date(s.publishedAt)
    if (Number.isNaN(t.getTime())) return
    const key = monthKey(new Date(t.getFullYear(), t.getMonth(), 1))
    if (key in counts) counts[key] += 1
  })
  return { order, counts }
}

function computeTopicFrequency(sources?: Array<{ title: string; snippet?: string }>) {
  if (!sources || sources.length === 0) return [] as Array<[string, number]>
  const vocab: Record<string, string[]> = {
    'Diagnostics': ['diagnostic', 'diagnosis', 'imaging'],
    'Treatment': ['treatment', 'therapy', 'therapeutic'],
    'Patient Care': ['monitoring', 'patient care', 'clinical'],
    'Drug Discovery': ['drug', 'pharmaceutical', 'medication'],
    'Prediction': ['prediction', 'prognosis', 'risk'],
    'Clinical Support': ['workflow', 'decision support', 'clinical decision'],
    'Computer Vision': ['computer vision', 'image'],
    'NLP': ['natural language processing', 'nlp', 'text'],
    'Deep Learning': ['deep learning', 'neural network'],
    'Dataset/Benchmark': ['dataset', 'benchmark', 'corpus']
  }
  const counts: Record<string, number> = {}
  const lc = (s: string) => s.toLowerCase()
  sources.forEach(s => {
    const text = lc(`${s.title} ${s.snippet || ''}`)
    Object.entries(vocab).forEach(([label, terms]) => {
      if (terms.some(t => text.includes(t))) counts[label] = (counts[label] || 0) + 1
    })
  })
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6)
}

export function SearchAnalytics({ providerCounts, domainCoverage, sources }: SearchAnalyticsProps) {
  if (!providerCounts && !domainCoverage) return null
  const entries = Object.entries(providerCounts || {})
  const total = entries.reduce((a, [,v]) => a + v, 0)
  const timeline = computeTimelineLast12Months(sources)
  const topics = computeTopicFrequency(sources)

  return (
    <Card className="mt-3 border-2 border-blue-200">
      <CardHeader>
        <div className="text-sm font-semibold text-blue-800">Search Analytics</div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Publication Timeline (last 12 months) */}
        {timeline.order.length > 0 && (
          <div>
            <div className="text-xs text-gray-700 mb-2">Publication timeline (12 months)</div>
            <div className="flex items-end gap-1 h-12">
              {timeline.order.map((k) => {
                const val = timeline.counts[k] || 0
                const max = Math.max(1, ...Object.values(timeline.counts))
                const pct = Math.round((val / max) * 100)
                return <div key={k} title={`${k}: ${val}`} className="w-3 bg-blue-300 border border-blue-400" style={{ height: `${Math.max(2, Math.round(pct*0.96))}%` }} />
              })}
            </div>
          </div>
        )}
        {entries.length > 0 && (
          <div>
            <div className="text-xs text-gray-700 mb-2">Source distribution</div>
            <div className="space-y-1">
              {entries.sort((a,b)=>b[1]-a[1]).map(([prov, count]) => {
                const pct = total ? Math.round((count/total)*100) : 0
                return (
                  <div key={prov} className="flex items-center gap-2">
                    <div className="w-24 text-xs text-gray-600 capitalize">{prov}</div>
                    <div className="flex-1 h-3 bg-gray-100 rounded border border-gray-200">
                      <div className="h-3 bg-blue-400 rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-10 text-xs text-gray-700 text-right">{pct}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {domainCoverage && domainCoverage.length > 0 && (
          <div>
            <div className="text-xs text-gray-700 mb-2">Detected topics</div>
            <div className="flex flex-wrap gap-2">
              {domainCoverage.map((topic) => (
                <Badge key={topic} variant="outline" className="text-xs border-2 border-purple-300 text-purple-800 bg-purple-50">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {topics.length > 0 && (
          <div>
            <div className="text-xs text-gray-700 mb-2">Topic frequency</div>
            <div className="space-y-1">
              {topics.map(([label, count]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-40 text-xs text-gray-600 truncate">{label}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded">
                    <div className="h-2 bg-purple-400 rounded" style={{ width: `${Math.min(100, count * 10)}%` }} />
                  </div>
                  <div className="w-6 text-xs text-gray-700 text-right">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

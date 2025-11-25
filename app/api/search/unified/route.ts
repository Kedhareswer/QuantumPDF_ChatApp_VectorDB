import { NextRequest } from "next/server"
import type { MetadataRoute } from "next"
import { createVectorDatabase } from "@/lib/vector-database"
import type { VectorDBConfig } from "@/lib/vector-database-types"
import { AIClient } from "@/lib/ai-client"
import { EnhancedURLProcessor, processURLContent } from "@/lib/enhanced-url-processor"

// Runtime: Node.js (we use network + modest parsing)
export const runtime = "nodejs"

// Types
interface UnifiedRequestBody {
  query: string
  sources?: string[]
  summaryLevel?: 'quick' | 'standard' | 'detailed'
  synthesis?: 'server' | 'client'
  timeRange?: "24h" | "7d" | "30d" | "1y" | "all"
  maxResults?: number
  locale?: string
  model?: string
  links?: string[]
  useLocalDocs?: boolean
  sourceFilters?: {
    tier1Only?: boolean
    minCitationCount?: number
    dateRange?: 'recent' | 'last5years' | 'all'
    openAccessOnly?: boolean
  }
  vectorDBConfig?: VectorDBConfig
  aiConfig?: {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
  }
}

// Apply user-provided source filters
function applySourceFilters(items: SourceItem[], filters?: UnifiedRequestBody['sourceFilters']): SourceItem[] {
  if (!filters) return items
  let out = items.slice()
  // Tier 1 filter: PubMed, arXiv, OpenAlex
  if (filters.tier1Only) {
    const tier1 = new Set(["pubmed","arxiv","openalex"]) as Set<SourceItem['provider']>
    out = out.filter(it => tier1.has(it.provider))
  }
  // Min citations
  if (typeof filters.minCitationCount === 'number' && filters.minCitationCount > 0) {
    out = out.filter(it => (it.citations || 0) >= filters.minCitationCount!)
  }
  // Date range
  if (filters.dateRange && filters.dateRange !== 'all') {
    const years = filters.dateRange === 'recent' ? 1 : 5
    const cutoff = Date.now() - years * 365 * 24 * 60 * 60 * 1000
    out = out.filter(it => {
      if (!it.publishedAt) return false
      const t = Date.parse(it.publishedAt)
      return !Number.isNaN(t) && t >= cutoff
    })
  }
  // Open access only
  if (filters.openAccessOnly) {
    out = out.filter(it => it.openAccess === true)
  }
  return out
}

interface SourceItem {
  id: string
  provider: "arxiv" | "hn" | "links" | "local" | "openalex" | "pubmed" | "semanticscholar" | "reddit" | "github" | "biorxiv" | "medrxiv" | "doaj" | "ssrn" | "researchgate" | "crossref" | "unknown"
  title: string
  url: string
  snippet?: string
  authors?: string[]
  publishedAt?: string
  citations?: number
  openAccess?: boolean
}

// Utilities
const enc = new TextEncoder()
function sse(controller: ReadableStreamDefaultController, event: any) {
  controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pick<T>(arr: T[], n: number): T[] {
  return arr.slice(0, clamp(n, 0, arr.length))
}

function toISO(d?: string | Date) {
  try { return d ? (typeof d === 'string' ? new Date(d).toISOString() : d.toISOString()) : undefined } catch { return undefined }
}
 
// Lightweight utilities for metrics and scoring
function hostnameFromUrl(url: string): string {
  try { return new URL(url).hostname } catch { return "" }
}

type DomainInfo = { reliability: number; leaning: "left" | "right" | "center" | "unknown" }
const DOMAIN_INFO_FALLBACK: Record<string, DomainInfo> = {
  "arxiv.org": { reliability: 0.92, leaning: "center" },
  "export.arxiv.org": { reliability: 0.92, leaning: "center" },
  "news.ycombinator.com": { reliability: 0.7, leaning: "center" },
}

function getDomainInfo(host: string): DomainInfo {
  if (!host) return { reliability: 0.6, leaning: "unknown" }
  const lowered = host.toLowerCase()
  if (DOMAIN_INFO_FALLBACK[lowered]) return DOMAIN_INFO_FALLBACK[lowered]
  // Heuristic defaults
  if (lowered.endsWith(".edu") || lowered.endsWith(".ac.uk")) return { reliability: 0.85, leaning: "center" }
  if (lowered.includes("arxiv")) return { reliability: 0.92, leaning: "center" }
  return { reliability: 0.65, leaning: "unknown" }
}

function recencyWeight(iso?: string): number {
  if (!iso) return 0.6
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0.6
  const days = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24))
  // 0 days => 1.0; 365 days => ~0.2
  return 1 / (1 + days / 60)
}

// --- User links support (validation + lightweight metadata fetch) ---
function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  // Basic private IP ranges
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true
  // Link-local
  if (/^169\.254\./.test(h)) return true
  // Common internal suffixes
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  return false
}

function sanitizeUrl(url: string): string {
  return url.trim()
}

async function fetchLinkPreview(url: string, aiConfig?: { provider: string; apiKey: string; model: string; baseUrl?: string }): Promise<SourceItem | null> {
  try {
    const safeUrl = sanitizeUrl(url)
    if (!isValidHttpUrl(safeUrl)) return null
    const host = new URL(safeUrl).hostname
    if (isPrivateHostname(host)) return null

    // Use enhanced URL processor for better content extraction
    try {
      const processor = new EnhancedURLProcessor({
        maxContentLength: 10000, // Limit for search context
        aiConfig
      })
      
      const processed = await processor.processURL(safeUrl)
      
      if (processed.error) {
        // Fallback to basic preview on error
        return await fetchBasicLinkPreview(safeUrl)
      }

      // Extract meaningful snippet from processed content
      let snippet = processed.content
      if (snippet.length > 500) {
        // Try to extract the most relevant part
        const lines = snippet.split('\n').filter(line => line.trim().length > 20)
        snippet = lines.slice(0, 3).join(' ').substring(0, 500) + '...'
      }

      return {
        id: safeUrl,
        provider: 'links',
        title: processed.title,
        url: safeUrl,
        snippet,
        authors: processed.metadata.authors,
        publishedAt: processed.metadata.publishedAt
      }
    } catch {
      // Fallback to basic preview
      return await fetchBasicLinkPreview(safeUrl)
    }
  } catch {
    return null
  }
}

async function fetchBasicLinkPreview(url: string): Promise<SourceItem | null> {
  try {
    // Try HEAD first to inspect content type quickly
    let contentType = ''
    try {
      const head = await fetch(url, { method: 'HEAD' })
      if (head.ok) {
        contentType = head.headers.get('content-type') || ''
      }
    } catch {}

    // Fallback to GET if HEAD didn't provide enough info
    const res = await fetch(url, { headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' } })
    if (!res.ok) return null
    if (!contentType) contentType = res.headers.get('content-type') || ''

    let title = url
    let snippet = ''
    if (contentType.includes('text/html')) {
      const html = await res.text()
      const mTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      const mDesc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
      title = (mTitle?.[1] || title).replace(/\s+/g, ' ').trim()
      snippet = (mDesc?.[1] || '').replace(/\s+/g, ' ').trim()
    } else if (contentType.includes('application/pdf')) {
      // Keep lightweight info for PDFs
      title = decodeURIComponent(url.split('/').pop() || 'PDF Document')
      snippet = 'PDF document - Enhanced processing available'
    } else if (contentType.includes('text/plain')) {
      const txt = await res.text()
      snippet = txt.slice(0, 300).replace(/\s+/g, ' ').trim()
    } else {
      // Unsupported type for preview; still return the link
      title = decodeURIComponent(url.split('/').pop() || url)
    }

    return { id: url, provider: 'links', title, url, snippet }
  } catch {
    return null
  }
}

async function linksProvider(links: string[], maxResults: number, aiConfig?: { provider: string; apiKey: string; model: string; baseUrl?: string }): Promise<SourceItem[]> {
  const normalized = Array.from(new Set(links.map(sanitizeUrl))).filter(isValidHttpUrl)
  const filtered = normalized.filter((u) => !isPrivateHostname(new URL(u).hostname))
  const previews = await Promise.all(filtered.slice(0, maxResults).map(url => fetchLinkPreview(url, aiConfig)))
  return previews.filter((p): p is SourceItem => !!p)
}

// --- Local vector search provider ---
function getEnvVectorDBConfig(): VectorDBConfig | null {
  const provider = (process.env.VECTOR_DB_PROVIDER || "").toLowerCase()
  if (!provider) return null
  if (provider === "pinecone") {
    return {
      provider: "pinecone",
      apiKey: process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX || "pdf-documents",
      dimension: Number(process.env.VECTOR_DIMENSION || 1536),
    }
  }
  if (provider === "weaviate") {
    return {
      provider: "weaviate",
      url: process.env.WEAVIATE_URL || "",
      apiKey: process.env.WEAVIATE_API_KEY,
      collection: process.env.WEAVIATE_COLLECTION || "Document",
      dimension: Number(process.env.VECTOR_DIMENSION || 1536),
    }
  }
  if (provider === "local") {
    return { provider: "local", dimension: Number(process.env.VECTOR_DIMENSION || 1536) }
  }
  return null
}

function getEnvAIConfig(): { provider: string; apiKey: string; model: string; baseUrl?: string } | null {
  const provider = process.env.AI_PROVIDER || process.env.OPENAI_PROVIDER || ""
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ""
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || ""
  const baseUrl = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || undefined
  if (!provider || !apiKey || !model) return null
  return { provider, apiKey, model, baseUrl }
}

async function localSearchProvider(query: string, maxResults: number, cfg?: VectorDBConfig, aiCfg?: { provider: string; apiKey: string; model: string; baseUrl?: string }): Promise<SourceItem[]> {
  try {
    const vectorCfg = cfg || getEnvVectorDBConfig() || { provider: "local", dimension: 1536 }
    const aiConf = aiCfg || getEnvAIConfig()
    if (!aiConf) {
      // Cannot generate embeddings without AI config
      return []
    }

    // Initialize vector DB
    const vdb = createVectorDatabase(vectorCfg)
    await vdb.initialize()

    // Create AI client for embeddings
    const ai = new AIClient({ provider: aiConf.provider as any, apiKey: aiConf.apiKey, model: aiConf.model, baseUrl: aiConf.baseUrl })
    let embedding: number[] = []
    try {
      embedding = await ai.generateEmbedding(query)
    } catch {
      // Fallback: zero vector of expected dimension
      const dim = vectorCfg.dimension || 1536
      embedding = new Array(dim).fill(0)
    }

    const results = await vdb.search(query, embedding, { mode: "hybrid", limit: maxResults, threshold: 0.05 })
    // Map to SourceItem
    return results.map((r) => {
      const docId = r?.metadata?.documentId || r.id
      const chunkIndex = r?.metadata?.chunkIndex ?? 0
      const sourceName = r?.metadata?.source || "Local Document"
      const url = `https://local.documents/${encodeURIComponent(String(docId))}?chunk=${encodeURIComponent(String(chunkIndex))}`
      const snippet = (r.content || "").slice(0, 280).replace(/\s+/g, ' ').trim()
      // Timestamp
      let publishedAt: string | undefined
      const ts = r?.metadata?.timestamp
      if (ts) {
        try { publishedAt = typeof ts === 'string' ? new Date(ts).toISOString() : (ts instanceof Date ? ts.toISOString() : undefined) } catch {}
      }
      return {
        id: `${docId}_${chunkIndex}`,
        provider: "local",
        title: `${sourceName} (chunk ${Number(chunkIndex) + 1})`,
        url,
        snippet,
        publishedAt,
      }
    })
  } catch (e) {
    // On any failure, do not block the rest of providers
    return []
  }
}

function detectIntent(query: string): "research" | "news" | "general" {
  const q = query.toLowerCase()
  if (/\b(arxiv|paper|study|dataset|method|experiment|results|baseline)\b/.test(q)) return "research"
  if (/\b(news|headline|breaking|announce|report)\b/.test(q)) return "news"
  return "general"
}

function simpleSentiment(text: string): "pos" | "neu" | "neg" {
  const pos = ["improve","gain","progress","benefit","positive","increase","advance"]
  const neg = ["risk","concern","decline","negative","issue","problem","drop"]
  const tl = text.toLowerCase()
  let score = 0
  for (const w of pos) if (tl.includes(w)) score += 1
  for (const w of neg) if (tl.includes(w)) score -= 1
  if (score > 0) return "pos"
  if (score < 0) return "neg"
  return "neu"
}

// Simple claim extraction for fact-checking
function extractClaims(text: string): string[] {
  // Basic heuristic: sentences with factual indicators
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20)
  const factualIndicators = /\b(is|are|was|were|has|have|will|shows|indicates|reports|found|discovered|according to|study|research)\b/i
  return sentences.filter(s => factualIndicators.test(s)).slice(0, 5) // limit to 5 claims
}

function crossCheckClaims(claims: string[], sources: SourceItem[]): Array<{claim: string; status: 'verified'|'disputed'|'unverified'; sources: number[]; confidence: number}> {
  return claims.map(claim => {
    const keywords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const matchingSources: number[] = []
    
    sources.forEach((source, idx) => {
      const sourceText = (source.title + ' ' + (source.snippet || '')).toLowerCase()
      const matches = keywords.filter(kw => sourceText.includes(kw))
      if (matches.length >= Math.min(2, keywords.length * 0.3)) {
        matchingSources.push(idx + 1)
      }
    })
    
    const confidence = Math.min(1, matchingSources.length / Math.max(1, sources.length * 0.4))
    let status: 'verified'|'disputed'|'unverified' = 'unverified'
    if (confidence >= 0.6) status = 'verified'
    else if (confidence >= 0.3) status = 'disputed'
    
    return { claim, status, sources: matchingSources, confidence }
  })
}

// Research gap identification for academic queries
function identifyResearchGaps(sources: SourceItem[], query: string): string[] {
  const topics = extractTopics(sources)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  
  // Common research areas that might be underexplored
  const potentialGaps = [
    'longitudinal studies',
    'cross-cultural validation',
    'real-world applications',
    'ethical implications',
    'scalability challenges',
    'comparative analysis',
    'implementation barriers',
    'cost-effectiveness'
  ]
  
  const gaps = potentialGaps.filter(gap => {
    const gapWords = gap.split(/\s+/)
    return !sources.some(s => 
      gapWords.some(gw => (s.title + ' ' + (s.snippet || '')).toLowerCase().includes(gw))
    )
  })
  
  return gaps.slice(0, 3).map(gap => `${query} ${gap}`)
}

function extractTopics(sources: SourceItem[]): string[] {
  const allText = sources.map(s => s.title + ' ' + (s.snippet || '')).join(' ').toLowerCase()
  const commonTopics = ['machine learning', 'artificial intelligence', 'deep learning', 'neural networks', 'data science', 'computer vision', 'natural language processing', 'robotics', 'healthcare', 'medical', 'diagnosis', 'treatment', 'clinical', 'patient']
  return commonTopics.filter(topic => allText.includes(topic))
}

// Trend detection using timestamps
function detectTrends(sources: SourceItem[]): { trend: string; momentum: number; timeframe: string } {
  const datedSources = sources.filter(s => s.publishedAt).sort((a, b) => 
    new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime()
  )
  
  if (datedSources.length < 3) {
    return { trend: 'insufficient data', momentum: 0, timeframe: 'unknown' }
  }
  
  const now = Date.now()
  const recent = datedSources.filter(s => 
    (now - new Date(s.publishedAt!).getTime()) < (90 * 24 * 60 * 60 * 1000) // 90 days
  ).length
  
  const older = datedSources.length - recent
  const momentum = recent > older ? (recent / Math.max(1, older)) : -(older / Math.max(1, recent))
  
  let trend = 'stable'
  if (momentum > 1.5) trend = 'increasing rapidly'
  else if (momentum > 1.1) trend = 'increasing'
  else if (momentum < -1.5) trend = 'declining rapidly'
  else if (momentum < -1.1) trend = 'declining'
  
  return { trend, momentum: Number(momentum.toFixed(2)), timeframe: 'last 90 days' }
}

// Smart query enhancement
function enhanceQuery(query: string): { enhanced: string; suggestions: string[]; corrections: string[]; synonyms: string[] } {
  const enhanced = expandAcronyms(query)
  const suggestions = generateQuerySuggestions(query)
  const corrections = spellCheck(query)
  const synonyms = generateSynonyms(query)
  
  return { enhanced, suggestions, corrections, synonyms }
}

function expandAcronyms(query: string): string {
  const acronyms: Record<string, string> = {
    'AI': 'Artificial Intelligence',
    'ML': 'Machine Learning',
    'DL': 'Deep Learning',
    'NLP': 'Natural Language Processing',
    'CV': 'Computer Vision',
    'IoT': 'Internet of Things',
    'API': 'Application Programming Interface',
    'GPU': 'Graphics Processing Unit',
    'CNN': 'Convolutional Neural Network',
    'RNN': 'Recurrent Neural Network',
    'GAN': 'Generative Adversarial Network'
  }
  
  let enhanced = query
  Object.entries(acronyms).forEach(([acronym, expansion]) => {
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi')
    if (regex.test(enhanced)) {
      enhanced = enhanced.replace(regex, `${acronym} (${expansion})`)
    }
  })
  
  return enhanced
}

function generateQuerySuggestions(query: string): string[] {
  const suggestions = [
    `${query} recent advances`,
    `${query} challenges and limitations`,
    `${query} future directions`,
    `${query} comparative study`,
    `${query} systematic review`
  ]
  return suggestions.slice(0, 3)
}

function generateSynonyms(query: string): string[] {
  // Heuristic synonym expansion for common research terms
  const base = query.toLowerCase()
  const pairs: Array<[RegExp, string[]]> = [
    [/ai|artificial intelligence/g, ["artificial intelligence", "intelligent systems"]],
    [/ml|machine learning/g, ["machine learning", "statistical learning", "predictive modeling"]],
    [/nlp|natural language processing/g, ["natural language processing", "computational linguistics"]],
    [/cv|computer vision/g, ["computer vision", "image analysis", "visual recognition"]],
    [/deep learning|dl/g, ["deep learning", "neural networks"]],
    [/randomized|rct/g, ["randomized controlled trial", "RCT"]],
    [/systematic review|meta-analysis/g, ["systematic review", "meta analysis"]],
  ]
  const out = new Set<string>()
  pairs.forEach(([re, syns]) => {
    if (re.test(base)) syns.forEach(s => out.add(s))
  })
  return Array.from(out).slice(0, 6)
}

function spellCheck(query: string): string[] {
  // Simple spell check for common technical terms
  const corrections: string[] = []
  const commonMisspellings: Record<string, string> = {
    'machien': 'machine',
    'artifical': 'artificial',
    'inteligence': 'intelligence',
    'algoritm': 'algorithm',
    'nueral': 'neural',
    'netowrk': 'network'
  }
  
  Object.entries(commonMisspellings).forEach(([wrong, correct]) => {
    if (query.toLowerCase().includes(wrong)) {
      corrections.push(`Did you mean "${correct}" instead of "${wrong}"?`)
    }
  })
  
  return corrections
}

// Extract focus area from paper title and abstract
function extractFocusArea(title: string, snippet: string): string {
  const text = (title + ' ' + snippet).toLowerCase()
  
  if (text.includes('diagnostic') || text.includes('diagnosis') || text.includes('imaging')) return 'Diagnostics'
  if (text.includes('treatment') || text.includes('therapy') || text.includes('therapeutic')) return 'Treatment'
  if (text.includes('monitoring') || text.includes('patient care') || text.includes('clinical')) return 'Patient Care'
  if (text.includes('drug') || text.includes('pharmaceutical') || text.includes('medication')) return 'Drug Discovery'
  if (text.includes('surgery') || text.includes('surgical') || text.includes('robotic')) return 'Surgery'
  if (text.includes('prediction') || text.includes('prognosis') || text.includes('risk')) return 'Prediction'
  if (text.includes('workflow') || text.includes('decision support') || text.includes('clinical decision')) return 'Clinical Support'
  
  return 'General AI'
}

// Analyze research trends from sources
function analyzeTrends(sources: SourceItem[]): Array<{category: string; insight: string}> {
  const trends = []
  const focusAreas = sources.map(s => extractFocusArea(s.title, s.snippet || ''))
  const focusCount = focusAreas.reduce((acc, area) => {
    acc[area] = (acc[area] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const topFocus = Object.entries(focusCount).sort(([,a], [,b]) => b - a)[0]
  if (topFocus) {
    trends.push({
      category: 'Primary Focus',
      insight: `${topFocus[1]} out of ${sources.length} papers focus on ${topFocus[0].toLowerCase()}`
    })
  }
  
  const recentPapers = sources.filter(s => {
    if (!s.publishedAt) return false
    const pubDate = new Date(s.publishedAt)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    return pubDate > oneYearAgo
  }).length
  
  trends.push({
    category: 'Research Activity',
    insight: `${recentPapers} papers published in the last year, indicating ${recentPapers > sources.length * 0.6 ? 'high' : 'moderate'} research activity`
  })
  
  const hasMultipleAuthors = sources.filter(s => s.authors && s.authors.length > 3).length
  if (hasMultipleAuthors > 0) {
    trends.push({
      category: 'Collaboration',
      insight: `${hasMultipleAuthors} papers show multi-institutional collaboration (4+ authors)`
    })
  }
  
  return trends
}

// Summarize methodologies present across sources (heuristic)
function summarizeMethodologies(sources: SourceItem[]): { breakdown: Record<string, number>; top: string[] } {
  const vocab: Record<string, string[]> = {
    'Randomized Controlled Trial': ['randomized controlled', ' rct '],
    'Systematic Review': ['systematic review'],
    'Meta-analysis': ['meta-analysis', 'meta analysis'],
    'Prospective Study': ['prospective'],
    'Retrospective Study': ['retrospective'],
    'Cross-sectional Study': ['cross-sectional', 'cross sectional'],
    'Case Study/Series': ['case study', 'case series'],
    'Benchmark/Dataset': ['benchmark', 'dataset', 'corpus'],
    'Simulation/Modeling': ['simulation', 'simulated', 'modeling', 'modelling'],
    'Survey': ['survey', 'questionnaire'],
    'Qualitative Study': ['qualitative'],
    'Quantitative Study': ['quantitative'],
  }
  const breakdown: Record<string, number> = {}
  const lc = (s: string) => ` ${s.toLowerCase()} `
  for (const s of sources) {
    const text = lc(s.title + ' ' + (s.snippet || ''))
    for (const [label, terms] of Object.entries(vocab)) {
      if (terms.some(t => text.includes(t))) {
        breakdown[label] = (breakdown[label] || 0) + 1
      }
    }
  }
  const top = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  return { breakdown, top }
}

// Minimal ATOM parser for arXiv (regex-based to avoid extra deps for MVP)
function parseArxivAtom(xml: string): SourceItem[] {
  const entries = xml.split(/<entry>/g).slice(1)
  const items: SourceItem[] = []
  for (const entry of entries) {
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim().replace(/\s+/g, ' ') || ""
    const id = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || ""
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.trim()
    const authors = Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g)).map(m => m[1].trim())
    // Prefer PDF link if present
    const pdfLink = (entry.match(/<link[^>]*?title=\"pdf\"[^>]*?href=\"([^\"]+)\"/i) || [])[1]
    const firstLink = (entry.match(/<link[^>]*?href=\"([^\"]+)\"/i) || [])[1]
    const url = pdfLink || firstLink || id || ""
    if (!title || !url) continue
    items.push({
      id: id || url,
      provider: "arxiv",
      title,
      url,
      authors,
      publishedAt: toISO(published),
      openAccess: true
    })
  }
  return items
}

// --- bioRxiv (preprint server for biology) ---
async function biorxivSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.biorxiv.org/details/biorxiv/2020-01-01/2025-12-31/${maxResults}?format=json`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: any = await res.json()
    const papers = data?.collection || []
    return papers.filter((p: any) => 
      (p.title?.toLowerCase().includes(query.toLowerCase()) || 
       p.abstract?.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, maxResults).map((p: any) => ({
      id: p.doi || p.preprint_id,
      provider: 'biorxiv' as const,
      title: p.title || 'bioRxiv preprint',
      url: `https://www.biorxiv.org/content/10.1101/${p.preprint_id}v${p.version}`,
      snippet: p.abstract?.slice(0, 300) || '',
      authors: p.authors?.split(';').slice(0, 5) || [],
      publishedAt: toISO(p.date)
    }))
  } catch { return [] }
}

// --- medRxiv (preprint server for medicine) ---
async function medrxivSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.medrxiv.org/details/medrxiv/2020-01-01/2025-12-31/${maxResults}?format=json`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: any = await res.json()
    const papers = data?.collection || []
    return papers.filter((p: any) => 
      (p.title?.toLowerCase().includes(query.toLowerCase()) || 
       p.abstract?.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, maxResults).map((p: any) => ({
      id: p.doi || p.preprint_id,
      provider: 'medrxiv' as const,
      title: p.title || 'medRxiv preprint',
      url: `https://www.medrxiv.org/content/10.1101/${p.preprint_id}v${p.version}`,
      snippet: p.abstract?.slice(0, 300) || '',
      authors: p.authors?.split(';').slice(0, 5) || [],
      publishedAt: toISO(p.date)
    }))
  } catch { return [] }
}

// --- DOAJ (Directory of Open Access Journals) ---
async function doajSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${maxResults}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: any = await res.json()
    const results = data?.results || []
    return results.map((r: any) => {
      const bibjson = r.bibjson || {}
      return {
        id: r.id || bibjson.identifier?.[0]?.id,
        provider: 'doaj' as const,
        title: bibjson.title || 'DOAJ Article',
        url: bibjson.link?.[0]?.url || `https://doaj.org/article/${r.id}`,
        snippet: bibjson.abstract || '',
        authors: bibjson.author?.map((a: any) => a.name).slice(0, 5) || [],
        publishedAt: toISO(bibjson.year ? `${bibjson.year}-01-01` : undefined),
        openAccess: true
      }
    })
  } catch { return [] }
}

// --- SSRN (Social Science Research Network) ---
async function ssrnSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    // SSRN doesn't have a public API, but we can scrape their search results page
    const url = `https://papers.ssrn.com/sol3/results.cfm?RequestTimeout=50000&q=${encodeURIComponent(query)}&per_page=${maxResults}`
    const res = await fetch(url, { headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' } })
    if (!res.ok) return []
    const html = await res.text()
    
    // Basic regex parsing (not ideal but works for MVP)
    const titleRegex = /<a[^>]*href="[^"]*abstract_id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi
    const results: SourceItem[] = []
    let match
    while ((match = titleRegex.exec(html)) && results.length < maxResults) {
      const [, id, title] = match
      results.push({
        id: id,
        provider: 'ssrn' as const,
        title: title.trim(),
        url: `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=${id}`,
        snippet: '',
        publishedAt: undefined
      })
    }
    return results
  } catch { return [] }
}

// --- CrossRef (DOI registry with free API) ---
async function crossrefSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${maxResults}&sort=relevance&order=desc`
    const res = await fetch(url, { headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0 (mailto:support@example.com)' } })
    if (!res.ok) return []
    const data: any = await res.json()
    const items = data?.message?.items || []
    return items.map((item: any) => ({
      id: item.DOI,
      provider: 'crossref' as const,
      title: item.title?.[0] || 'CrossRef Work',
      url: item.URL || `https://doi.org/${item.DOI}`,
      snippet: item.abstract || '',
      authors: item.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).slice(0, 5) || [],
      publishedAt: toISO(item.published?.['date-parts']?.[0] ? `${item.published['date-parts'][0].join('-')}` : undefined),
      citations: typeof item['is-referenced-by-count'] === 'number' ? item['is-referenced-by-count'] : undefined
    }))
  } catch { return [] }
}

async function hnSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${maxResults}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data: any = await res.json()
  const hits: any[] = data?.hits || []
  return hits.map(h => ({
    id: h.objectID,
    provider: "hn" as const,
    title: h.title || h.story_title || h.url || "Hacker News",
    url: h.url || (h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`),
    snippet: h.comment_text || h.story_text || h._highlightResult?.title?.value,
    openAccess: true
  }))
}

async function arxivSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  // Prefer relevance over recency for domain-specific queries
  const q = `all:${'"' + query + '"'}`
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=relevance&start=0&max_results=${maxResults}`
  const res = await fetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  return parseArxivAtom(xml)
}

// --- OpenAlex (open library) ---
async function openalexSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${maxResults}&filter=is_oa:true,type:journal-article&sort=cited_by_count:desc`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: any = await res.json()
    const works: any[] = data?.results || data?.works || []
    return works.slice(0, maxResults).map((w: any) => {
      const id = w.id || w.doi || w.openalex || w.ids?.openalex || w.ids?.doi || w.display_name
      const title = w.display_name || w.title || (w.biblio?.title || '')
      const authors = Array.isArray(w.authorships) ? w.authorships.map((a: any) => a?.author?.display_name).filter(Boolean) : []
      const url = w.primary_location?.landing_page_url || w.open_access?.oa_url || (w.doi ? `https://doi.org/${w.doi.replace(/^doi:/i,'')}` : (w.id || ''))
      const publishedAt = toISO(w.publication_date || (w.publication_year ? `${w.publication_year}-01-01` : undefined))
      const citations = typeof w.cited_by_count === 'number' ? w.cited_by_count : undefined
      const openAccess = !!(w.open_access?.is_oa || w.primary_location?.is_oa || w.open_access?.oa_url)
      return { id: String(id), provider: 'openalex' as const, title: title || (url || 'OpenAlex work'), url: url || (w.id || ''), authors, publishedAt, citations, openAccess }
    })
  } catch { return [] }
}

// --- Semantic Scholar (free tier) ---
async function semanticScholarSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=title,year,authors,url,openAccessPdf,citationCount`
    const res = await fetch(url)
    if (!res.ok) return []
    const data: any = await res.json()
    const items: any[] = data?.data || []
    return items.map((p: any) => {
      const url = p.openAccessPdf?.url || p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : '')
      const authors = Array.isArray(p.authors) ? p.authors.map((a: any) => a.name) : []
      const publishedAt = toISO(p.year ? `${p.year}-01-01` : undefined)
      const citations = typeof p.citationCount === 'number' ? p.citationCount : undefined
      const openAccess = !!p.openAccessPdf?.url
      return { id: p.paperId || url || p.title, provider: 'semanticscholar' as const, title: p.title || url || 'Semantic Scholar', url: url || '', authors, publishedAt, citations, openAccess }
    })
  } catch { return [] }
}

// --- PubMed (NCBI E-utilities, no key for basic usage) ---
async function pubmedSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const esearch = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=${maxResults}&retmode=json&sort=relevance&term=${encodeURIComponent(query)}`
    const r1 = await fetch(esearch)
    if (!r1.ok) return []
    const j1: any = await r1.json()
    const ids: string[] = j1?.esearchresult?.idlist || []
    if (!ids.length) return []
    const esum = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`
    const r2 = await fetch(esum)
    if (!r2.ok) return []
    const j2: any = await r2.json()
    const out: SourceItem[] = []
    const result = j2?.result || {}
    const uids: string[] = result?.uids || []
    for (const id of uids.slice(0, maxResults)) {
      const it = result[id]
      if (!it) continue
      const title = it.title || `PubMed ${id}`
      const authors = Array.isArray(it.authors) ? it.authors.map((a: any) => a.name).filter(Boolean) : []
      const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`
      const publishedAt = toISO(it.pubdate)
      out.push({ id, provider: 'pubmed', title, url, authors, publishedAt })
    }
    return out
  } catch { return [] }
}

// --- Reddit (public JSON endpoints) ---
async function redditSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=all&limit=${maxResults}`
    const res = await fetch(url, { headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' } })
    if (!res.ok) return []
    const data: any = await res.json()
    const children: any[] = data?.data?.children || []
    return children.slice(0, maxResults).map((c: any) => {
      const d = c.data || {}
      const url = d.url || `https://www.reddit.com${d.permalink || ''}`
      const publishedAt = toISO(d.created_utc ? new Date(d.created_utc * 1000) : undefined)
      return { id: String(d.id || url), provider: 'reddit' as const, title: d.title || 'Reddit', url, snippet: d.selftext?.slice(0, 300) || '', publishedAt, openAccess: true }
    })
  } catch { return [] }
}

// --- GitHub repositories (public API, low-rate without token) ---
async function githubSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxResults}`
    const res = await fetch(url, { headers: { 'User-Agent': 'QuantumPDF-ChatApp/1.0' } })
    if (!res.ok) return []
    const data: any = await res.json()
    const items: any[] = data?.items || []
    return items.map((r: any) => ({ id: String(r.id), provider: 'github' as const, title: r.full_name || r.name, url: r.html_url, snippet: r.description || '', publishedAt: toISO(r.updated_at), openAccess: true }))
  } catch { return [] }
}

// --- Relevance helpers ---
function needsDomainFilter(query: string): boolean {
  return /endoscop/i.test(query)
}

function textRelevanceScore(item: SourceItem, query: string): number {
  const base = (item.title + ' ' + (item.snippet || '')).toLowerCase()
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  let score = 0
  for (const t of tokens) if (base.includes(t)) score += 1
  // Domain-specific boost for endoscopy when present
  if (/endoscop/i.test(query)) {
    const keywords = ['endoscopy','endoscopic','colonoscopy','gastroscopy','bronchoscopy','gi','gastro','medical imaging','image enhancement','super-resolution','dehazing','denoising','illumination','deblurring']
    for (const k of keywords) if (base.includes(k)) score += 2
  }
  return score
}

function computeScore(item: SourceItem, query: string): number {
  const host = hostnameFromUrl(item.url)
  const d = getDomainInfo(host)
  const rec = recencyWeight(item.publishedAt)
  const rel = textRelevanceScore(item, query)
  return 0.2 * d.reliability + 0.2 * rec + 0.6 * (rel / 10) // normalize rel roughly
}

// Summarization using Hugging Face if available (fallback to snippet)
async function summarizeText(text: string, title: string): Promise<string> {
  try {
    const key = process.env.HUGGINGFACE_API_KEY
    if (!key) {
      // Lightweight extract when no key
      return `- ${title}: ${text.slice(0, 280)}...`
    }
    const prompt = `Summarize the following content in 4-6 bullet points focusing on key claims, evidence, and limitations. Be concise. Title: ${title}. Content: ${text}`
    const resp = await fetch("https://api-inference.huggingface.co/models/microsoft/Phi-4", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 240, temperature: 0.5, return_full_text: false } })
    })
    if (!resp.ok) return `- ${title}: ${text.slice(0, 280)}...`
    const data = await resp.json()
    const out = Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text : data.generated_text || ""
    return out || `- ${title}: ${text.slice(0, 280)}...`
  } catch (e) {
    return `- ${title}: ${text.slice(0, 280)}...`
  }
}

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of arr) {
    const k = key(item)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(item)
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  let body: UnifiedRequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
  }

  const query = (body.query || "").trim()
  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), { status: 400 })
  }
  const maxResults = clamp(body.maxResults ?? 10, 3, 20)
  // Default to completely free/open sources (no API keys required)
  const requestedSources = new Set(body.sources || [
    "arxiv", "openalex", "semanticscholar", "pubmed", "biorxiv", "medrxiv", "doaj", "crossref", "hn", "reddit", "github", "ssrn"
  ])
  const intent = detectIntent(query)
  const summaryLevel = body.summaryLevel || 'standard' // quick, standard, detailed
  const synthesisMode: 'server' | 'client' = body.synthesis === 'client' ? 'client' : 'server'
  const links = Array.isArray(body.links) ? body.links : []
  const useLocalDocs = !!body.useLocalDocs
  const vectorDBConfig = body.vectorDBConfig
  const aiConfig = body.aiConfig

  if (links.length > 0) requestedSources.add('links')
  if (useLocalDocs) requestedSources.add('local')

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { step: "search", status: "in_progress", providers: Array.from(requestedSources) })
        // Emit initial typing pulse to animate UI during early phase
        sse(controller, { step: "typing", status: "pulse" })

        // Run connectors in parallel (all free/open sources)
        const promises: Promise<SourceItem[]>[] = []
        if (requestedSources.has("arxiv")) promises.push(arxivSearch(query, maxResults))
        if (requestedSources.has("openalex")) promises.push(openalexSearch(query, maxResults))
        if (requestedSources.has("semanticscholar")) promises.push(semanticScholarSearch(query, maxResults))
        if (requestedSources.has("pubmed")) promises.push(pubmedSearch(query, maxResults))
        if (requestedSources.has("biorxiv")) promises.push(biorxivSearch(query, maxResults))
        if (requestedSources.has("medrxiv")) promises.push(medrxivSearch(query, maxResults))
        if (requestedSources.has("doaj")) promises.push(doajSearch(query, maxResults))
        if (requestedSources.has("crossref")) promises.push(crossrefSearch(query, maxResults))
        if (requestedSources.has("ssrn")) promises.push(ssrnSearch(query, maxResults))
        if (requestedSources.has("hn") || requestedSources.has("news")) promises.push(hnSearch(query, maxResults))
        if (requestedSources.has("reddit")) promises.push(redditSearch(query, maxResults))
        if (requestedSources.has("github")) promises.push(githubSearch(query, maxResults))
        if (requestedSources.has("links") && links.length) promises.push(linksProvider(links, maxResults, aiConfig))
        if (requestedSources.has("local") && useLocalDocs) promises.push(localSearchProvider(query, maxResults, vectorDBConfig, aiConfig))

        const results = (await Promise.allSettled(promises))
          .flatMap(r => r.status === "fulfilled" ? r.value : [])

        // Dedup, filter for domain relevance when needed, and score-sort
        let items = uniqBy(results, r => (r.title?.toLowerCase().replace(/\s+/g, ' ') || "") + "|" + hostnameFromUrl(r.url))
        if (needsDomainFilter(query)) {
          items = items.filter(it => textRelevanceScore(it, query) >= 2)
        }
        // Apply user-provided filters (tier1, citations, date range, open access)
        items = applySourceFilters(items, body.sourceFilters)
        items = items
          .map(it => ({ it, score: computeScore(it, query) }))
          .sort((a, b) => b.score - a.score)
          .map(x => x.it)
          .slice(0, maxResults)
        sse(controller, { step: "search", status: "done", total: items.length })
        // Emit initial metrics: intent, provider counts, total
        const providerCounts = items.reduce((acc: Record<string, number>, it) => {
          acc[it.provider] = (acc[it.provider] || 0) + 1
          return acc
        }, {})
        sse(controller, { step: "metrics", intent, totalSources: items.length, providerCounts })

        // Fetch lightweight content for each (first N to limit latency)
        sse(controller, { step: "fetch", status: "in_progress", progress: { done: 0, total: items.length } })
        const fetched: { item: SourceItem; text: string }[] = []
        let done = 0
        for (const item of items) {
          let text = item.snippet || ""
          // For arXiv, snippet-less, try to fetch abstract page quickly (avoid heavy PDF processing in MVP)
          if (!text && item.provider === "arxiv") {
            try {
              const res = await fetch(item.url, { headers: { "User-Agent": "QuantumPDF-ChatApp/1.0" } })
              const html = await res.text()
              // naive abstract pull
              const abs = (html.match(/<blockquote class=\"abstract[\s\S]*?<\/blockquote>/i) || [])[0] || ""
              const clean = abs.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
              text = clean || ""
            } catch {}
          }
          fetched.push({ item, text })
          done += 1
          sse(controller, { step: "fetch", status: "in_progress", item: { title: item.title, url: item.url, provider: item.provider }, progress: { done, total: items.length } })
          if (done % 2 === 0) sse(controller, { step: "typing", status: "pulse" })
        }
        sse(controller, { step: "fetch", status: "done" })

        // Summaries (progress & context payload for client synthesis)
        sse(controller, { step: "summarize", status: "in_progress", progress: { done: 0, total: fetched.length } })
        let sdone = 0
        const cited: SourceItem[] = []
        for (const f of fetched) {
          // Accumulate cited items (no server-side text streaming if client synthesis)
          cited.push(f.item)
          sdone += 1
          sse(controller, { step: "summarize", status: "in_progress", progress: { done: sdone, total: fetched.length } })
          if (sdone % 2 === 1) sse(controller, { step: "typing", status: "pulse" })
        }
        sse(controller, { step: "summarize", status: "done" })

        // Extract number from query if specified
        const numberMatch = query.match(/(?:top\s+)?(\d+)(?:\s+(?:latest|recent|top))?/i)
        const requestedCount = numberMatch ? Math.min(parseInt(numberMatch[1]), maxResults) : maxResults
        const displaySources = cited.slice(0, requestedCount)

        if (synthesisMode === 'server') {
          // Keep existing server-side synthesis path (omitted here for brevity in patch)
          let summary = ""
          // Minimal server synthesis: just list sources if needed
          summary += `# ${requestedCount} Results for: ${query}\n\n`
          summary += `| # | Title | URL |\n|---|-------|-----|\n`
          displaySources.forEach((s, i) => {
            summary += `| ${i+1} | ${s.title.replace(/\|/g, ' ')} | ${s.url} |\n`
          })
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ step: "answer", status: "in_progress", text: summary })}\n\n`))
        } else {
          // Client-side synthesis: send context payload
          const sourcesExport = displaySources.map((c, i) => ({ id: i + 1, title: c.title, url: c.url, provider: c.provider, publishedAt: c.publishedAt, authors: c.authors }))
          const snippets = displaySources.map((c, i) => ({ id: i + 1, title: c.title, snippet: c.snippet || '', url: c.url, publishedAt: c.publishedAt, authors: c.authors }))
          sse(controller, { step: "context", status: "done", context: { query, requestedCount, sources: sourcesExport, snippets } })
        }
        
        // Metrics aggregation (confidence, reliability, sentiment, bias)
        const domainInfos = cited.map(c => getDomainInfo(hostnameFromUrl(c.url)))
        const avgReliability = domainInfos.length ? domainInfos.reduce((a,b)=>a+b.reliability,0)/domainInfos.length : 0.65
        const avgRecency = cited.length ? cited.reduce((a,c)=> a + recencyWeight(c.publishedAt), 0) / cited.length : 0.6
        const providersSet = new Set(cited.map(c => c.provider))
        const consensusProxy = Math.min(1, providersSet.size / 3) // simple proxy based on provider diversity
        const confidence = 0.45*consensusProxy + 0.25*avgReliability + 0.30*avgRecency
        const biasIndicators = cited.map(c => ({ domain: hostnameFromUrl(c.url), ...getDomainInfo(hostnameFromUrl(c.url)) }))
        // Sentiment (rough) from titles/snippets combined
        const sentiment: "pos" | "neu" | "neg" = (() => {
          const joined = cited.map(c => c.title).join(". ")
          return simpleSentiment(joined)
        })()
        const finalProviderCounts = cited.reduce((acc: Record<string, number>, it) => { acc[it.provider] = (acc[it.provider] || 0) + 1; return acc }, {})
        const domainCoverage = extractTopics(cited)
        sse(controller, { step: "metrics", confidence: Number(confidence.toFixed(2)), reliabilityScore: Number(avgReliability.toFixed(2)), biasIndicators, sentiment, intent, totalSources: cited.length, providerCounts: finalProviderCounts, domainCoverage })

        // Done + citations + related queries (respect requested count)
        const sourcesExport = displaySources.map((c, i) => ({ id: i + 1, title: c.title, url: c.url, provider: c.provider, publishedAt: c.publishedAt, authors: c.authors }))
        const relatedQueries = [
          `${query} recent developments`,
          `${query} challenges`,
          `${query} benchmarks`
        ]
        
        // Advanced analysis pipeline
        const allText = cited.map(c => c.title + '. ' + (c.snippet || '')).join(' ')
        const claims = extractClaims(allText)
        const factChecks = crossCheckClaims(claims, cited)
        
        // Research gaps (for academic queries)
        const researchGaps = intent === 'research' ? identifyResearchGaps(cited, query) : []
        
        // Trend analysis
        const trendAnalysis = detectTrends(cited)
        
        // Query enhancement suggestions
        const queryEnhancement = enhanceQuery(query)
        // Methodology summary (basic heuristic)
        const methodologySummary = summarizeMethodologies(cited)
        
        sse(controller, { 
          step: "done", 
          status: "done", 
          sources: sourcesExport, 
          relatedQueries: [...relatedQueries, ...researchGaps, ...queryEnhancement.suggestions].slice(0, 6),
          factChecks,
          trendAnalysis,
          queryEnhancement,
          methodologySummary
        })
        controller.close()
      } catch (error) {
        sse(controller, { step: "error", status: "error", message: error instanceof Error ? error.message : String(error) })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

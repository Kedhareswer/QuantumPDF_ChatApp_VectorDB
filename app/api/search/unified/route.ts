import { NextRequest } from "next/server"
import type { MetadataRoute } from "next"

// Runtime: Node.js (we use network + modest parsing)
export const runtime = "nodejs"

// Types
interface UnifiedRequestBody {
  query: string
  sources?: string[]
  summaryLevel?: 'quick' | 'standard' | 'detailed'
  timeRange?: "24h" | "7d" | "30d" | "1y" | "all"
  maxResults?: number
  locale?: string
  model?: string
}

interface SourceItem {
  id: string
  provider: "brave" | "arxiv" | "hn" | "unknown"
  title: string
  url: string
  snippet?: string
  authors?: string[]
  publishedAt?: string
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
function enhanceQuery(query: string): { enhanced: string; suggestions: string[]; corrections: string[] } {
  const enhanced = expandAcronyms(query)
  const suggestions = generateQuerySuggestions(query)
  const corrections = spellCheck(query)
  
  return { enhanced, suggestions, corrections }
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
      publishedAt: toISO(published)
    })
  }
  return items
}

async function braveSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY
  if (!token) return []
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`
  const res = await fetch(url, { headers: { "X-Subscription-Token": token } })
  if (!res.ok) return []
  const data: any = await res.json()
  const web: any[] = data?.web?.results || []
  return web.map((r, i) => ({
    id: r.url || `${i}`,
    provider: "brave" as const,
    title: r.title || r.url,
    url: r.url,
    snippet: r.description || r.snippet || ""
  }))
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
    snippet: h.comment_text || h.story_text || h._highlightResult?.title?.value
  }))
}

async function arxivSearch(query: string, maxResults: number): Promise<SourceItem[]> {
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&start=0&max_results=${maxResults}`
  const res = await fetch(url)
  if (!res.ok) return []
  const xml = await res.text()
  return parseArxivAtom(xml)
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
  const requestedSources = new Set(body.sources || ["web", "arxiv", "news"]) // default: all
  const intent = detectIntent(query)
  const summaryLevel = body.summaryLevel || 'standard' // quick, standard, detailed

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { step: "search", status: "in_progress", providers: Array.from(requestedSources) })
        // Emit initial typing pulse to animate UI during early phase
        sse(controller, { step: "typing", status: "pulse" })

        // Run connectors in parallel
        const promises: Promise<SourceItem[]>[] = []
        if (requestedSources.has("web")) promises.push(braveSearch(query, maxResults))
        if (requestedSources.has("arxiv")) promises.push(arxivSearch(query, maxResults))
        if (requestedSources.has("news")) promises.push(hnSearch(query, maxResults))

        const results = (await Promise.allSettled(promises))
          .flatMap(r => r.status === "fulfilled" ? r.value : [])

        let items = uniqBy(results, r => (r.title?.toLowerCase().replace(/\s+/g, ' ') || "") + "|" + (new URL(r.url).hostname)).slice(0, maxResults)
        sse(controller, { step: "search", status: "done", total: items.length })
        // Emit intent metrics early
        sse(controller, { step: "metrics", intent })

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

        // Summaries
        sse(controller, { step: "summarize", status: "in_progress", progress: { done: 0, total: fetched.length } })
        let answerHeader = `# Web Research Result\n\nQuery: ${query}\n\n## Source Summaries\n`
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ step: "answer", status: "in_progress", text: answerHeader })}\n\n`))
        let sdone = 0
        const cited: SourceItem[] = []
        for (let i = 0; i < fetched.length; i++) {
          const f = fetched[i]
          const baseText = f.text && f.text.length > 60 ? f.text.slice(0, 3000) : (f.item.snippet || "")
          const summary = await summarizeText(baseText || "", f.item.title)
          const idx = i + 1
          const section = `\n\n### [${idx}] ${f.item.title}\n${summary}\n\nLink: ${f.item.url}`
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ step: "answer", status: "in_progress", text: section })}\n\n`))
          cited.push(f.item)
          sdone += 1
          sse(controller, { step: "summarize", status: "in_progress", progress: { done: sdone, total: fetched.length } })
          if (sdone % 2 === 1) sse(controller, { step: "typing", status: "pulse" })
        }
        sse(controller, { step: "summarize", status: "done" })

        // Synthesis
        const synthesisIntro = `\n\n## Synthesized Trends\nThe following trends are derived from the sources above, referenced inline as [n].\n\n`
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ step: "answer", status: "in_progress", text: synthesisIntro })}\n\n`))

        try {
          const key = process.env.HUGGINGFACE_API_KEY
          const joinedBullets = fetched.map((f, i) => `(${i + 1}) ${f.item.title}: ${(f.text || f.item.snippet || '').slice(0, 400)}`).join("\n")
          let synthesis = ""
          if (key) {
            const prompt = `Given these source blurbs, write a concise trends analysis in 6-8 bullet points. Reference sources as [n]. Keep it factual and avoid hallucinations.\n${joinedBullets}`
            const resp = await fetch("https://api-inference.huggingface.co/models/microsoft/Phi-4", {
              method: "POST",
              headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 260, temperature: 0.4, return_full_text: false } })
            })
            if (resp.ok) {
              const data = await resp.json()
              synthesis = Array.isArray(data) && data[0]?.generated_text ? data[0].generated_text : data.generated_text || ""
            }
          }
          const finalSynth = synthesis || "- Trend 1: ...\n- Trend 2: ...\n- Trend 3: ..."
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ step: "answer", status: "in_progress", text: finalSynth })}\n\n`))
        } catch {}

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
        sse(controller, { step: "metrics", confidence: Number(confidence.toFixed(2)), reliabilityScore: Number(avgReliability.toFixed(2)), biasIndicators, sentiment, intent })

        // Done + citations + related queries
        const sourcesExport = cited.map((c, i) => ({ id: i + 1, title: c.title, url: c.url, provider: c.provider, publishedAt: c.publishedAt, authors: c.authors }))
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
        
        sse(controller, { 
          step: "done", 
          status: "done", 
          sources: sourcesExport, 
          relatedQueries: [...relatedQueries, ...researchGaps, ...queryEnhancement.suggestions].slice(0, 6),
          factChecks,
          trendAnalysis,
          queryEnhancement: queryEnhancement.corrections.length > 0 ? queryEnhancement : undefined
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

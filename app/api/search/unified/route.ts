import { NextRequest } from "next/server"
import type { MetadataRoute } from "next"

// Runtime: Node.js (we use network + modest parsing)
export const runtime = "nodejs"

// Types
interface UnifiedRequestBody {
  query: string
  sources?: Array<"web" | "arxiv" | "news" | "papers">
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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { step: "search", status: "in_progress", providers: Array.from(requestedSources) })

        // Run connectors in parallel
        const promises: Promise<SourceItem[]>[] = []
        if (requestedSources.has("web")) promises.push(braveSearch(query, maxResults))
        if (requestedSources.has("arxiv")) promises.push(arxivSearch(query, maxResults))
        if (requestedSources.has("news")) promises.push(hnSearch(query, maxResults))

        const results = (await Promise.allSettled(promises))
          .flatMap(r => r.status === "fulfilled" ? r.value : [])

        let items = uniqBy(results, r => (r.title?.toLowerCase().replace(/\s+/g, ' ') || "") + "|" + (new URL(r.url).hostname)).slice(0, maxResults)
        sse(controller, { step: "search", status: "done", total: items.length })

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

        // Done + citations
        const sourcesExport = cited.map((c, i) => ({ id: i + 1, title: c.title, url: c.url, provider: c.provider, publishedAt: c.publishedAt, authors: c.authors }))
        sse(controller, { step: "done", status: "done", sources: sourcesExport })
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

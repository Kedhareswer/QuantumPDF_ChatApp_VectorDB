# QuantumPDF Optimization Guide

> **Performance optimization strategies and implementation details**
> **Last updated: August 2026**

---

## Table of Contents

1. [Overview](#overview)
2. [Embedding Optimizations](#embedding-optimizations)
3. [Chunking Optimizations](#chunking-optimizations)
4. [RAG Query Optimizations](#rag-query-optimizations)
5. [UI Performance](#ui-performance)
6. [Memory Management](#memory-management)
7. [Network Optimizations](#network-optimizations)
8. [Bundle Optimization](#bundle-optimization)
9. [Benchmarks](#benchmarks)

---

## Overview

### Performance Goals

| Metric | Target | Current |
|--------|--------|---------|
| PDF Processing (1MB) | <15s | ~12s ✅ |
| Embedding Generation | <5s | ~4.5s ✅ |
| Vector Search (1000 chunks) | <100ms | ~80ms ✅ |
| Chat Response (uncached) | <5s | ~3.5s ✅ |
| Chat Response (cached) | <500ms | ~200ms ✅ |
| Initial Page Load | <3s | ~2.5s ✅ |
| Time to Interactive | <4s | ~3.5s ✅ |

### Optimization Principles

1. **Cache Aggressively** - Embeddings, query results, processed documents
2. **Lazy Load** - Heavy client deps (e.g. `pdfjs-dist`) imported on-demand
3. **Parallel Processing** - Concurrent API calls, chunk processing
4. **Early Termination** - Stop processing when sufficient results found
5. **Progressive Enhancement** - Basic functionality first, advanced features async

---

## Embedding Optimizations

### Embedding Cache (Enhanced in v3.1)

The embedding cache now includes TTL-based expiration and improved eviction:

```typescript
// lib/ai-client.ts
interface EmbeddingCacheEntry {
  embedding: number[]
  timestamp: number
  textHash: string
}

// Global cache with TTL support
const embeddingCache = new Map<string, EmbeddingCacheEntry>()
const EMBEDDING_CACHE_TTL = 30 * 60 * 1000  // 30 minutes
const MAX_CACHE_SIZE = 1000

function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

async generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = `${this.config.provider}:${hashText(text.trim())}`
  const cached = embeddingCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL) {
    console.log(`Cache hit for embedding`)
    return cached.embedding
  }
  
  // Generate new embedding
  const embedding = await this._generateEmbeddingInternal(text)
  
  // LRU-style eviction if cache full
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = embeddingCache.keys().next().value
    if (oldestKey) embeddingCache.delete(oldestKey)
  }
  
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
    textHash: hashText(text.trim())
  })
  
  return embedding
}

// Static methods for cache management
static clearEmbeddingCache(): void { embeddingCache.clear() }
static getCacheStats(): { size: number; maxSize: number } {
  return { size: embeddingCache.size, maxSize: MAX_CACHE_SIZE }
}
```

### Batch Embedding Generation

```typescript
// Process multiple texts in single API call
async generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Check cache first
  const uncached: string[] = []
  const cachedResults: Map<number, number[]> = new Map()
  
  texts.forEach((text, i) => {
    const cached = this.cache.get(text, this.provider)
    if (cached) {
      cachedResults.set(i, cached)
    } else {
      uncached.push(text)
    }
  })
  
  // Batch API call for uncached only
  if (uncached.length > 0) {
    const newEmbeddings = await this.batchEmbed(uncached)
    // Cache new results
    uncached.forEach((text, i) => {
      this.cache.set(text, this.provider, newEmbeddings[i])
    })
  }
  
  // Reconstruct results in original order
  return texts.map((text, i) => 
    cachedResults.get(i) ?? this.cache.get(text, this.provider)!
  )
}
```

### Fallback Embeddings (38% Faster)

```typescript
// Optimized local fallback when API unavailable
generateFallbackEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim()
  const words = normalized.split(/\s+/)
  const embedding = new Float32Array(1536).fill(0)
  
  // Character-level features (fast)
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i)
    embedding[charCode % 256] += 1
  }
  
  // Word-level features
  words.forEach((word, idx) => {
    const hash = this.hashWord(word)
    embedding[256 + (hash % 640)] += 1
    embedding[896 + (idx % 640)] += 0.5
  })
  
  // Normalize
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  )
  return Array.from(embedding.map(v => v / (magnitude || 1)))
}
```

---

## Chunking Optimizations

### Adaptive Chunk Sizing

```typescript
// lib/advanced-chunking.ts
function calculateOptimalChunkSize(document: ProcessedDocument): number {
  const docLength = document.content.length
  const hasCode = /```[\s\S]+?```/.test(document.content)
  const hasTables = /\|.*\|.*\|/.test(document.content)
  
  // Base sizes
  let minChunk = 400
  let maxChunk = 1200
  
  // Adjust for content type
  if (hasCode) {
    maxChunk = 2000 // Keep code blocks together
  }
  if (hasTables) {
    minChunk = 600 // Tables need more context
  }
  
  // Adjust for document size
  if (docLength > 100000) {
    minChunk = 600  // Larger docs = larger chunks
    maxChunk = 1500
  } else if (docLength < 10000) {
    minChunk = 300  // Smaller docs = smaller chunks
    maxChunk = 800
  }
  
  return { minChunk, maxChunk }
}
```

### Semantic Boundary Detection

```typescript
// Split at natural boundaries
function findSemanticBoundary(text: string, position: number): number {
  const searchWindow = 200
  const start = Math.max(0, position - searchWindow)
  const end = Math.min(text.length, position + searchWindow)
  const window = text.slice(start, end)
  
  // Priority: paragraph > sentence > clause
  const boundaries = [
    { pattern: /\n\n/, weight: 3 },
    { pattern: /[.!?]\s+[A-Z]/, weight: 2 },
    { pattern: /[,;:]\s+/, weight: 1 }
  ]
  
  let bestPosition = position
  let bestWeight = 0
  
  boundaries.forEach(({ pattern, weight }) => {
    let match
    const regex = new RegExp(pattern, 'g')
    while ((match = regex.exec(window)) !== null) {
      const matchPos = start + match.index
      if (Math.abs(matchPos - position) < Math.abs(bestPosition - position) 
          || weight > bestWeight) {
        bestPosition = matchPos
        bestWeight = weight
      }
    }
  })
  
  return bestPosition
}
```

### Structure Preservation

```typescript
// Keep code blocks as atomic units
function preserveStructures(chunks: ContentChunk[]): ContentChunk[] {
  return chunks.map(chunk => {
    // If chunk starts mid-code-block, find start
    const codeBlockStart = chunk.content.lastIndexOf('```')
    const codeBlockEnd = chunk.content.indexOf('```', codeBlockStart + 3)
    
    if (codeBlockStart !== -1 && codeBlockEnd === -1) {
      // Code block continues - mark for merge with next chunk
      chunk.metadata.mergeWithNext = true
    }
    
    return chunk
  })
}
```

### Chunk Deduplication (NEW in v3.1)

```typescript
// lib/rag-engine.ts
// Remove near-duplicate chunks using Jaccard similarity
private deduplicateChunks(chunks: any[]): any[] {
  if (chunks.length <= 1) return chunks
  
  const SIMILARITY_THRESHOLD = 0.7 // 70% overlap = duplicate
  const deduplicated: any[] = []
  
  for (const chunk of chunks) {
    const chunkWords = new Set(
      chunk.content.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
    )
    
    let isDuplicate = false
    for (const existing of deduplicated) {
      const existingWords = new Set(/* same extraction */)
      
      // Jaccard similarity: intersection / union
      const intersection = new Set([...chunkWords].filter(x => existingWords.has(x)))
      const union = new Set([...chunkWords, ...existingWords])
      const similarity = intersection.size / union.size
      
      if (similarity > SIMILARITY_THRESHOLD) {
        isDuplicate = true
        // Keep the longer/more detailed chunk
        if (chunk.content.length > existing.content.length) {
          const idx = deduplicated.indexOf(existing)
          deduplicated[idx] = chunk
        }
        break
      }
    }
    
    if (!isDuplicate) deduplicated.push(chunk)
  }
  
  return deduplicated
}
```

### Smart Context Truncation (NEW in v3.1)

```typescript
// Preserve sentence boundaries when truncating
private smartTruncateChunk(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4 // ~4 chars per token
  if (content.length <= maxChars) return content
  
  const truncated = content.substring(0, maxChars)
  
  // Find last sentence boundary
  const lastSentence = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('?'),
    truncated.lastIndexOf('!')
  )
  
  if (lastSentence > maxChars * 0.5) {
    return content.substring(0, lastSentence + 1) + ' [truncated]'
  }
  
  // Fallback to word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  return content.substring(0, lastSpace) + '... [truncated]'
}
```

---

## RAG Query Optimizations

### Adaptive Hybrid Search Weights (NEW in v3.1)

```typescript
// lib/vector-database.ts
// Dynamically adjust semantic vs keyword weights based on query type
private getAdaptiveHybridWeights(query: string): { semantic: number; keyword: number } {
  // Keyword-heavy patterns: exact terms, quotes, section refs
  const keywordPatterns = [
    /\b(exact|specific|definition|what is)\b/i,
    /"[^"]+"/i,  // Quoted phrases
    /\b[A-Z]{2,}\b/,  // Acronyms
  ]
  
  // Semantic-heavy patterns: conceptual questions
  const semanticPatterns = [
    /\b(explain|describe|summarize|overview)\b/i,
    /\b(how|why|relationship)\b/i,
    /\b(compare|contrast|difference)\b/i,
  ]
  
  let keywordBoost = 0, semanticBoost = 0
  
  keywordPatterns.forEach(p => { if (p.test(query)) keywordBoost += 0.1 })
  semanticPatterns.forEach(p => { if (p.test(query)) semanticBoost += 0.1 })
  
  // Short queries favor keyword, long queries favor semantic
  const wordCount = query.split(/\s+/).length
  if (wordCount <= 3) keywordBoost += 0.15
  if (wordCount > 10) semanticBoost += 0.1
  
  // Base: 55% semantic, 45% keyword; adjust and normalize
  let semantic = Math.max(0.3, Math.min(0.8, 0.55 + semanticBoost - keywordBoost))
  let keyword = 1 - semantic
  
  return { semantic, keyword }
}
```

### Query Result Caching

```typescript
// lib/rag-engine.ts
class QueryCache {
  private cache = new Map<string, RAGResult>()
  private ttl = 5 * 60 * 1000 // 5 minutes
  
  private getKey(query: string, docIds: string[]): string {
    return `${query}:${docIds.sort().join(',')}`
  }
  
  get(query: string, docIds: string[]): RAGResult | undefined {
    const key = this.getKey(query, docIds)
    const entry = this.cache.get(key)
    
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return entry.result
    }
    
    return undefined
  }
  
  set(query: string, docIds: string[], result: RAGResult): void {
    const key = this.getKey(query, docIds)
    this.cache.set(key, { result, timestamp: Date.now() })
  }
}
```

### Early Termination

```typescript
// Stop searching when confidence is high enough
async query(queryText: string, options: QueryOptions): Promise<RAGResult> {
  const chunks = await this.retrieveChunks(queryText, options)
  
  // Check if top chunks have high confidence
  const topConfidence = chunks.slice(0, 3).reduce(
    (sum, c) => sum + c.similarity, 0
  ) / 3
  
  if (topConfidence > 0.9) {
    // High confidence - skip 3-phase, use fast path
    return this.fastQuery(chunks, queryText)
  }
  
  // Normal 3-phase processing
  return this.fullQuery(chunks, queryText, options)
}
```

### Parallel Phase Processing

```typescript
// Process independent phases in parallel
async queryWithParallelPhases(queryText: string): Promise<RAGResult> {
  const chunks = await this.retrieveChunks(queryText)
  
  // Phase 1 & context gathering in parallel
  const [contextAnalysis, additionalContext] = await Promise.all([
    this.analyzeContext(queryText, chunks),
    this.gatherAdditionalContext(chunks)
  ])
  
  // Phase 2 depends on Phase 1
  const critique = await this.selfCritique(contextAnalysis)
  
  // Phase 3
  const refined = await this.refineAnswer(contextAnalysis, critique)
  
  return refined
}
```

---

## UI Performance

### Message Re-render Optimization (87% Reduction)

```typescript
// components/chat-interface.tsx
import { memo, useCallback, useMemo } from 'react'

// Memoized message component
const ChatMessage = memo(function ChatMessage({ 
  message, 
  onReaction 
}: ChatMessageProps) {
  return (
    <div className="message">
      <MarkdownContent content={message.content} />
    </div>
  )
}, (prev, next) => {
  // Only re-render if content actually changed
  return prev.message.id === next.message.id 
    && prev.message.content === next.message.content
})

// Stable callbacks
function ChatInterface() {
  const handleSend = useCallback(async (content: string) => {
    // Send logic
  }, [/* stable deps */])
  
  // Memoize message list
  const messageList = useMemo(() => (
    messages.map(msg => (
      <ChatMessage key={msg.id} message={msg} />
    ))
  ), [messages])
  
  return <div>{messageList}</div>
}
```

### Virtual Scrolling for Large Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function DocumentList({ documents }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  })
  
  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <DocumentItem 
            key={virtualRow.key}
            document={documents[virtualRow.index]}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### Lazy Loading Heavy Components

```typescript
import dynamic from 'next/dynamic'

// Lazy load Mermaid diagrams
const MermaidDiagram = dynamic(
  () => import('@/components/mermaid'),
  { 
    loading: () => <Skeleton />,
    ssr: false 
  }
)

// Lazy load PDF viewer
const PDFViewer = dynamic(
  () => import('@/components/pdf-viewer'),
  { 
    loading: () => <Skeleton className="h-96" />,
    ssr: false 
  }
)
```

---

## Memory Management

### No in-browser models to manage

`@xenova/transformers` (Transformers.js) was **removed** to eliminate a critical
`protobufjs` vulnerability, so there is no on-device model to load, cache, or
unload — memory stays flat and there are no multi-MB model downloads.

The `local-summarizer.ts` and `vision-models.ts` fallbacks that remained after
that removal were themselves deleted in the August 2026 cleanup: nothing in the
app imported them. Summarization and captioning, where needed, go through the
configured provider via `lib/ai-client.ts`.

The one wasm payload the browser does fetch is `@firecrawl/anydoc-wasm` (~6 MB),
prefetched at idle on page load by `prefetchAnydoc()` so the first upload does
not wait on it. It is instantiated once and memoized for the tab's lifetime.

### Document Cleanup

```typescript
// lib/store.ts
const useAppStore = create((set, get) => ({
  documents: [],
  
  addDocument: (doc: ProcessedDocument) => {
    set(state => {
      // Limit stored documents
      const docs = [...state.documents, doc]
      if (docs.length > 20) {
        // Remove oldest, clear embeddings
        const removed = docs.shift()
        removed?.chunks.forEach(c => c.embedding = undefined)
      }
      return { documents: docs }
    })
  },
  
  clearOldDocuments: () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    set(state => ({
      documents: state.documents.filter(
        d => d.processedAt > oneHourAgo
      )
    }))
  }
}))
```

---

## Network Optimizations

### Request Deduplication

```typescript
// lib/ai-client.ts
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>()
  
  async dedupe<T>(
    key: string, 
    request: () => Promise<T>
  ): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!
    }
    
    const promise = request().finally(() => {
      this.pending.delete(key)
    })
    
    this.pending.set(key, promise)
    return promise
  }
}

// Usage
async generateEmbedding(text: string): Promise<number[]> {
  return this.deduplicator.dedupe(
    `embed:${hashText(text)}`,
    () => this.api.createEmbedding(text)
  )
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private tokens: number
  private maxTokens: number
  private refillRate: number
  private lastRefill: number
  
  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens
    this.maxTokens = maxTokens
    this.refillRate = refillRate
    this.lastRefill = Date.now()
  }
  
  async acquire(): Promise<void> {
    this.refill()
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000
      await sleep(waitTime)
      this.refill()
    }
    
    this.tokens -= 1
  }
  
  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    )
    this.lastRefill = now
  }
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailure = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  private readonly threshold = 5
  private readonly resetTimeout = 30000
  
  async execute<T>(request: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await request()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailure = Date.now()
    
    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
}
```

---

## Bundle Optimization

### Code Splitting

Turbopack is the default bundler (Next.js 16) and performs chunk splitting
automatically, so there is no custom `splitChunks` config in `next.config.mjs`.
The only `webpack` override there is a minimal client-side fallback that polyfills
Node built-ins (`fs`, `net`, `tls`, `dns`, `child_process`, `worker_threads`) to
`false`. Heavy server-only native modules
(`@llamaindex/liteparse`, `onnxruntime-node`, `@huggingface/transformers`, `sharp`)
are listed in `serverExternalPackages` so they are never bundled into the client.

The remaining client-side weight is `pdfjs-dist` (used only by the multimodal
extractors and the URL fetcher) — load it lazily so it stays out of the initial
bundle:

```typescript
// pdfjs-dist is loaded on demand, not at module init.
const loadPDFJS = () => import('pdfjs-dist')
```

### Dynamic Imports

```typescript
// Heavy client dependencies loaded on-demand
const loadPDFJS = () => import('pdfjs-dist')

// PDF text/OCR/previews are extracted server-side via /api/pdf/extract (liteparse).
// pdfjs-dist is only pulled in client-side for the embedded image/table/equation
// extractors and URL-based PDF fetching.
async function extractEmbeddedContent(file: File) {
  const pdfjs = await loadPDFJS()
  // Use pdfjs for images / tables / equations...
}
```

### Tree Shaking

```typescript
// Import only what's needed (named imports keep bundles lean)
import { memo, useCallback, useMemo } from 'react'
// NOT: import * as React from 'react'

import dynamic from 'next/dynamic'
// Lazy-load heavy client components instead of importing them eagerly.
```

> Note: `@xenova/transformers` is no longer a dependency, so there is no
> Transformers.js import to tree-shake.

---

## Benchmarks

### Before/After Optimization Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Fallback Embeddings | 45ms | 28ms | **38% faster** |
| Message Re-renders | All messages | Changed only | **87% reduction** |
| Embedding Cache Hit | 0% | 80-90% | **80-90% saved** |
| Query Cache Hit | 0% | ~30% | **30% faster avg** |

**August 2026 cleanup:** 50 unreferenced files (~9,700 lines) and 31 unused
dependencies removed — including the unused half of the shadcn/ui set and its
Radix primitives, `framer-motion`, `recharts`, `zod` and `immer`. An earlier
edition of this table claimed dead code was already at "0 lines"; treat
dead-code counts here as a snapshot, not a standing guarantee. Re-check with a
reachability walk from `app/**` rather than trusting the number.

### Profiling Commands

```bash
# Bundle analysis (Turbopack emits build stats; inspect .next/ output)
npm run build

# Performance profiling
npm run build
npm start
# Open Chrome DevTools > Performance

# Memory profiling
# Chrome DevTools > Memory > Take Heap Snapshot
```

### Monitoring with Telemetry

```typescript
// lib/telemetry.ts
class Telemetry {
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    console.log(`[METRIC] ${name}: ${value}`, tags)
    // Send to monitoring service
  }
  
  recordTiming(name: string, durationMs: number) {
    this.recordMetric(`timing.${name}`, durationMs)
  }
  
  recordError(error: Error, context?: Record<string, any>) {
    console.error(`[ERROR] ${error.message}`, context)
    // Send to error tracking service
  }
}

// Usage
telemetry.recordTiming('pdf.processing', processingTime)
telemetry.recordTiming('embedding.generation', embeddingTime)
telemetry.recordTiming('rag.query', queryTime)
```

---

## Quick Wins Checklist

### Immediate Optimizations

- [x] Enable embedding cache
- [x] Enable query result cache
- [x] Memoize React components
- [x] Lazy load heavy dependencies
- [x] Use virtual scrolling for long lists
- [x] Implement request deduplication
- [x] Add rate limiting
- [x] Configure code splitting

### Medium-Term Optimizations

- [x] Implement circuit breaker
- [x] Add adaptive chunk sizing
- [x] Optimize fallback embeddings
- [x] Remove dead code
- [x] Remove in-browser model (`@xenova/transformers`) — no model lifecycle to manage
- [x] Move non-PDF parsing in-browser (`@firecrawl/anydoc-wasm`) — no upload round-trip, no serverless function

### Long-Term Optimizations

- [ ] WebWorker for heavy processing
- [ ] IndexedDB for offline storage
- [ ] Service Worker caching strategies
- [ ] Server-side embedding generation
- [ ] Edge function deployment

---

**Generated**: November 2025 · **Updated**: June 2026  
**Project**: QuantumPDF ChatApp (Next.js 16 + React 19)

// lib/telemetry.ts - Monitoring and telemetry system for RAG pipeline

export interface TelemetryEvent {
  timestamp: Date
  category: 'embedding' | 'query' | 'retrieval' | 'provider' | 'cache' | 'performance'
  action: string
  metadata?: Record<string, any>
  duration?: number
  success?: boolean
  error?: string
}

export interface PerformanceMetrics {
  // Latency metrics (ms)
  latency: {
    embedding: { avg: number; min: number; max: number; p95: number }
    query: { avg: number; min: number; max: number; p95: number }
    retrieval: { avg: number; min: number; max: number; p95: number }
  }
  // Token usage
  tokens: {
    total: number
    context: number
    reasoning: number
    response: number
  }
  // Cache performance
  cache: {
    embeddings: { hits: number; misses: number; hitRate: number }
    queries: { hits: number; misses: number; hitRate: number }
  }
  // Provider health
  providers: Map<
    string,
    {
      successCount: number
      failureCount: number
      avgLatency: number
      lastFailure?: Date
    }
  >
  // Document statistics
  documents: {
    total: number
    totalChunks: number
    avgChunksPerDoc: number
  }
}

export class TelemetryCollector {
  private events: TelemetryEvent[] = []
  private maxEvents: number = 10000
  private enabled: boolean = true

  // Performance tracking
  private latencies: Map<string, number[]> = new Map()
  private tokenUsage: { context: number; reasoning: number; response: number } = {
    context: 0,
    reasoning: 0,
    response: 0,
  }

  // Cache stats
  private cacheHits: Map<string, number> = new Map()
  private cacheMisses: Map<string, number> = new Map()

  // Provider stats
  private providerStats: Map<
    string,
    {
      successCount: number
      failureCount: number
      latencies: number[]
      lastFailure?: Date
    }
  > = new Map()

  constructor(enabled: boolean = true) {
    this.enabled = enabled
  }

  // Record an event
  record(event: Omit<TelemetryEvent, 'timestamp'>): void {
    if (!this.enabled) return

    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date(),
    }

    this.events.push(fullEvent)

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }

    // Update specific metrics
    this.updateMetrics(fullEvent)
  }

  // Track latency
  trackLatency(operation: string, duration: number): void {
    if (!this.enabled) return

    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, [])
    }

    const latencies = this.latencies.get(operation)!
    latencies.push(duration)

    // Keep last 1000 measurements
    if (latencies.length > 1000) {
      latencies.shift()
    }

    this.record({
      category: 'performance',
      action: operation,
      duration,
      success: true,
    })
  }

  // Track token usage
  trackTokens(context: number, reasoning: number, response: number): void {
    if (!this.enabled) return

    this.tokenUsage.context += context
    this.tokenUsage.reasoning += reasoning
    this.tokenUsage.response += response

    this.record({
      category: 'performance',
      action: 'token_usage',
      metadata: { context, reasoning, response },
    })
  }

  // Track cache performance
  trackCacheHit(cacheType: string): void {
    if (!this.enabled) return

    const current = this.cacheHits.get(cacheType) || 0
    this.cacheHits.set(cacheType, current + 1)

    this.record({
      category: 'cache',
      action: 'hit',
      metadata: { type: cacheType },
    })
  }

  trackCacheMiss(cacheType: string): void {
    if (!this.enabled) return

    const current = this.cacheMisses.get(cacheType) || 0
    this.cacheMisses.set(cacheType, current + 1)

    this.record({
      category: 'cache',
      action: 'miss',
      metadata: { type: cacheType },
    })
  }

  // Track provider performance
  trackProviderSuccess(provider: string, latency: number): void {
    if (!this.enabled) return

    if (!this.providerStats.has(provider)) {
      this.providerStats.set(provider, {
        successCount: 0,
        failureCount: 0,
        latencies: [],
      })
    }

    const stats = this.providerStats.get(provider)!
    stats.successCount++
    stats.latencies.push(latency)

    // Keep last 100 latencies
    if (stats.latencies.length > 100) {
      stats.latencies.shift()
    }

    this.record({
      category: 'provider',
      action: 'success',
      metadata: { provider },
      duration: latency,
      success: true,
    })
  }

  trackProviderFailure(provider: string, error: string): void {
    if (!this.enabled) return

    if (!this.providerStats.has(provider)) {
      this.providerStats.set(provider, {
        successCount: 0,
        failureCount: 0,
        latencies: [],
      })
    }

    const stats = this.providerStats.get(provider)!
    stats.failureCount++
    stats.lastFailure = new Date()

    this.record({
      category: 'provider',
      action: 'failure',
      metadata: { provider },
      success: false,
      error,
    })
  }

  // Get comprehensive metrics
  getMetrics(): PerformanceMetrics {
    return {
      latency: {
        embedding: this.calculateLatencyStats('embedding'),
        query: this.calculateLatencyStats('query'),
        retrieval: this.calculateLatencyStats('retrieval'),
      },
      tokens: {
        total:
          this.tokenUsage.context +
          this.tokenUsage.reasoning +
          this.tokenUsage.response,
        context: this.tokenUsage.context,
        reasoning: this.tokenUsage.reasoning,
        response: this.tokenUsage.response,
      },
      cache: {
        embeddings: this.calculateCacheStats('embeddings'),
        queries: this.calculateCacheStats('queries'),
      },
      providers: this.getProviderMetrics(),
      documents: this.getDocumentStats(),
    }
  }

  // Get recent events
  getRecentEvents(limit: number = 100): TelemetryEvent[] {
    return this.events.slice(-limit)
  }

  // Filter events
  filterEvents(
    category?: TelemetryEvent['category'],
    startDate?: Date,
    endDate?: Date
  ): TelemetryEvent[] {
    return this.events.filter((event) => {
      if (category && event.category !== category) return false
      if (startDate && event.timestamp < startDate) return false
      if (endDate && event.timestamp > endDate) return false
      return true
    })
  }

  // Get summary report
  generateReport(): string {
    const metrics = this.getMetrics()

    let report = '=== RAG System Telemetry Report ===\n\n'

    // Latency
    report += '## Latency Metrics (ms)\n'
    report += `Embedding: avg ${metrics.latency.embedding.avg.toFixed(2)}, p95 ${metrics.latency.embedding.p95.toFixed(2)}\n`
    report += `Query: avg ${metrics.latency.query.avg.toFixed(2)}, p95 ${metrics.latency.query.p95.toFixed(2)}\n`
    report += `Retrieval: avg ${metrics.latency.retrieval.avg.toFixed(2)}, p95 ${metrics.latency.retrieval.p95.toFixed(2)}\n\n`

    // Tokens
    report += '## Token Usage\n'
    report += `Total: ${metrics.tokens.total.toLocaleString()}\n`
    report += `Context: ${metrics.tokens.context.toLocaleString()} (${((metrics.tokens.context / metrics.tokens.total) * 100).toFixed(1)}%)\n`
    report += `Reasoning: ${metrics.tokens.reasoning.toLocaleString()} (${((metrics.tokens.reasoning / metrics.tokens.total) * 100).toFixed(1)}%)\n`
    report += `Response: ${metrics.tokens.response.toLocaleString()} (${((metrics.tokens.response / metrics.tokens.total) * 100).toFixed(1)}%)\n\n`

    // Cache
    report += '## Cache Performance\n'
    report += `Embeddings: ${(metrics.cache.embeddings.hitRate * 100).toFixed(1)}% hit rate (${metrics.cache.embeddings.hits} hits, ${metrics.cache.embeddings.misses} misses)\n`
    report += `Queries: ${(metrics.cache.queries.hitRate * 100).toFixed(1)}% hit rate (${metrics.cache.queries.hits} hits, ${metrics.cache.queries.misses} misses)\n\n`

    // Providers
    report += '## Provider Health\n'
    metrics.providers.forEach((stats, provider) => {
      const total = stats.successCount + stats.failureCount
      const successRate = total > 0 ? (stats.successCount / total) * 100 : 0
      report += `${provider}: ${successRate.toFixed(1)}% success rate, avg latency ${stats.avgLatency.toFixed(2)}ms\n`
      if (stats.lastFailure) {
        report += `  Last failure: ${stats.lastFailure.toLocaleString()}\n`
      }
    })

    report += '\n=== End Report ===\n'

    return report
  }

  // Reset metrics
  reset(): void {
    this.events = []
    this.latencies.clear()
    this.tokenUsage = { context: 0, reasoning: 0, response: 0 }
    this.cacheHits.clear()
    this.cacheMisses.clear()
    this.providerStats.clear()
  }

  // Helper methods
  private updateMetrics(event: TelemetryEvent): void {
    // Additional metric updates based on event
    if (event.category === 'cache') {
      if (event.action === 'hit') {
        this.trackCacheHit(event.metadata?.type || 'unknown')
      } else if (event.action === 'miss') {
        this.trackCacheMiss(event.metadata?.type || 'unknown')
      }
    }
  }

  private calculateLatencyStats(operation: string): {
    avg: number
    min: number
    max: number
    p95: number
  } {
    const latencies = this.latencies.get(operation) || []

    if (latencies.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 }
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const p95Index = Math.floor(sorted.length * 0.95)
    const p95 = sorted[p95Index] || max

    return { avg, min, max, p95 }
  }

  private calculateCacheStats(type: string): {
    hits: number
    misses: number
    hitRate: number
  } {
    const hits = this.cacheHits.get(type) || 0
    const misses = this.cacheMisses.get(type) || 0
    const total = hits + misses
    const hitRate = total > 0 ? hits / total : 0

    return { hits, misses, hitRate }
  }

  private getProviderMetrics(): Map<
    string,
    {
      successCount: number
      failureCount: number
      avgLatency: number
      lastFailure?: Date
    }
  > {
    const metrics = new Map()

    this.providerStats.forEach((stats, provider) => {
      const avgLatency =
        stats.latencies.length > 0
          ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
          : 0

      metrics.set(provider, {
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        avgLatency,
        lastFailure: stats.lastFailure,
      })
    })

    return metrics
  }

  private getDocumentStats(): {
    total: number
    totalChunks: number
    avgChunksPerDoc: number
  } {
    // This would need to be updated by the RAG engine
    // For now, return placeholder
    return {
      total: 0,
      totalChunks: 0,
      avgChunksPerDoc: 0,
    }
  }
}

// Singleton instance
let globalTelemetry: TelemetryCollector | null = null

export function getTelemetry(): TelemetryCollector {
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryCollector()
  }
  return globalTelemetry
}

export function resetTelemetry(): void {
  if (globalTelemetry) {
    globalTelemetry.reset()
  }
}

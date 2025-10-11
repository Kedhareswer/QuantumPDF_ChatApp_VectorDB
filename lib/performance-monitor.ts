/**
 * Performance Monitoring System for QuantumPDF ChatApp
 *
 * Tracks and logs performance metrics for critical operations
 */

export interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: Date
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 1000 // Keep last 1000 metrics
  private readonly enableLogging: boolean

  constructor(enableLogging = true) {
    this.enableLogging = enableLogging
  }

  /**
   * Start timing an operation
   */
  startOperation(operationName: string): () => void {
    const startTime = performance.now()

    return (metadata?: Record<string, any>) => {
      const duration = performance.now() - startTime
      this.recordMetric({
        operation: operationName,
        duration,
        timestamp: new Date(),
        metadata
      })

      if (this.enableLogging) {
        const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : ''
        console.log(`⏱️  ${operationName}: ${duration.toFixed(2)}ms${metadataStr}`)
      }
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operationName: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.operation === operationName)
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operationName: string): number {
    const metrics = this.getMetricsForOperation(operationName)
    if (metrics.length === 0) return 0

    const total = metrics.reduce((sum, m) => sum + m.duration, 0)
    return total / metrics.length
  }

  /**
   * Get performance statistics
   */
  getStatistics(operationName: string): {
    count: number
    avg: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  } {
    const metrics = this.getMetricsForOperation(operationName)
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 }
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const count = durations.length
    const avg = durations.reduce((sum, d) => sum + d, 0) / count
    const min = durations[0]
    const max = durations[count - 1]

    const percentile = (p: number) => durations[Math.floor(count * p)]

    return {
      count,
      avg,
      min,
      max,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99)
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = []
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const operations = new Set(this.metrics.map(m => m.operation))
    let report = '# Performance Report\n\n'

    operations.forEach(op => {
      const stats = this.getStatistics(op)
      report += `## ${op}\n`
      report += `- Count: ${stats.count}\n`
      report += `- Average: ${stats.avg.toFixed(2)}ms\n`
      report += `- Min: ${stats.min.toFixed(2)}ms\n`
      report += `- Max: ${stats.max.toFixed(2)}ms\n`
      report += `- P50: ${stats.p50.toFixed(2)}ms\n`
      report += `- P95: ${stats.p95.toFixed(2)}ms\n`
      report += `- P99: ${stats.p99.toFixed(2)}ms\n\n`
    })

    return report
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2)
  }

  /**
   * Log slow operations (above threshold)
   */
  logSlowOperations(thresholdMs: number = 100) {
    const slowOps = this.metrics.filter(m => m.duration > thresholdMs)

    if (slowOps.length > 0) {
      console.warn(`⚠️  Found ${slowOps.length} slow operations (>${thresholdMs}ms):`)
      slowOps.forEach(op => {
        console.warn(`  - ${op.operation}: ${op.duration.toFixed(2)}ms`)
      })
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor(
  process.env.NODE_ENV === 'development'
)

// Convenience function for measuring async operations
export async function measureAsync<T>(
  operationName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const endTiming = performanceMonitor.startOperation(operationName)

  try {
    const result = await fn()
    endTiming(metadata)
    return result
  } catch (error) {
    endTiming({ ...metadata, error: true })
    throw error
  }
}

// Convenience function for measuring sync operations
export function measureSync<T>(
  operationName: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const endTiming = performanceMonitor.startOperation(operationName)

  try {
    const result = fn()
    endTiming(metadata)
    return result
  } catch (error) {
    endTiming({ ...metadata, error: true })
    throw error
  }
}

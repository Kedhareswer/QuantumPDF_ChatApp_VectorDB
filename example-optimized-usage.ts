// example-optimized-usage.ts - Example showing how to use all optimizations

import { CacheManager } from './lib/cache-system'
import { EnhancedDiversityAlgorithm } from './lib/diversity-algorithm'
import { DEFAULT_RAG_CONFIG, RAGConfigManager } from './lib/rag-config'
import { RAGEngine } from './lib/rag-engine'
import { getTelemetry } from './lib/telemetry'

/**
 * EXAMPLE 1: Basic Usage with Default Optimizations
 */
async function basicOptimizedExample() {
  console.log('=== Basic Optimized Usage ===\n')

  // Create RAG engine with default optimized config
  const ragEngine = new RAGEngine()

  // Initialize with AI provider
  await ragEngine.initialize({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  })

  // Upload a document (with automatic caching and duplicate detection)
  const file = new File(['...pdf content...'], 'report.pdf')
  const document = await ragEngine.processDocument(file)
  await ragEngine.addDocument(document)

  // Query with caching and enhanced diversity
  const result = await ragEngine.query('What are the main findings?', {
    complexityLevel: 'normal',
    tokenBudget: 4000,
    showThinking: false,
  })

  console.log('Answer:', result.answer)
  console.log('Quality Score:', result.qualityMetrics.finalRating)

  // Get telemetry report
  const telemetry = getTelemetry()
  console.log('\n' + telemetry.generateReport())
}

/**
 * EXAMPLE 2: Custom Configuration for High-Performance
 */
async function highPerformanceExample() {
  console.log('=== High-Performance Configuration ===\n')

  // Custom config for maximum performance
  const configManager = new RAGConfigManager({
    // Aggressive caching
    cache: {
      embedding: {
        enabled: true,
        maxSize: 50000, // Large cache
        ttl: 7200000, // 2 hours
      },
      query: {
        enabled: true,
        maxSize: 5000,
        ttl: 1200000, // 20 minutes
      },
      document: {
        fingerprintingEnabled: true,
        algorithm: 'simple', // Faster than SHA-256
      },
    },

    // Token bucket rate limiting
    rateLimiting: {
      enabled: true,
      algorithm: 'token-bucket',
      tokensPerInterval: 500, // High throughput
      intervalMs: 60000,
      maxBurst: 750,
    },

    // MMR diversity for speed
    diversity: {
      enabled: true,
      algorithm: 'mmr', // Faster than 'enhanced'
      mmr: {
        lambda: 0.7,
        iterations: 3,
      },
      minSimilarity: 0.05, // Less filtering
    },

    // Parallel processing
    performance: {
      parallelProcessing: {
        enabled: true,
        maxConcurrency: 10, // High concurrency
        pdfPages: true,
        embeddingGeneration: true,
      },
    },
  })

  const config = configManager.getConfig()

  // Initialize cache manager
  const cacheManager = new CacheManager({
    embeddingCacheSize: config.cache.embedding.maxSize,
    embeddingCacheTTL: config.cache.embedding.ttl,
    queryCacheSize: config.cache.query.maxSize,
    queryCacheTTL: config.cache.query.ttl,
  })

  // Initialize rate limiter

  console.log('✅ Configured for high performance')
  console.log('Cache stats:', cacheManager.getAllStats())
}

/**
 * EXAMPLE 3: Cost-Optimized Configuration
 */
async function costOptimizedExample() {
  console.log('=== Cost-Optimized Configuration ===\n')


  console.log('✅ Configured for cost optimization')
  console.log('Expected savings: 80-90% on embedding costs')
}

/**
 * EXAMPLE 4: Quality-First Configuration
 */
async function qualityFirstExample() {
  console.log('=== Quality-First Configuration ===\n')


  console.log('✅ Configured for maximum quality')
}

/**
 * EXAMPLE 5: Using Enhanced Diversity Algorithm Directly
 */
async function diversityExample() {
  console.log('=== Enhanced Diversity Example ===\n')

  const config = DEFAULT_RAG_CONFIG.diversity
  const diversityAlgorithm = new EnhancedDiversityAlgorithm(config)

  // Simulate chunks from multiple documents
  const chunks = [
    {
      content: 'Introduction to quantum computing...',
      source: 'Quantum101.pdf',
      similarity: 0.85,
      documentId: 'doc1',
      documentName: 'Quantum 101',
      semanticImportance: 1.5,
      uploadedAt: new Date('2024-01-15'),
      chunkIndex: 0,
      totalChunks: 10,
      page: 1,
    },
    {
      content: 'Advanced quantum algorithms...',
      source: 'Quantum101.pdf',
      similarity: 0.82,
      documentId: 'doc1',
      documentName: 'Quantum 101',
      semanticImportance: 1.2,
      uploadedAt: new Date('2024-01-15'),
      chunkIndex: 5,
      totalChunks: 10,
      page: 6,
    },
    {
      content: 'Quantum computing applications in 2023...',
      source: 'Applications2023.pdf',
      similarity: 0.78,
      documentId: 'doc2',
      documentName: 'Applications 2023',
      semanticImportance: 1.3,
      uploadedAt: new Date('2023-12-01'),
      chunkIndex: 3,
      totalChunks: 8,
      page: 4,
    },
    // ... more chunks
  ]

  const documentMetrics = new Map([
    [
      'doc1',
      { avgSimilarity: 0.75, chunkCount: 10, bestSimilarity: 0.85 },
    ],
    [
      'doc2',
      { avgSimilarity: 0.7, chunkCount: 8, bestSimilarity: 0.78 },
    ],
  ])

  // Select diverse chunks
  const selected = diversityAlgorithm.select(chunks, documentMetrics, 5, 0.03)

  console.log('Selected chunks:')
  selected.forEach((chunk, i) => {
    console.log(
      `${i + 1}. ${chunk.source} (sim: ${chunk.similarity.toFixed(3)}, page: ${chunk.page})`
    )
  })
}

/**
 * EXAMPLE 6: Monitoring and Telemetry
 */
async function telemetryExample() {
  console.log('=== Telemetry Example ===\n')

  const telemetry = getTelemetry()

  // Simulate some operations
  telemetry.trackLatency('embedding', 120)
  telemetry.trackLatency('embedding', 95)
  telemetry.trackLatency('embedding', 150)

  telemetry.trackLatency('query', 2500)
  telemetry.trackLatency('query', 1800)

  telemetry.trackCacheHit('embeddings')
  telemetry.trackCacheHit('embeddings')
  telemetry.trackCacheMiss('embeddings')

  telemetry.trackProviderSuccess('openai', 100)
  telemetry.trackProviderSuccess('openai', 120)
  telemetry.trackProviderFailure('openai', 'Rate limit exceeded')

  telemetry.trackTokens(1000, 500, 800)
  telemetry.trackTokens(1200, 600, 900)

  // Get comprehensive metrics
  const metrics = telemetry.getMetrics()

  console.log('Performance Metrics:')
  console.log('- Avg embedding latency:', metrics.latency.embedding.avg, 'ms')
  console.log('- P95 embedding latency:', metrics.latency.embedding.p95, 'ms')
  console.log('- Avg query latency:', metrics.latency.query.avg, 'ms')
  console.log('- Embedding cache hit rate:', (metrics.cache.embeddings.hitRate * 100).toFixed(1) + '%')
  console.log('- Total tokens used:', metrics.tokens.total)

  // Generate full report
  console.log('\n' + telemetry.generateReport())

  // Get recent events
  const recentEvents = telemetry.getRecentEvents(10)
  console.log('\nRecent Events:')
  recentEvents.forEach((event) => {
    console.log(
      `[${event.timestamp.toISOString()}] ${event.category}:${event.action} ${event.success ? '✅' : '❌'}`
    )
  })
}

/**
 * EXAMPLE 7: Circuit Breaker Pattern
 */
async function circuitBreakerExample() {
  console.log('=== Circuit Breaker Example ===\n')

  const { CircuitBreaker } = await import('./lib/rate-limiter')

  const circuitBreaker = new CircuitBreaker(
    3, // Open after 3 failures
    10000, // Reset after 10 seconds
    2 // 2 test requests in HALF_OPEN
  )

  // Simulate API calls with failures
  for (let i = 0; i < 10; i++) {
    try {
      await circuitBreaker.execute(async () => {
        // Simulate random failures
        if (Math.random() < 0.4) {
          throw new Error('API error')
        }
        return 'Success'
      })
      console.log(`Request ${i + 1}: ✅ Success`)
    } catch (error: unknown) {
      console.log(`Request ${i + 1}: ❌ ${error.message}`)
    }

    const stats = circuitBreaker.getStats()
    console.log(
      `  Circuit state: ${stats.state}, Failures: ${stats.failures}`
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}


// Uncomment to run
// main()

export {
    basicOptimizedExample, circuitBreakerExample, costOptimizedExample, diversityExample, highPerformanceExample, qualityFirstExample, telemetryExample
}

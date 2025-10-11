// example-optimized-usage.ts - Example showing how to use all optimizations

import { RAGEngine } from './lib/rag-engine'
import { RAGConfigManager, DEFAULT_RAG_CONFIG } from './lib/rag-config'
import { CacheManager } from './lib/cache-system'
import { createRateLimiter } from './lib/rate-limiter'
import { EnhancedDiversityAlgorithm } from './lib/diversity-algorithm'
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
  const rateLimiter = createRateLimiter({
    algorithm: config.rateLimiting.algorithm,
    tokensPerInterval: config.rateLimiting.tokensPerInterval,
    intervalMs: config.rateLimiting.intervalMs,
    maxBurst: config.rateLimiting.maxBurst,
  })

  console.log('✅ Configured for high performance')
  console.log('Cache stats:', cacheManager.getAllStats())
}

/**
 * EXAMPLE 3: Cost-Optimized Configuration
 */
async function costOptimizedExample() {
  console.log('=== Cost-Optimized Configuration ===\n')

  const configManager = new RAGConfigManager({
    // Maximum caching to minimize API calls
    cache: {
      embedding: {
        enabled: true,
        maxSize: 100000, // Very large cache
        ttl: 14400000, // 4 hours
      },
      query: {
        enabled: true,
        maxSize: 10000,
        ttl: 1800000, // 30 minutes
      },
    },

    // Batch processing to reduce calls
    embeddings: {
      cacheEnabled: true,
      batchSize: 100, // Large batches
      batchDelay: 200, // Slower but more efficient
    },

    // Aggressive rate limiting to avoid overage fees
    rateLimiting: {
      enabled: true,
      algorithm: 'adaptive',
      tokensPerInterval: 100,
      intervalMs: 60000,
      maxBurst: 120,
      adaptiveBackoff: {
        enabled: true,
        initialDelay: 200,
        maxDelay: 10000,
        multiplier: 2,
      },
    },

    // Simple diversity (less processing)
    diversity: {
      algorithm: 'basic',
    },

    // Lower token budgets
    query: {
      tokenBudget: {
        default: 3000,
        simple: { context: 70, critique: 0, refinement: 30 },
        normal: { context: 50, critique: 25, refinement: 25 },
        complex: { context: 40, critique: 30, refinement: 30 },
      },
    },
  })

  console.log('✅ Configured for cost optimization')
  console.log('Expected savings: 80-90% on embedding costs')
}

/**
 * EXAMPLE 4: Quality-First Configuration
 */
async function qualityFirstExample() {
  console.log('=== Quality-First Configuration ===\n')

  const configManager = new RAGConfigManager({
    // Enhanced diversity for best results
    diversity: {
      enabled: true,
      algorithm: 'enhanced', // Multi-stage selection
      enhanced: {
        baseChunksPerDoc: 'weighted',
        maxChunksPerDoc: 60, // Less single-doc dominance
        similarityWeight: 0.5, // Balance with other factors
        importanceWeight: 0.3,
        temporalWeight: 0.1, // Consider time spread
        positionWeight: 0.05, // Consider document position
        topicWeight: 0.05, // Consider topic diversity
        similarityExponent: 0.8,
        importanceExponent: 0.6,
      },
      mmr: {
        lambda: 0.6, // More diversity
        iterations: 5, // More iterations
      },
    },

    // Always use complex 3-phase processing
    query: {
      tokenBudget: {
        default: 8000, // Large budget for quality
        simple: { context: 40, critique: 30, refinement: 30 }, // Even simple gets critique
        normal: { context: 35, critique: 35, refinement: 30 },
        complex: { context: 30, critique: 40, refinement: 30 },
      },
      confidenceThresholds: {
        earlyTermination: 0.95, // Rarely skip phases
        rerank: 0.6,
        fallback: 0.4,
      },
    },

    // Comprehensive validation
    validation: {
      enabled: true,
      strictMode: true,
      checks: {
        embeddingDimensions: true,
        embeddingValues: true,
        documentStructure: true,
        metadataCompleteness: true,
      },
    },
  })

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
    } catch (error: any) {
      console.log(`Request ${i + 1}: ❌ ${error.message}`)
    }

    const stats = circuitBreaker.getStats()
    console.log(
      `  Circuit state: ${stats.state}, Failures: ${stats.failures}`
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 QuantumPDF Optimization Examples\n')
  console.log('=' .repeat(60) + '\n')

  try {
    // Run all examples
    // await basicOptimizedExample()
    // await highPerformanceExample()
    // await costOptimizedExample()
    // await qualityFirstExample()
    await diversityExample()
    // await telemetryExample()
    // await circuitBreakerExample()

    console.log('\n✅ All examples completed successfully!')
  } catch (error) {
    console.error('\n❌ Error running examples:', error)
  }
}

// Uncomment to run
// main()

export {
  basicOptimizedExample,
  highPerformanceExample,
  costOptimizedExample,
  qualityFirstExample,
  diversityExample,
  telemetryExample,
  circuitBreakerExample,
}

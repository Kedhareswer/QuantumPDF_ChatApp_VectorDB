// lib/rag-config.ts - Centralized configuration for RAG system

export interface RAGConfiguration {
  // Chunking parameters
  chunking: {
    // Adaptive chunk sizes based on document length
    small: { size: number; overlap: number }  // < 5k chars
    medium: { size: number; overlap: number } // 5k-10k chars
    large: { size: number; overlap: number }  // 10k-20k chars
    xlarge: { size: number; overlap: number } // > 20k chars
    // Minimum and maximum bounds
    minSize: number
    maxSize: number
    overlapPercentage: number
    // Sentence boundary detection
    sentenceBoundaryAware: boolean
    // Semantic chunking options
    semanticChunking: boolean
  }

  // Embedding parameters
  embeddings: {
    // Cache configuration
    cacheEnabled: boolean
    cacheTTL: number // milliseconds
    maxCacheSize: number // max items
    // Batch processing
    batchSize: number
    batchDelay: number // milliseconds between batches
    // Dimension reduction
    dimensionReduction: {
      enabled: boolean
      targetDimension: number
      method: 'pca' | 'truncate'
    }
  }

  // Rate limiting
  rateLimiting: {
    enabled: boolean
    algorithm: 'fixed' | 'token-bucket' | 'adaptive'
    // Token bucket parameters
    tokensPerInterval: number
    intervalMs: number
    maxBurst: number
    // Adaptive backoff
    adaptiveBackoff: {
      enabled: boolean
      initialDelay: number
      maxDelay: number
      multiplier: number
    }
  }

  // Query processing
  query: {
    // Token allocation by complexity
    tokenBudget: {
      default: number
      simple: {
        context: number // percentage
        critique: number
        refinement: number
      }
      normal: {
        context: number
        critique: number
        refinement: number
      }
      complex: {
        context: number
        critique: number
        refinement: number
      }
    }
    // Optimal chunk limits per question type
    chunkLimits: {
      summary: number
      analysis: number
      timeline: number
      data: number
      process: number
      comparison: number
      general: number
    }
    // Confidence scoring
    confidenceThresholds: {
      earlyTermination: number // skip phase 2/3 if confidence > this
      rerank: number // trigger reranking if < this
      fallback: number // use fallback if < this
    }
  }

  // Diversity algorithm
  diversity: {
    enabled: boolean
    algorithm: 'basic' | 'mmr' | 'enhanced'
    // MMR parameters
    mmr: {
      lambda: number // 0-1, balance between relevance and diversity
      iterations: number
    }
    // Enhanced diversity parameters
    enhanced: {
      // Multi-document fairness
      baseChunksPerDoc: 'equal' | 'weighted'
      maxChunksPerDoc: number // percentage of total
      // Scoring weights
      similarityWeight: number
      importanceWeight: number
      temporalWeight: number
      positionWeight: number
      topicWeight: number
      // Composite score formula exponents
      similarityExponent: number
      importanceExponent: number
    }
    // Minimum similarity threshold
    minSimilarity: number
  }

  // Hybrid search
  hybridSearch: {
    weights: {
      semantic: number // 0-1
      keyword: number // 0-1 (should sum to 1 with semantic)
      temporal: number // boost for recent docs
      position: number // boost for intro/conclusion
    }
    // Reranking
    reranking: {
      enabled: boolean
      stage1Limit: number // initial retrieval
      stage2Limit: number // after reranking
      crossEncoderModel: string | null
    }
  }

  // Semantic importance scoring
  semanticImportance: {
    // Docling metadata boosts
    docling: {
      heading: number
      headingLevelDecay: number // per level
      table: number
      list: number
      highConfidence: number // OCR confidence > 90
      pageAttribution: number
    }
    // Text-based heuristics
    heuristics: {
      keywordBoost: number // summary, conclusion, etc.
      structuredContent: number // bullets, lists
      dataBoost: number // numbers, tables
    }
    maxImportance: number
  }

  // Caching
  cache: {
    embedding: {
      enabled: boolean
      maxSize: number
      ttl: number // milliseconds
    }
    query: {
      enabled: boolean
      maxSize: number
      ttl: number // milliseconds
    }
    document: {
      fingerprintingEnabled: boolean
      algorithm: 'sha256' | 'xxhash' | 'simple'
    }
  }

  // Provider fallback
  providerFallback: {
    enabled: boolean
    cascade: string[] // ordered list of providers to try
    maxRetries: number
    retryDelay: number // milliseconds
    circuitBreaker: {
      enabled: boolean
      failureThreshold: number // failures before opening circuit
      resetTimeout: number // milliseconds
      halfOpenRequests: number // test requests when half-open
    }
  }

  // Monitoring
  monitoring: {
    enabled: boolean
    telemetry: {
      trackLatency: boolean
      trackTokenUsage: boolean
      trackCacheHits: boolean
      trackProviderFailures: boolean
    }
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error'
      verbose: boolean
    }
  }

  // Performance
  performance: {
    parallelProcessing: {
      enabled: boolean
      maxConcurrency: number
      pdfPages: boolean
      embeddingGeneration: boolean
    }
    streaming: {
      enabled: boolean
      largePDFThreshold: number // bytes
      chunkSize: number // bytes for streaming
    }
    connectionPooling: {
      enabled: boolean
      maxConnections: number
      idleTimeout: number // milliseconds
    }
  }

  // Validation
  validation: {
    enabled: boolean
    strictMode: boolean
    checks: {
      embeddingDimensions: boolean
      embeddingValues: boolean // check for NaN/Infinity
      documentStructure: boolean
      metadataCompleteness: boolean
    }
  }
}

// Default configuration
export const DEFAULT_RAG_CONFIG: RAGConfiguration = {
  chunking: {
    small: { size: 400, overlap: 40 },
    medium: { size: 600, overlap: 60 },
    large: { size: 800, overlap: 80 },
    xlarge: { size: 1000, overlap: 100 },
    minSize: 300,
    maxSize: 1200,
    overlapPercentage: 0.1,
    sentenceBoundaryAware: true,
    semanticChunking: true,
  },

  embeddings: {
    cacheEnabled: true,
    cacheTTL: 3600000, // 1 hour
    maxCacheSize: 10000,
    batchSize: 50,
    batchDelay: 100,
    dimensionReduction: {
      enabled: false,
      targetDimension: 768,
      method: 'truncate',
    },
  },

  rateLimiting: {
    enabled: true,
    algorithm: 'token-bucket',
    tokensPerInterval: 100,
    intervalMs: 60000, // 1 minute
    maxBurst: 150,
    adaptiveBackoff: {
      enabled: true,
      initialDelay: 100,
      maxDelay: 5000,
      multiplier: 2,
    },
  },

  query: {
    tokenBudget: {
      default: 4000,
      simple: { context: 60, critique: 0, refinement: 40 },
      normal: { context: 40, critique: 30, refinement: 30 },
      complex: { context: 30, critique: 40, refinement: 30 },
    },
    chunkLimits: {
      summary: 8,
      analysis: 6,
      timeline: 10,
      data: 5,
      process: 7,
      comparison: 8,
      general: 5,
    },
    confidenceThresholds: {
      earlyTermination: 0.9,
      rerank: 0.5,
      fallback: 0.3,
    },
  },

  diversity: {
    enabled: true,
    algorithm: 'enhanced',
    mmr: {
      lambda: 0.7,
      iterations: 3,
    },
    enhanced: {
      baseChunksPerDoc: 'weighted',
      maxChunksPerDoc: 70, // 70% of total
      similarityWeight: 0.6,
      importanceWeight: 0.3,
      temporalWeight: 0.05,
      positionWeight: 0.03,
      topicWeight: 0.02,
      similarityExponent: 0.8,
      importanceExponent: 0.6,
    },
    minSimilarity: 0.03,
  },

  hybridSearch: {
    weights: {
      semantic: 0.6,
      keyword: 0.4,
      temporal: 0.1,
      position: 0.05,
    },
    reranking: {
      enabled: true,
      stage1Limit: 100,
      stage2Limit: 20,
      crossEncoderModel: null,
    },
  },

  semanticImportance: {
    docling: {
      heading: 0.4,
      headingLevelDecay: 0.05,
      table: 0.35,
      list: 0.15,
      highConfidence: 0.15,
      pageAttribution: 0.1,
    },
    heuristics: {
      keywordBoost: 0.2,
      structuredContent: 0.1,
      dataBoost: 0.15,
    },
    maxImportance: 2.5,
  },

  cache: {
    embedding: {
      enabled: true,
      maxSize: 10000,
      ttl: 3600000, // 1 hour
    },
    query: {
      enabled: true,
      maxSize: 1000,
      ttl: 600000, // 10 minutes
    },
    document: {
      fingerprintingEnabled: true,
      algorithm: 'simple',
    },
  },

  providerFallback: {
    enabled: true,
    cascade: ['primary', 'openai', 'huggingface', 'local'],
    maxRetries: 3,
    retryDelay: 1000,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 3,
    },
  },

  monitoring: {
    enabled: true,
    telemetry: {
      trackLatency: true,
      trackTokenUsage: true,
      trackCacheHits: true,
      trackProviderFailures: true,
    },
    logging: {
      level: 'info',
      verbose: false,
    },
  },

  performance: {
    parallelProcessing: {
      enabled: true,
      maxConcurrency: 5,
      pdfPages: true,
      embeddingGeneration: true,
    },
    streaming: {
      enabled: true,
      largePDFThreshold: 10000000, // 10MB
      chunkSize: 1024 * 1024, // 1MB
    },
    connectionPooling: {
      enabled: true,
      maxConnections: 10,
      idleTimeout: 30000, // 30 seconds
    },
  },

  validation: {
    enabled: true,
    strictMode: false,
    checks: {
      embeddingDimensions: true,
      embeddingValues: true,
      documentStructure: true,
      metadataCompleteness: false,
    },
  },
}

// Configuration manager
export class RAGConfigManager {
  private config: RAGConfiguration

  constructor(customConfig?: Partial<RAGConfiguration>) {
    this.config = this.mergeConfig(DEFAULT_RAG_CONFIG, customConfig)
  }

  getConfig(): RAGConfiguration {
    return this.config
  }

  updateConfig(updates: Partial<RAGConfiguration>): void {
    this.config = this.mergeConfig(this.config, updates)
  }

  resetToDefaults(): void {
    this.config = { ...DEFAULT_RAG_CONFIG }
  }

  // Deep merge utility
  private mergeConfig(
    base: RAGConfiguration,
    updates?: Partial<RAGConfiguration>
  ): RAGConfiguration {
    if (!updates) return base

    const merged = { ...base }

    for (const key in updates) {
      const value = updates[key as keyof RAGConfiguration]
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        merged[key as keyof RAGConfiguration] = {
          ...(base[key as keyof RAGConfiguration] as any),
          ...(value as any),
        }
      } else {
        merged[key as keyof RAGConfiguration] = value as any
      }
    }

    return merged
  }

  // Validation
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate token budget percentages sum to 100
    const { simple, normal, complex } = this.config.query.tokenBudget
    for (const level of [simple, normal, complex]) {
      const sum = level.context + level.critique + level.refinement
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(`Token allocation must sum to 100%, got ${sum}%`)
      }
    }

    // Validate hybrid search weights
    const semanticWeight = this.config.hybridSearch.weights.semantic
    const keywordWeight = this.config.hybridSearch.weights.keyword
    if (Math.abs(semanticWeight + keywordWeight - 1) > 0.01) {
      errors.push(`Semantic + keyword weights must sum to 1.0`)
    }

    // Validate cache sizes
    if (this.config.cache.embedding.maxSize < 100) {
      errors.push(`Embedding cache size too small (min 100)`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

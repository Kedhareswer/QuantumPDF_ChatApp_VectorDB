// lib/cache-system.ts - Comprehensive caching system for embeddings, queries, and documents

export interface CacheEntry<T> {
  value: T
  timestamp: number
  hits: number
  size: number // approximate size in bytes
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  maxSize: number
  hitRate: number
}

// Base cache interface
export abstract class BaseCache<K, V> {
  protected cache: Map<string, CacheEntry<V>> = new Map()
  protected maxSize: number
  protected ttl: number
  protected stats: CacheStats

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize
    this.ttl = ttl
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
      hitRate: 0,
    }
  }

  abstract generateKey(key: K): string
  abstract calculateSize(value: V): number

  get(key: K): V | null {
    const keyStr = this.generateKey(key)
    const entry = this.cache.get(keyStr)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(keyStr)
      this.stats.evictions++
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Update hits
    entry.hits++
    this.stats.hits++
    this.updateHitRate()

    return entry.value
  }

  set(key: K, value: V): void {
    const keyStr = this.generateKey(key)
    const size = this.calculateSize(value)

    // Check if we need to evict
    while (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
    }

    this.cache.set(keyStr, entry)
    this.stats.size = this.cache.size
  }

  has(key: K): boolean {
    const keyStr = this.generateKey(key)
    const entry = this.cache.get(keyStr)

    if (!entry) return false

    // Check expiration
    const now = Date.now()
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(keyStr)
      this.stats.evictions++
      return false
    }

    return true
  }

  delete(key: K): boolean {
    const keyStr = this.generateKey(key)
    const deleted = this.cache.delete(keyStr)
    if (deleted) {
      this.stats.size = this.cache.size
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.stats.size = 0
    this.stats.evictions += this.cache.size
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return

    // Find entry with least hits and oldest timestamp
    let oldestKey: string | null = null
    let oldestScore = Infinity

    for (const [key, entry] of this.cache.entries()) {
      const age = Date.now() - entry.timestamp
      const score = entry.hits / (age / 1000) // hits per second
      if (score < oldestScore) {
        oldestScore = score
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
      this.stats.size = this.cache.size
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

// Embedding cache
export class EmbeddingCache extends BaseCache<string, number[]> {
  generateKey(text: string): string {
    // Use simple hash for text
    return this.simpleHash(text)
  }

  calculateSize(embedding: number[]): number {
    // Each number is 8 bytes (float64)
    return embedding.length * 8
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
}

// Query result cache
export interface QueryCacheKey {
  question: string
  filters?: string
  complexity?: string
  tokenBudget?: number
}

export interface QueryCacheValue {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: any[]
  qualityMetrics: any
  tokenUsage: any
}

export class QueryCache extends BaseCache<QueryCacheKey, QueryCacheValue> {
  generateKey(key: QueryCacheKey): string {
    const parts = [
      key.question,
      key.filters || '',
      key.complexity || '',
      key.tokenBudget?.toString() || '',
    ]
    return this.simpleHash(parts.join('|'))
  }

  calculateSize(value: QueryCacheValue): number {
    // Rough estimate
    const jsonString = JSON.stringify(value)
    return jsonString.length * 2 // UTF-16 characters
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(36)
  }
}

// Document fingerprinting for duplicate detection
export class DocumentFingerprint {
  private algorithm: 'sha256' | 'xxhash' | 'simple'

  constructor(algorithm: 'sha256' | 'xxhash' | 'simple' = 'simple') {
    this.algorithm = algorithm
  }

  async generate(content: string): Promise<string> {
    switch (this.algorithm) {
      case 'sha256':
        return await this.sha256(content)
      case 'simple':
      default:
        return this.simpleHash(content)
    }
  }

  private async sha256(content: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    return this.simpleHash(content)
  }

  private simpleHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  // Content-based similarity for near-duplicate detection
  similarity(fingerprint1: string, fingerprint2: string): number {
    if (fingerprint1 === fingerprint2) return 1.0

    // For simple hashes, we can check if they're close
    const num1 = parseInt(fingerprint1, 36)
    const num2 = parseInt(fingerprint2, 36)

    if (isNaN(num1) || isNaN(num2)) return 0

    const diff = Math.abs(num1 - num2)
    const max = Math.max(Math.abs(num1), Math.abs(num2))

    if (max === 0) return 1.0

    return 1 - Math.min(diff / max, 1)
  }
}

// Document cache for tracking uploaded documents
export interface DocumentCacheEntry {
  id: string
  name: string
  fingerprint: string
  size: number
  uploadedAt: Date
  lastAccessedAt: Date
  accessCount: number
}

export class DocumentCache {
  private cache: Map<string, DocumentCacheEntry> = new Map()
  private fingerprintMap: Map<string, string> = new Map() // fingerprint -> id
  private fingerprinter: DocumentFingerprint

  constructor(algorithm: 'sha256' | 'xxhash' | 'simple' = 'simple') {
    this.fingerprinter = new DocumentFingerprint(algorithm)
  }

  async add(
    id: string,
    name: string,
    content: string,
    size: number
  ): Promise<{ isDuplicate: boolean; existingId?: string }> {
    const fingerprint = await this.fingerprinter.generate(content)

    // Check for duplicates
    const existingId = this.fingerprintMap.get(fingerprint)
    if (existingId) {
      const existing = this.cache.get(existingId)
      if (existing) {
        existing.lastAccessedAt = new Date()
        existing.accessCount++
        return { isDuplicate: true, existingId }
      }
    }

    // Add new document
    const entry: DocumentCacheEntry = {
      id,
      name,
      fingerprint,
      size,
      uploadedAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 1,
    }

    this.cache.set(id, entry)
    this.fingerprintMap.set(fingerprint, id)

    return { isDuplicate: false }
  }

  get(id: string): DocumentCacheEntry | null {
    const entry = this.cache.get(id)
    if (entry) {
      entry.lastAccessedAt = new Date()
      entry.accessCount++
    }
    return entry || null
  }

  has(id: string): boolean {
    return this.cache.has(id)
  }

  hasDuplicate(fingerprint: string): string | null {
    return this.fingerprintMap.get(fingerprint) || null
  }

  delete(id: string): boolean {
    const entry = this.cache.get(id)
    if (entry) {
      this.fingerprintMap.delete(entry.fingerprint)
      return this.cache.delete(id)
    }
    return false
  }

  clear(): void {
    this.cache.clear()
    this.fingerprintMap.clear()
  }

  getAll(): DocumentCacheEntry[] {
    return Array.from(this.cache.values())
  }

  size(): number {
    return this.cache.size
  }
}

// Unified cache manager
export class CacheManager {
  public embeddings: EmbeddingCache
  public queries: QueryCache
  public documents: DocumentCache

  constructor(config: {
    embeddingCacheSize?: number
    embeddingCacheTTL?: number
    queryCacheSize?: number
    queryCacheTTL?: number
    fingerprintAlgorithm?: 'sha256' | 'xxhash' | 'simple'
  } = {}) {
    this.embeddings = new EmbeddingCache(
      config.embeddingCacheSize || 10000,
      config.embeddingCacheTTL || 3600000 // 1 hour
    )

    this.queries = new QueryCache(
      config.queryCacheSize || 1000,
      config.queryCacheTTL || 600000 // 10 minutes
    )

    this.documents = new DocumentCache(config.fingerprintAlgorithm || 'simple')
  }

  clearAll(): void {
    this.embeddings.clear()
    this.queries.clear()
    this.documents.clear()
  }

  getAllStats(): {
    embeddings: CacheStats
    queries: CacheStats
    documents: { count: number }
  } {
    return {
      embeddings: this.embeddings.getStats(),
      queries: this.queries.getStats(),
      documents: { count: this.documents.size() },
    }
  }
}

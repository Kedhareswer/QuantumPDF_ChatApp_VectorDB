import { logger } from "./logger"
/**
 * Advanced Query Processing Module
 * 
 * Implements:
 * - Query Response Cache (full query→response caching)
 * - HyDE (Hypothetical Document Embeddings)
 * - Step-back Prompting for complex queries
 * - LLM-based Query Rewriting/Clarification
 * - Query Classification and Routing
 * 
 * TEAM_001: Initial implementation of advanced query processing
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface QueryCacheEntry {
  query: string
  normalizedQuery: string
  response: CachedResponse
  timestamp: number
  hitCount: number
  documentHash: string // Hash of document IDs to invalidate on document changes
}

export interface CachedResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: Array<{
    content: string
    source: string
    similarity: number
  }>
  qualityMetrics?: {
    accuracyScore: number
    completenessScore: number
    clarityScore: number
    confidenceScore: number
    finalRating: number
  }
}

export interface QueryAnalysis {
  originalQuery: string
  rewrittenQuery: string
  queryType: QueryType
  complexity: 'simple' | 'moderate' | 'complex'
  requiresHyDE: boolean
  requiresStepBack: boolean
  alternativeQueries: string[]
  hypotheticalAnswer?: string
  stepBackQuestion?: string
  confidence: number
}

export type QueryType = 
  | 'factual'           // Simple fact lookup
  | 'analytical'        // Requires analysis/synthesis
  | 'comparative'       // Compare/contrast
  | 'procedural'        // How-to, steps
  | 'definitional'      // What is X?
  | 'causal'            // Why/cause-effect
  | 'temporal'          // When/timeline
  | 'aggregative'       // Summary/overview
  | 'exploratory'       // Open-ended exploration

export interface QueryProcessorConfig {
  cacheEnabled: boolean
  cacheTTLMs: number
  maxCacheSize: number
  hydeEnabled: boolean
  stepBackEnabled: boolean
  rewriteEnabled: boolean
  minQueryLength: number
  maxAlternativeQueries: number
}

// ============================================================================
// QUERY RESPONSE CACHE
// ============================================================================

class QueryResponseCache {
  private cache: Map<string, QueryCacheEntry> = new Map()
  private config: QueryProcessorConfig
  
  constructor(config: Partial<QueryProcessorConfig> = {}) {
    this.config = {
      cacheEnabled: true,
      cacheTTLMs: 30 * 60 * 1000, // 30 minutes
      maxCacheSize: 500,
      hydeEnabled: true,
      stepBackEnabled: true,
      rewriteEnabled: true,
      minQueryLength: 3,
      maxAlternativeQueries: 3,
      ...config
    }
  }

  /**
   * Normalize query for cache key generation
   * Handles variations in phrasing, punctuation, and whitespace
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .split(' ')
      .filter(word => word.length > 2) // Remove short words
      .sort()                     // Sort for order-independence
      .join(' ')
  }

  /**
   * Generate document hash for cache invalidation
   */
  generateDocumentHash(documentIds: string[]): string {
    return documentIds.sort().join('|')
  }

  /**
   * Check if a cached response exists and is valid
   */
  get(query: string, documentHash: string): CachedResponse | null {
    if (!this.config.cacheEnabled) return null

    const normalizedQuery = this.normalizeQuery(query)
    const entry = this.cache.get(normalizedQuery)

    if (!entry) return null

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.cacheTTLMs) {
      this.cache.delete(normalizedQuery)
      logger.debug(`QueryCache: Entry expired for "${query.substring(0, 50)}..."`)
      return null
    }

    // Check document hash (invalidate if documents changed)
    if (entry.documentHash !== documentHash) {
      this.cache.delete(normalizedQuery)
      logger.debug(`QueryCache: Entry invalidated due to document changes`)
      return null
    }

    // Update hit count
    entry.hitCount++
    logger.debug(`QueryCache: HIT for "${query.substring(0, 50)}..." (hits: ${entry.hitCount})`)
    
    return entry.response
  }

  /**
   * Store a response in the cache
   */
  set(query: string, response: CachedResponse, documentHash: string): void {
    if (!this.config.cacheEnabled) return

    const normalizedQuery = this.normalizeQuery(query)

    // Evict old entries if cache is full (LRU-style)
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest()
    }

    const entry: QueryCacheEntry = {
      query,
      normalizedQuery,
      response,
      timestamp: Date.now(),
      hitCount: 0,
      documentHash
    }

    this.cache.set(normalizedQuery, entry)
    logger.debug(`QueryCache: Stored response for "${query.substring(0, 50)}..."`)
  }

  /**
   * Evict oldest/least-used entries
   */
  private evictOldest(): void {
    // Find entries to evict (oldest with lowest hit count)
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        score: entry.hitCount / (Date.now() - entry.timestamp + 1) // Higher = more valuable
      }))
      .sort((a, b) => a.score - b.score)

    // Remove bottom 10%
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i].key)
    }
    logger.debug(`QueryCache: Evicted ${toRemove} entries`)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    logger.debug('QueryCache: Cleared all entries')
  }

  /**
   * Invalidate entries for specific documents
   */
  invalidateForDocuments(documentIds: string[]): void {
    let invalidated = 0
    
    for (const [key, entry] of this.cache.entries()) {
      // Check if any of the document IDs are in the entry's hash
      if (documentIds.some(id => entry.documentHash.includes(id))) {
        this.cache.delete(key)
        invalidated++
      }
    }
    
    if (invalidated > 0) {
      logger.debug(`QueryCache: Invalidated ${invalidated} entries for document changes`)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    const entries = Array.from(this.cache.values())
    const totalHits = entries.reduce((sum, e) => sum + e.hitCount, 0)
    const avgHits = entries.length > 0 ? totalHits / entries.length : 0
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: avgHits
    }
  }
}

// ============================================================================
// QUERY PROCESSOR
// ============================================================================

export class QueryProcessor {
  private cache: QueryResponseCache
  private config: QueryProcessorConfig
  private aiClient: unknown // Will be injected

  constructor(config: Partial<QueryProcessorConfig> = {}) {
    this.config = {
      cacheEnabled: true,
      cacheTTLMs: 30 * 60 * 1000,
      maxCacheSize: 500,
      hydeEnabled: true,
      stepBackEnabled: true,
      rewriteEnabled: true,
      minQueryLength: 3,
      maxAlternativeQueries: 3,
      ...config
    }
    this.cache = new QueryResponseCache(this.config)
  }

  /**
   * Set the AI client for LLM operations
   */
  setAIClient(client: unknown): void {
    this.aiClient = client
  }

  /**
   * Check cache for existing response
   */
  getCachedResponse(query: string, documentIds: string[]): CachedResponse | null {
    const documentHash = this.cache.generateDocumentHash(documentIds)
    return this.cache.get(query, documentHash)
  }

  /**
   * Store response in cache
   */
  cacheResponse(query: string, response: CachedResponse, documentIds: string[]): void {
    const documentHash = this.cache.generateDocumentHash(documentIds)
    this.cache.set(query, response, documentHash)
  }

  /**
   * Invalidate cache when documents change
   */
  invalidateCache(documentIds: string[]): void {
    this.cache.invalidateForDocuments(documentIds)
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  // ============================================================================
  // QUERY ANALYSIS & CLASSIFICATION
  // ============================================================================

  /**
   * Analyze and classify a query to determine optimal processing strategy
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const queryLower = query.toLowerCase().trim()
    
    // Classify query type
    const queryType = this.classifyQueryType(queryLower)
    
    // Determine complexity
    const complexity = this.assessComplexity(queryLower, queryType)
    
    // Determine if advanced techniques are needed
    const requiresHyDE = this.shouldUseHyDE(queryLower, queryType, complexity)
    const requiresStepBack = this.shouldUseStepBack(queryLower, queryType, complexity)
    
    // Initialize analysis result
    const analysis: QueryAnalysis = {
      originalQuery: query,
      rewrittenQuery: query,
      queryType,
      complexity,
      requiresHyDE,
      requiresStepBack,
      alternativeQueries: [],
      confidence: 0.8
    }

    // Apply LLM-based query rewriting if enabled and beneficial
    if (this.config.rewriteEnabled && this.aiClient && complexity !== 'simple') {
      try {
        const rewriteResult = await this.rewriteQuery(query, queryType)
        analysis.rewrittenQuery = rewriteResult.rewrittenQuery
        analysis.alternativeQueries = rewriteResult.alternatives
        analysis.confidence = rewriteResult.confidence
      } catch (error) {
        console.warn('Query rewriting failed, using original:', error)
      }
    }

    // Generate HyDE hypothetical answer if needed
    if (requiresHyDE && this.config.hydeEnabled && this.aiClient) {
      try {
        analysis.hypotheticalAnswer = await this.generateHypotheticalAnswer(query, queryType)
      } catch (error) {
        console.warn('HyDE generation failed:', error)
      }
    }

    // Generate step-back question if needed
    if (requiresStepBack && this.config.stepBackEnabled && this.aiClient) {
      try {
        analysis.stepBackQuestion = await this.generateStepBackQuestion(query, queryType)
      } catch (error) {
        console.warn('Step-back generation failed:', error)
      }
    }

    return analysis
  }

  /**
   * Classify the type of query
   */
  private classifyQueryType(query: string): QueryType {
    // Definitional patterns
    if (/^(what is|what are|define|definition of|meaning of)\b/i.test(query)) {
      return 'definitional'
    }
    
    // Procedural patterns
    if (/^(how to|how do|how can|steps to|process of|procedure for)\b/i.test(query)) {
      return 'procedural'
    }
    
    // Causal patterns
    if (/^(why|what causes|reason for|because of|due to)\b/i.test(query)) {
      return 'causal'
    }
    
    // Comparative patterns
    if (/\b(compare|contrast|difference|versus|vs\.?|between|similarities)\b/i.test(query)) {
      return 'comparative'
    }
    
    // Temporal patterns
    if (/^(when|what time|timeline|history of|evolution of)\b/i.test(query)) {
      return 'temporal'
    }
    
    // Aggregative patterns
    if (/^(summarize|summary|overview|list all|main points|key)\b/i.test(query)) {
      return 'aggregative'
    }
    
    // Analytical patterns
    if (/\b(analyze|analysis|evaluate|assess|implications|impact|effect)\b/i.test(query)) {
      return 'analytical'
    }
    
    // Exploratory patterns
    if (/\b(tell me about|explain|describe|what do you know|information about)\b/i.test(query)) {
      return 'exploratory'
    }
    
    // Default to factual
    return 'factual'
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(query: string, queryType: QueryType): 'simple' | 'moderate' | 'complex' {
    const words = query.split(/\s+/).length
    
    // Simple queries
    if (words <= 5 && ['factual', 'definitional'].includes(queryType)) {
      return 'simple'
    }
    
    // Complex queries
    if (words > 15 || ['analytical', 'comparative', 'causal'].includes(queryType)) {
      return 'complex'
    }
    
    // Multi-part questions
    if (/\b(and|also|additionally|furthermore|moreover)\b/i.test(query)) {
      return 'complex'
    }
    
    // Questions with conditions
    if (/\b(if|when|assuming|given that|in case)\b/i.test(query)) {
      return 'complex'
    }
    
    return 'moderate'
  }

  /**
   * Determine if HyDE should be used
   */
  private shouldUseHyDE(query: string, queryType: QueryType, complexity: string): boolean {
    // HyDE is most useful for:
    // - Exploratory queries where we need to find relevant documents
    // - Complex queries where direct matching might fail
    // - Queries with abstract concepts
    
    if (!this.config.hydeEnabled) return false
    
    const hydeTypes: QueryType[] = ['exploratory', 'analytical', 'aggregative']
    if (hydeTypes.includes(queryType)) return true
    
    if (complexity === 'complex') return true
    
    // Abstract concept detection
    const abstractPatterns = /\b(concept|theory|principle|approach|methodology|framework|paradigm)\b/i
    if (abstractPatterns.test(query)) return true
    
    return false
  }

  /**
   * Determine if step-back prompting should be used
   */
  private shouldUseStepBack(query: string, queryType: QueryType, complexity: string): boolean {
    // Step-back is useful for:
    // - Very specific questions that might benefit from broader context
    // - Complex analytical questions
    // - Causal questions
    
    if (!this.config.stepBackEnabled) return false
    
    const stepBackTypes: QueryType[] = ['causal', 'analytical', 'comparative']
    if (stepBackTypes.includes(queryType)) return true
    
    if (complexity === 'complex') return true
    
    // Specific detail questions
    const specificPatterns = /\b(specific|exactly|precisely|particular|certain)\b/i
    if (specificPatterns.test(query)) return true
    
    return false
  }

  // ============================================================================
  // LLM-BASED QUERY REWRITING
  // ============================================================================

  /**
   * Rewrite query using LLM for better retrieval
   */
  async rewriteQuery(query: string, queryType: QueryType): Promise<{
    rewrittenQuery: string
    alternatives: string[]
    confidence: number
  }> {
    if (!this.aiClient) {
      return { rewrittenQuery: query, alternatives: [], confidence: 0.5 }
    }

    const prompt = `You are a query optimization expert. Your task is to rewrite a user query to improve document retrieval.

ORIGINAL QUERY: "${query}"
QUERY TYPE: ${queryType}

TASK: Rewrite this query to be more specific and searchable while preserving the original intent.

GUIDELINES:
1. Expand abbreviations and acronyms
2. Add relevant synonyms or related terms
3. Make implicit context explicit
4. Remove filler words but keep essential meaning
5. Generate 2-3 alternative phrasings

OUTPUT FORMAT (use exactly this format):
REWRITTEN: [improved version of the query]
ALT1: [first alternative phrasing]
ALT2: [second alternative phrasing]
ALT3: [third alternative phrasing]
CONFIDENCE: [0.0-1.0 score for how well you understood the query]

Only output the formatted result, nothing else.`

    try {
      const messages = [
        { role: "system" as const, content: "You are a query optimization expert. Rewrite queries to improve document retrieval." },
        { role: "user" as const, content: prompt }
      ]

      const response = await this.aiClient.generateText(messages, { temperature: 0.3 })
      
      // Parse response
      const rewrittenMatch = response.match(/REWRITTEN:\s*(.+)/i)
      const alt1Match = response.match(/ALT1:\s*(.+)/i)
      const alt2Match = response.match(/ALT2:\s*(.+)/i)
      const alt3Match = response.match(/ALT3:\s*(.+)/i)
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i)

      const rewrittenQuery = rewrittenMatch?.[1]?.trim() || query
      const alternatives = [
        alt1Match?.[1]?.trim(),
        alt2Match?.[1]?.trim(),
        alt3Match?.[1]?.trim()
      ].filter(Boolean) as string[]
      
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7

      logger.debug(`QueryProcessor: Rewrote "${query.substring(0, 50)}..." → "${rewrittenQuery.substring(0, 50)}..."`)
      
      return { rewrittenQuery, alternatives, confidence }
    } catch (error) {
      console.error('Query rewriting failed:', error)
      return { rewrittenQuery: query, alternatives: [], confidence: 0.5 }
    }
  }

  // ============================================================================
  // HyDE (HYPOTHETICAL DOCUMENT EMBEDDINGS)
  // ============================================================================

  /**
   * Generate a hypothetical answer for HyDE
   * The idea: Generate what an ideal answer might look like, then use that
   * for embedding-based retrieval instead of the query itself
   */
  async generateHypotheticalAnswer(query: string, queryType: QueryType): Promise<string> {
    if (!this.aiClient) {
      throw new Error('AI client not available for HyDE')
    }

    const typeInstructions: Record<QueryType, string> = {
      factual: 'Write a brief, factual paragraph that would directly answer this question.',
      analytical: 'Write an analytical paragraph that examines the key aspects of this topic.',
      comparative: 'Write a paragraph comparing and contrasting the relevant elements.',
      procedural: 'Write a paragraph describing the steps or process involved.',
      definitional: 'Write a clear definition and explanation of the concept.',
      causal: 'Write a paragraph explaining the causes and effects.',
      temporal: 'Write a paragraph describing the timeline or historical context.',
      aggregative: 'Write a comprehensive summary covering the main points.',
      exploratory: 'Write an informative paragraph exploring the topic.'
    }

    const prompt = `Question: "${query}"

Write a 2–3 sentence passage from an authoritative document that directly answers this question.
Style: ${typeInstructions[queryType]}
Constraints: use domain-specific terms, include concrete details, write as document text (not "The document says...").`

    try {
      const messages = [
        { role: "system" as const, content: "You write short authoritative document passages used for semantic search. Be specific and factual." },
        { role: "user" as const, content: prompt }
      ]

      const response = await this.aiClient.generateText(messages, { temperature: 0.5 })
      
      // Clean up the response
      const hypotheticalAnswer = response
        .replace(/^(OUTPUT:|PASSAGE:|ANSWER:)/i, '')
        .trim()

      logger.debug(`HyDE: Generated hypothetical answer (${hypotheticalAnswer.length} chars)`)
      
      return hypotheticalAnswer
    } catch (error) {
      console.error('HyDE generation failed:', error)
      throw error
    }
  }

  // ============================================================================
  // STEP-BACK PROMPTING
  // ============================================================================

  /**
   * Generate a step-back question for complex queries
   * The idea: Ask a more general question first to get broader context,
   * then use that context to answer the specific question
   */
  async generateStepBackQuestion(query: string, queryType: QueryType): Promise<string> {
    if (!this.aiClient) {
      throw new Error('AI client not available for step-back prompting')
    }

    const prompt = `Specific question: "${query}"
Question type: "${queryType}"

Write one broader, foundational question whose answer would provide useful context for the specific question above.
Keep it concise. Output only the question, nothing else.

Examples:
- "What is the half-life of Carbon-14?" → "What are the principles of radioactive decay?"
- "How did the 2008 crisis affect California housing?" → "What caused the 2008 financial crisis?"
- "What is quicksort's worst-case complexity?" → "How do sorting algorithms work?"`

    try {
      const messages = [
        { role: "system" as const, content: "You generate step-back questions that retrieve broader context for specific queries." },
        { role: "user" as const, content: prompt }
      ]

      const response = await this.aiClient.generateText(messages, { temperature: 0.3 })
      
      // Clean up the response
      const stepBackQuestion = response
        .replace(/^(STEP-BACK:|QUESTION:|OUTPUT:)/i, '')
        .replace(/^["']|["']$/g, '')
        .trim()

      logger.debug(`Step-back: "${query.substring(0, 40)}..." → "${stepBackQuestion.substring(0, 40)}..."`)
      
      return stepBackQuestion
    } catch (error) {
      console.error('Step-back generation failed:', error)
      throw error
    }
  }

  // ============================================================================
  // QUERY CLARIFICATION
  // ============================================================================

  /**
   * Generate clarifying questions for ambiguous queries
   */
  async generateClarifyingQuestions(query: string): Promise<string[]> {
    if (!this.aiClient) {
      return []
    }

    const prompt = `You are analyzing a user query to identify potential ambiguities.

QUERY: "${query}"

TASK: If this query is ambiguous or could be interpreted in multiple ways, generate 2-3 clarifying questions that would help understand the user's intent.

GUIDELINES:
1. Only generate questions if the query is genuinely ambiguous
2. Questions should help narrow down the specific information needed
3. Keep questions concise and specific
4. If the query is clear, output "CLEAR" instead

OUTPUT FORMAT:
Q1: [first clarifying question]
Q2: [second clarifying question]
Q3: [third clarifying question]

Or just: CLEAR

Only output the questions or CLEAR, nothing else.`

    try {
      const messages = [
        { role: "system" as const, content: "You identify ambiguities in queries and generate clarifying questions." },
        { role: "user" as const, content: prompt }
      ]

      const response = await this.aiClient.generateText(messages, { temperature: 0.3 })
      
      if (response.trim().toUpperCase() === 'CLEAR') {
        return []
      }

      const questions: string[] = []
      const q1Match = response.match(/Q1:\s*(.+)/i)
      const q2Match = response.match(/Q2:\s*(.+)/i)
      const q3Match = response.match(/Q3:\s*(.+)/i)

      if (q1Match) questions.push(q1Match[1].trim())
      if (q2Match) questions.push(q2Match[1].trim())
      if (q3Match) questions.push(q3Match[1].trim())

      return questions
    } catch (error) {
      console.error('Clarifying questions generation failed:', error)
      return []
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let queryProcessorInstance: QueryProcessor | null = null

export function getQueryProcessor(config?: Partial<QueryProcessorConfig>): QueryProcessor {
  if (!queryProcessorInstance) {
    queryProcessorInstance = new QueryProcessor(config)
  }
  return queryProcessorInstance
}

export function resetQueryProcessor(): void {
  if (queryProcessorInstance) {
    queryProcessorInstance.clearCache()
  }
  queryProcessorInstance = null
}

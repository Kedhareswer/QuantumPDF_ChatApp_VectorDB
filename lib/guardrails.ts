/**
 * Comprehensive Guardrails and Evaluation System
 * Provides safety checks, input validation, and quality evaluation for the RAG pipeline
 */
import { extensionOf, SUPPORTED_EXTENSIONS } from "./supported-formats"

// ============================================================================
// INPUT GUARDRAILS
// ============================================================================

export interface InputValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedInput?: string
}

export interface DocumentValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  metadata: {
    sizeBytes: number
    estimatedTokens: number
    language?: string
    hasPII: boolean
    contentType: string
  }
}

/**
 * Validate user query input
 */
export function validateQueryInput(query: string): InputValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for empty input
  if (!query || query.trim().length === 0) {
    errors.push('Query cannot be empty')
    return { isValid: false, errors, warnings }
  }
  
  // Check query length
  if (query.length > 10000) {
    errors.push('Query exceeds maximum length of 10,000 characters')
  }
  
  if (query.length < 3) {
    errors.push('Query is too short. Please provide more context.')
  }
  
  // Check for potential injection attacks
  const injectionPatterns = [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/i,
    /system\s*:\s*/i,
    /\[\s*INST\s*\]/i,
    /<<\s*SYS\s*>>/i,
    /\{\{.*\}\}/,
    /<\|.*\|>/,
  ]
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(query)) {
      warnings.push('Query contains potentially problematic patterns')
      break
    }
  }
  
  // Check for excessive special characters
  const specialCharRatio = (query.match(/[^a-zA-Z0-9\s.,?!'"()-]/g) || []).length / query.length
  if (specialCharRatio > 0.3) {
    warnings.push('Query contains high ratio of special characters')
  }
  
  // Sanitize input
  const sanitizedInput = query
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim()
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedInput
  }
}

/**
 * Validate document before processing
 */
export function validateDocument(
  content: string,
  fileName: string,
  fileSizeBytes: number
): DocumentValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // File size limits (50MB max)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (fileSizeBytes > MAX_FILE_SIZE) {
    errors.push(`File size (${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum of 50MB`)
  }
  
  // Content length check
  const estimatedTokens = Math.ceil(content.length / 4)
  if (estimatedTokens > 500000) {
    warnings.push(`Document is very large (~${estimatedTokens} tokens). Processing may be slow.`)
  }
  
  // Check for empty content
  if (!content || content.trim().length < 100) {
    errors.push('Document content is too short or empty')
  }
  
  // Detect content type
  const contentType = detectContentType(content)
  
  // Check for PII (simplified detection)
  const hasPII = detectPII(content)
  if (hasPII) {
    warnings.push('Document may contain personally identifiable information (PII)')
  }
  
  // Check file extension. Derived from the one supported-format list so this
  // stops warning about formats the app gained (pptx, odt, epub, tsv, …).
  const ext = extensionOf(fileName)
  if (ext !== 'pdf' && ext !== 'txt' && ext !== 'md' && !SUPPORTED_EXTENSIONS.includes(ext)) {
    warnings.push(`File type ".${ext}" may not be fully supported`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      sizeBytes: fileSizeBytes,
      estimatedTokens,
      hasPII,
      contentType
    }
  }
}

/**
 * Detect potential PII in content
 */
function detectPII(content: string): boolean {
  const piiPatterns = [
    // Email
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    // Phone numbers
    /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    // SSN (US)
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
    // Credit card
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
    // IP Address
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  ]
  
  for (const pattern of piiPatterns) {
    if (pattern.test(content)) {
      return true
    }
  }
  
  return false
}

/**
 * Detect content type
 */
function detectContentType(content: string): string {
  if (content.includes('```') || content.includes('function ') || content.includes('class ')) {
    return 'code'
  }
  if (content.match(/\|.*\|.*\|/)) {
    return 'table'
  }
  if (content.match(/#{1,6}\s/)) {
    return 'markdown'
  }
  if (content.match(/\$.*\$|\\frac|\\sum|\\int/)) {
    return 'mathematical'
  }
  return 'text'
}

// ============================================================================
// OUTPUT GUARDRAILS
// ============================================================================

export interface OutputValidationResult {
  isValid: boolean
  issues: string[]
  sanitizedOutput?: string
  toxicityScore: number
  qualityScore: number
}

/**
 * Validate and sanitize LLM output
 */
export function validateOutput(
  response: string,
  context: string,
  chunks: Array<{ content: string; source: string }>
): OutputValidationResult {
  const issues: string[] = []
  let toxicityScore = 0
  let qualityScore = 1.0
  
  // Check for empty response
  if (!response || response.trim().length === 0) {
    issues.push('Response is empty')
    return { isValid: false, issues, toxicityScore: 0, qualityScore: 0 }
  }
  
  // Check response length
  if (response.length > 50000) {
    issues.push('Response exceeds maximum length')
    qualityScore -= 0.2
  }
  
  // Check for potential harmful content (simplified)
  const harmfulPatterns = [
    /\b(hack|exploit|attack|steal|kill|bomb)\b/i,
    /\b(password|credit.?card|ssn|social.?security)\b/i,
  ]
  
  for (const pattern of harmfulPatterns) {
    if (pattern.test(response) && !pattern.test(context)) {
      toxicityScore += 0.3
      issues.push('Response may contain sensitive content not from source documents')
    }
  }
  
  // Check for hallucination indicators
  const hallucinationIndicators = [
    /I\s+(think|believe|assume|guess)/i,
    /probably|likely|might be|could be/i,
    /as far as I know/i,
    /I don't have.*information.*but/i,
  ]
  
  for (const pattern of hallucinationIndicators) {
    if (pattern.test(response)) {
      issues.push('Response contains uncertainty indicators - verify against sources')
      qualityScore -= 0.1
    }
  }
  
  // Check for citation presence
  const hasCitations = /\[.*\]/.test(response)
  if (!hasCitations && chunks.length > 0) {
    issues.push('Response lacks citations despite having source documents')
    qualityScore -= 0.2
  }
  
  // Sanitize output
  const sanitizedOutput = response
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim()
  
  return {
    isValid: issues.length === 0,
    issues,
    sanitizedOutput,
    toxicityScore: Math.min(1, toxicityScore),
    qualityScore: Math.max(0, qualityScore)
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfterMs?: number
}

/**
 * Check rate limit for a user/session
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 20 }
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)
  
  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    const cutoff = now - config.windowMs * 2
    const keysToDelete: string[] = []
    rateLimitStore.forEach((val, key) => {
      if (val.windowStart < cutoff) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => rateLimitStore.delete(key))
  }
  
  if (!entry || now - entry.windowStart > config.windowMs) {
    // New window
    rateLimitStore.set(identifier, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    }
  }
  
  if (entry.count >= config.maxRequests) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart)
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.windowStart + config.windowMs,
      retryAfterMs
    }
  }
  
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.windowStart + config.windowMs
  }
}

// ============================================================================
// EVALUATION METRICS
// ============================================================================

export interface RetrievalMetrics {
  totalChunksRetrieved: number
  avgSimilarity: number
  maxSimilarity: number
  minSimilarity: number
  documentCoverage: number  // % of documents represented
  uniqueDocuments: number
  latencyMs: number
}

export interface GenerationMetrics {
  responseLength: number
  estimatedTokens: number
  citationCount: number
  citationCoverage: number  // % of claims with citations
  groundednessScore: number
  readabilityScore: number
  latencyMs: number
}

export interface QueryEvaluation {
  queryId: string
  timestamp: number
  query: string
  retrieval: RetrievalMetrics
  generation: GenerationMetrics
  overallScore: number
  issues: string[]
}

/**
 * Calculate retrieval quality metrics
 */
export function evaluateRetrieval(
  chunks: Array<{ similarity: number; documentId: string; documentName: string }>,
  totalDocuments: number,
  latencyMs: number
): RetrievalMetrics {
  if (chunks.length === 0) {
    return {
      totalChunksRetrieved: 0,
      avgSimilarity: 0,
      maxSimilarity: 0,
      minSimilarity: 0,
      documentCoverage: 0,
      uniqueDocuments: 0,
      latencyMs
    }
  }
  
  const similarities = chunks.map(c => c.similarity)
  const uniqueDocs = new Set(chunks.map(c => c.documentId))
  
  return {
    totalChunksRetrieved: chunks.length,
    avgSimilarity: similarities.reduce((a, b) => a + b, 0) / similarities.length,
    maxSimilarity: Math.max(...similarities),
    minSimilarity: Math.min(...similarities),
    documentCoverage: totalDocuments > 0 ? uniqueDocs.size / totalDocuments : 0,
    uniqueDocuments: uniqueDocs.size,
    latencyMs
  }
}

/**
 * Calculate generation quality metrics
 */
export function evaluateGeneration(
  response: string,
  chunks: Array<{ content: string; source: string }>,
  groundednessScore: number,
  latencyMs: number
): GenerationMetrics {
  // Count citations
  const citations = response.match(/\[[^\]]+\]/g) || []
  
  // Count factual claims (sentences with specific information)
  const sentences = response
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20)
  
  const citedSentences = sentences.filter(s => /\[[^\]]+\]/.test(s))
  const citationCoverage = sentences.length > 0 
    ? citedSentences.length / sentences.length 
    : 0
  
  // Calculate readability (simplified Flesch-Kincaid)
  const words = response.split(/\s+/).length
  const syllables = countSyllables(response)
  const readabilityScore = words > 0 
    ? Math.max(0, Math.min(100, 206.835 - 1.015 * (words / sentences.length) - 84.6 * (syllables / words)))
    : 50
  
  return {
    responseLength: response.length,
    estimatedTokens: Math.ceil(response.length / 4),
    citationCount: citations.length,
    citationCoverage,
    groundednessScore,
    readabilityScore: readabilityScore / 100,
    latencyMs
  }
}

/**
 * Count syllables in text (approximation)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || []
  let count = 0
  
  for (const word of words) {
    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g) || []
    count += Math.max(1, vowelGroups.length)
    
    // Subtract silent e
    if (word.endsWith('e') && word.length > 2) count--
    
    // Handle special cases
    if (word.endsWith('le') && word.length > 2 && !/[aeiouy]/.test(word[word.length - 3])) {
      count++
    }
  }
  
  return count
}

/**
 * Create comprehensive query evaluation
 */
export function createQueryEvaluation(
  queryId: string,
  query: string,
  chunks: Array<{ similarity: number; documentId: string; documentName: string; content: string; source: string }>,
  response: string,
  groundednessScore: number,
  totalDocuments: number,
  retrievalLatencyMs: number,
  generationLatencyMs: number
): QueryEvaluation {
  const retrieval = evaluateRetrieval(chunks, totalDocuments, retrievalLatencyMs)
  const generation = evaluateGeneration(response, chunks, groundednessScore, generationLatencyMs)
  
  const issues: string[] = []
  
  // Identify issues
  if (retrieval.avgSimilarity < 0.3) {
    issues.push('Low retrieval similarity - context may not be relevant')
  }
  if (retrieval.documentCoverage < 0.5 && totalDocuments > 1) {
    issues.push('Low document coverage - some documents may be underrepresented')
  }
  if (generation.citationCoverage < 0.5) {
    issues.push('Low citation coverage - many claims lack citations')
  }
  if (generation.groundednessScore < 0.7) {
    issues.push('Low groundedness - response may contain unverified claims')
  }
  if (generation.readabilityScore < 0.3) {
    issues.push('Low readability - response may be difficult to understand')
  }
  
  // Calculate overall score (weighted average)
  const overallScore = (
    retrieval.avgSimilarity * 0.2 +
    retrieval.documentCoverage * 0.1 +
    generation.citationCoverage * 0.2 +
    generation.groundednessScore * 0.3 +
    generation.readabilityScore * 0.2
  )
  
  return {
    queryId,
    timestamp: Date.now(),
    query,
    retrieval,
    generation,
    overallScore,
    issues
  }
}

// ============================================================================
// EVALUATION STORAGE & ANALYTICS
// ============================================================================

const evaluationHistory: QueryEvaluation[] = []
const MAX_HISTORY = 1000

/**
 * Store evaluation for analytics
 */
export function storeEvaluation(evaluation: QueryEvaluation): void {
  evaluationHistory.push(evaluation)
  
  // Trim old evaluations
  if (evaluationHistory.length > MAX_HISTORY) {
    evaluationHistory.splice(0, evaluationHistory.length - MAX_HISTORY)
  }
}

/**
 * Get evaluation analytics
 */
export function getEvaluationAnalytics(): {
  totalQueries: number
  avgOverallScore: number
  avgRetrievalLatency: number
  avgGenerationLatency: number
  avgGroundedness: number
  avgCitationCoverage: number
  issueBreakdown: Record<string, number>
  recentTrend: 'improving' | 'stable' | 'declining'
} {
  if (evaluationHistory.length === 0) {
    return {
      totalQueries: 0,
      avgOverallScore: 0,
      avgRetrievalLatency: 0,
      avgGenerationLatency: 0,
      avgGroundedness: 0,
      avgCitationCoverage: 0,
      issueBreakdown: {},
      recentTrend: 'stable'
    }
  }
  
  const totalQueries = evaluationHistory.length
  const avgOverallScore = evaluationHistory.reduce((a, b) => a + b.overallScore, 0) / totalQueries
  const avgRetrievalLatency = evaluationHistory.reduce((a, b) => a + b.retrieval.latencyMs, 0) / totalQueries
  const avgGenerationLatency = evaluationHistory.reduce((a, b) => a + b.generation.latencyMs, 0) / totalQueries
  const avgGroundedness = evaluationHistory.reduce((a, b) => a + b.generation.groundednessScore, 0) / totalQueries
  const avgCitationCoverage = evaluationHistory.reduce((a, b) => a + b.generation.citationCoverage, 0) / totalQueries
  
  // Count issues
  const issueBreakdown: Record<string, number> = {}
  for (const eval_ of evaluationHistory) {
    for (const issue of eval_.issues) {
      issueBreakdown[issue] = (issueBreakdown[issue] || 0) + 1
    }
  }
  
  // Calculate trend (compare last 10 to previous 10)
  let recentTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (evaluationHistory.length >= 20) {
    const recent = evaluationHistory.slice(-10)
    const previous = evaluationHistory.slice(-20, -10)
    
    const recentAvg = recent.reduce((a, b) => a + b.overallScore, 0) / 10
    const previousAvg = previous.reduce((a, b) => a + b.overallScore, 0) / 10
    
    if (recentAvg > previousAvg + 0.05) recentTrend = 'improving'
    else if (recentAvg < previousAvg - 0.05) recentTrend = 'declining'
  }
  
  return {
    totalQueries,
    avgOverallScore,
    avgRetrievalLatency,
    avgGenerationLatency,
    avgGroundedness,
    avgCitationCoverage,
    issueBreakdown,
    recentTrend
  }
}

/**
 * Clear evaluation history
 */
export function clearEvaluationHistory(): void {
  evaluationHistory.length = 0
}

// ============================================================================
// LATENCY MONITORING
// ============================================================================

export interface LatencyBudget {
  retrievalMs: number
  generationMs: number
  totalMs: number
}

const DEFAULT_LATENCY_BUDGET: LatencyBudget = {
  retrievalMs: 2000,    // 2 seconds for retrieval
  generationMs: 30000,  // 30 seconds for generation
  totalMs: 35000        // 35 seconds total
}

/**
 * Check if operation is within latency budget
 */
export function checkLatencyBudget(
  phase: 'retrieval' | 'generation' | 'total',
  elapsedMs: number,
  budget: LatencyBudget = DEFAULT_LATENCY_BUDGET
): { withinBudget: boolean; budgetMs: number; overageMs: number } {
  const budgetMs = budget[`${phase}Ms` as keyof LatencyBudget]
  const overageMs = Math.max(0, elapsedMs - budgetMs)
  
  return {
    withinBudget: elapsedMs <= budgetMs,
    budgetMs,
    overageMs
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Guardrails = {
  validateQueryInput,
  validateDocument,
  validateOutput,
  checkRateLimit,
  detectPII,
}

export const Evaluations = {
  evaluateRetrieval,
  evaluateGeneration,
  createQueryEvaluation,
  storeEvaluation,
  getEvaluationAnalytics,
  clearEvaluationHistory,
  checkLatencyBudget,
}

/**
 * Shared keyword scoring utilities for vector database implementations
 * This eliminates code duplication across Pinecone, Weaviate, and Local databases
 */

/**
 * Comprehensive stop words list for better keyword extraction
 */
export const STOP_WORDS = new Set([
  // Articles and determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'all', 'both',
  'few', 'more', 'most', 'other', 'such', 'either', 'neither',
  
  // Pronouns
  'i', 'me', 'you', 'he', 'him', 'she', 'it', 'we', 'us', 'they', 'them',
  'who', 'whom', 'which', 'what', 'whose', 'whoever', 'whatever',
  
  // Verbs (common)
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'need', 'dare', 'ought', 'used', 'get', 'got', 'getting',
  
  // Prepositions
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'over', 'out', 'up', 'down', 'off', 'about', 'around', 'against', 'along',
  
  // Conjunctions
  'and', 'or', 'but', 'if', 'because', 'until', 'while', 'although', 'though',
  'unless', 'since', 'when', 'where', 'why', 'how', 'whether', 'so', 'than',
  
  // Adverbs
  'again', 'further', 'then', 'once', 'here', 'there', 'now', 'always', 'never',
  'sometimes', 'often', 'usually', 'already', 'still', 'yet', 'also', 'just',
  'only', 'even', 'ever', 'very', 'too', 'quite', 'rather', 'almost', 'really',
  
  // Question/request words (kept for context but filtered for matching)
  'tell', 'explain', 'describe', 'give', 'show', 'please', 'know', 'think',
  'want', 'like', 'make', 'see', 'find', 'look', 'say', 'said',
  
  // Other common words
  'not', 'nor', 'own', 'same', 'much', 'many', 'well', 'back', 'way'
])

/**
 * Check if a word is a stop word
 */
export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word.toLowerCase())
}

/**
 * Extract meaningful keywords from text (removes stop words)
 */
export function extractKeywords(text: string, minLength: number = 2): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter(word => word.length > minLength && !isStopWord(word))
}

/**
 * Normalize text for keyword matching
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate keyword relevance score between a query and content
 * Uses a combination of exact matches, partial matches, and frequency bonuses
 * Filters out stop words for better relevance scoring
 * 
 * @param query - The search query
 * @param content - The content to search in
 * @returns A score between 0 and 1
 */
export function calculateKeywordScore(query: string, content: string): number {
  if (!content || !query) return 0

  const normalizedQuery = normalizeText(query)
  const normalizedContent = normalizeText(content)
  
  // Filter out stop words from query - these don't help with relevance
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 2 && !isStopWord(word))
  
  const contentWords = new Set(normalizedContent.split(/\s+/))
  const contentText = normalizedContent
  
  // If no meaningful query words after filtering, try with original words
  if (queryWords.length === 0) {
    const originalWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
    if (originalWords.length === 0) return 0
    // Use original words but with lower weight
    queryWords.push(...originalWords)
  }

  let exactMatches = 0
  let partialMatches = 0
  let frequencyBonus = 0
  
  for (const queryWord of queryWords) {
    if (contentWords.has(queryWord)) {
      exactMatches++
      // Count frequency for bonus
      const regex = new RegExp(`\\b${queryWord}\\b`, 'gi')
      const occurrences = (contentText.match(regex) || []).length
      frequencyBonus += Math.min(0.1, occurrences * 0.02)
    } else {
      // Check for partial matches (stemming-like behavior)
      const partialMatch = Array.from(contentWords).some(contentWord => 
        (contentWord.length > 3 && queryWord.length > 3) && 
        (contentWord.includes(queryWord) || queryWord.includes(contentWord))
      )
      if (partialMatch) {
        partialMatches++
      }
    }
  }

  // Calculate base score
  const exactScore = exactMatches / queryWords.length
  const partialScore = (partialMatches / queryWords.length) * 0.4
  let finalScore = exactScore + partialScore + frequencyBonus

  // Boost for multiple matches
  if (exactMatches >= 2) {
    finalScore *= 1.2
  }
  
  // Boost for phrase matches (words appearing together)
  if (queryWords.length >= 2) {
    const phrase = queryWords.slice(0, 2).join(' ')
    if (contentText.includes(phrase)) {
      finalScore += 0.2
    }
  }

  return Math.min(1.0, finalScore)
}

/**
 * Enhanced keyword similarity with additional scoring factors
 * Includes n-gram matching, term frequency weighting, and stop word filtering
 * 
 * @param query - The search query
 * @param content - The content to search in
 * @returns A score between 0 and 1
 */
export function enhancedKeywordSimilarity(query: string, content: string): number {
  if (!query || !content) return 0

  const normalizedQuery = normalizeText(query)
  const normalizedContent = normalizeText(content)

  // Filter out stop words for better matching
  const queryTerms = normalizedQuery
    .split(/\s+/)
    .filter(t => t.length > 2 && !isStopWord(t))
  
  const contentTerms = new Set(normalizedContent.split(/\s+/))
  const contentLower = normalizedContent

  // If no meaningful terms after filtering, use original terms with lower weight
  if (queryTerms.length === 0) {
    const originalTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 2)
    if (originalTerms.length === 0) return 0
    queryTerms.push(...originalTerms)
  }

  let matchedTerms = 0

  for (const term of queryTerms) {
    // Skip very common short words that slipped through
    if (term.length < 3) continue
    
    // Exact term match
    if (contentTerms.has(term)) {
      matchedTerms++
    }
    // Partial/stem match (for longer words only)
    else if (term.length > 4) {
      const hasPartialMatch = Array.from(contentTerms).some(ct => 
        ct.length > 4 && (ct.includes(term) || term.includes(ct))
      )
      if (hasPartialMatch) {
        matchedTerms += 0.5
      }
    }
  }

  // Base score from matched terms
  let score = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0

  // N-gram bonus: check if query terms appear close together
  if (queryTerms.length >= 2) {
    const bigramQuery = queryTerms.slice(0, 2).join(' ')
    if (contentLower.includes(bigramQuery)) {
      score += 0.25
    }
    if (queryTerms.length >= 3) {
      const trigramQuery = queryTerms.slice(0, 3).join(' ')
      if (contentLower.includes(trigramQuery)) {
        score += 0.2
      }
    }
  }

  // Exact phrase bonus (with stop words included for phrase matching)
  if (normalizedQuery.length > 5 && contentLower.includes(normalizedQuery)) {
    score += 0.35
  }

  // Bonus for high match density (many matches in short content = very relevant)
  if (matchedTerms >= 3 && normalizedContent.length < 500) {
    score += 0.15
  }

  return Math.min(1.0, score)
}

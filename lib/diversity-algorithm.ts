// lib/diversity-algorithm.ts - Enhanced multi-document diversity with MMR, temporal, position, and topic analysis

import { logger } from "./logger"
import type { RAGConfiguration } from './rag-config'

export interface DiversityChunk {
  content: string
  source: string
  similarity: number
  documentId: string
  documentName: string
  semanticImportance: number
  // Temporal metadata
  uploadedAt?: Date
  creationDate?: Date
  modificationDate?: Date
  // Position metadata
  chunkIndex?: number
  totalChunks?: number
  chunkType?: string // intro, body, conclusion
  page?: number
  // Topic metadata
  topics?: string[]
  entities?: string[]
}

export interface DocumentMetrics {
  avgSimilarity: number
  chunkCount: number
  bestSimilarity: number
  temporalScore?: number
  topicDiversity?: number
}

// MMR (Maximal Marginal Relevance) Algorithm
export class MMRDiversitySelector {
  private lambda: number // balance between relevance and diversity (0-1)

  constructor(lambda: number = 0.7) {
    this.lambda = lambda
  }

  select(
    chunks: DiversityChunk[],
    topK: number,
    similarityFn?: (a: DiversityChunk, b: DiversityChunk) => number
  ): DiversityChunk[] {
    if (chunks.length === 0) return []
    if (chunks.length <= topK) return chunks

    const selected: DiversityChunk[] = []
    const remaining = [...chunks]

    // Start with the most relevant chunk
    const first = remaining.sort((a, b) => b.similarity - a.similarity)[0]
    selected.push(first)
    remaining.splice(remaining.indexOf(first), 1)

    // Iteratively select chunks that maximize MMR score
    while (selected.length < topK && remaining.length > 0) {
      let bestChunk: DiversityChunk | null = null
      let bestScore = -Infinity

      for (const candidate of remaining) {
        // Calculate max similarity to already selected chunks
        let maxSim = 0
        for (const selectedChunk of selected) {
          const sim = similarityFn
            ? similarityFn(candidate, selectedChunk)
            : this.defaultSimilarity(candidate, selectedChunk)
          maxSim = Math.max(maxSim, sim)
        }

        // MMR formula: λ * relevance - (1-λ) * max_similarity_to_selected
        const mmrScore = this.lambda * candidate.similarity - (1 - this.lambda) * maxSim

        if (mmrScore > bestScore) {
          bestScore = mmrScore
          bestChunk = candidate
        }
      }

      if (bestChunk) {
        selected.push(bestChunk)
        remaining.splice(remaining.indexOf(bestChunk), 1)
      } else {
        break
      }
    }

    return selected
  }

  private defaultSimilarity(a: DiversityChunk, b: DiversityChunk): number {
    // Simple content-based similarity (Jaccard)
    const wordsA = new Set(a.content.toLowerCase().split(/\s+/))
    const wordsB = new Set(b.content.toLowerCase().split(/\s+/))

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])

    return intersection.size / union.size
  }
}

// Temporal diversity scorer
export class TemporalDiversityScorer {
  calculateScore(chunk: DiversityChunk, referenceDate?: Date): number {
    const ref = referenceDate || new Date()

    // Try multiple date sources
    const chunkDate =
      chunk.creationDate || chunk.modificationDate || chunk.uploadedAt

    if (!chunkDate) return 0.5 // neutral score if no date

    const ageInDays = (ref.getTime() - chunkDate.getTime()) / (1000 * 60 * 60 * 24)

    // Decay function: more recent documents get higher scores
    // Score ranges from 0 to 1, with recent docs near 1
    const decayRate = 0.01 // 1% decay per day
    const score = Math.exp(-decayRate * ageInDays)

    return Math.max(0, Math.min(1, score))
  }

  // Spread chunks across time periods
  selectTemporallyDiverse(
    chunks: DiversityChunk[],
    topK: number
  ): DiversityChunk[] {
    if (chunks.length <= topK) return chunks

    // Sort by date
    const sortedChunks = [...chunks].sort((a, b) => {
      const dateA = a.creationDate || a.uploadedAt || new Date(0)
      const dateB = b.creationDate || b.uploadedAt || new Date(0)
      return dateB.getTime() - dateA.getTime()
    })

    // Divide into temporal buckets
    const bucketCount = Math.min(5, topK)
    const bucketSize = Math.ceil(sortedChunks.length / bucketCount)
    const selected: DiversityChunk[] = []

    for (let i = 0; i < bucketCount && selected.length < topK; i++) {
      const bucket = sortedChunks.slice(i * bucketSize, (i + 1) * bucketSize)
      if (bucket.length > 0) {
        // Take best from each bucket
        const best = bucket.sort((a, b) => b.similarity - a.similarity)[0]
        selected.push(best)
      }
    }

    // Fill remaining slots with highest similarity
    const remaining = sortedChunks.filter((c) => !selected.includes(c))
    while (selected.length < topK && remaining.length > 0) {
      const best = remaining.sort((a, b) => b.similarity - a.similarity)[0]
      selected.push(best)
      remaining.splice(remaining.indexOf(best), 1)
    }

    return selected
  }
}

// Position diversity scorer
export class PositionDiversityScorer {
  calculateScore(chunk: DiversityChunk): number {
    if (chunk.chunkIndex === undefined || chunk.totalChunks === undefined) {
      return 0.5 // neutral if no position info
    }

    const position = chunk.chunkIndex / Math.max(1, chunk.totalChunks - 1)

    // Boost intro (0-0.15) and conclusion (0.85-1.0) sections
    if (position <= 0.15) {
      return 1.0 // Introduction
    } else if (position >= 0.85) {
      return 0.9 // Conclusion
    } else {
      return 0.5 // Body
    }
  }

  selectPositionallyDiverse(
    chunks: DiversityChunk[],
    topK: number
  ): DiversityChunk[] {
    if (chunks.length <= topK) return chunks

    const intro: DiversityChunk[] = []
    const body: DiversityChunk[] = []
    const conclusion: DiversityChunk[] = []

    for (const chunk of chunks) {
      if (!chunk.chunkIndex || !chunk.totalChunks) {
        body.push(chunk)
        continue
      }

      const position = chunk.chunkIndex / Math.max(1, chunk.totalChunks - 1)

      if (position <= 0.15) {
        intro.push(chunk)
      } else if (position >= 0.85) {
        conclusion.push(chunk)
      } else {
        body.push(chunk)
      }
    }

    // Allocate chunks: 20% intro, 60% body, 20% conclusion
    const introCount = Math.max(1, Math.floor(topK * 0.2))
    const conclusionCount = Math.max(1, Math.floor(topK * 0.2))
    const bodyCount = topK - introCount - conclusionCount

    const selected: DiversityChunk[] = []

    // Select best from each section
    const addBest = (arr: DiversityChunk[], count: number) => {
      const sorted = arr.sort((a, b) => b.similarity - a.similarity)
      selected.push(...sorted.slice(0, count))
    }

    addBest(intro, Math.min(introCount, intro.length))
    addBest(body, Math.min(bodyCount, body.length))
    addBest(conclusion, Math.min(conclusionCount, conclusion.length))

    // Fill remaining slots if needed
    const allSorted = chunks
      .filter((c) => !selected.includes(c))
      .sort((a, b) => b.similarity - a.similarity)

    while (selected.length < topK && allSorted.length > 0) {
      selected.push(allSorted.shift()!)
    }

    return selected.slice(0, topK)
  }
}

// Topic diversity scorer
export class TopicDiversityScorer {
  private extractTopics(content: string): string[] {
    // Simple keyword extraction (can be enhanced with NLP)
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4) // ignore short words

    // Count word frequencies
    const freq: Record<string, number> = {}
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1
    }

    // Return top keywords as topics
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0])
  }

  calculateTopicDiversity(chunks: DiversityChunk[]): number {
    const allTopics = new Set<string>()

    for (const chunk of chunks) {
      const topics = chunk.topics || this.extractTopics(chunk.content)
      topics.forEach((t) => allTopics.add(t))
    }

    // Diversity = unique topics / total chunks
    return chunks.length > 0 ? allTopics.size / chunks.length : 0
  }

  selectTopicallyDiverse(
    chunks: DiversityChunk[],
    topK: number
  ): DiversityChunk[] {
    if (chunks.length <= topK) return chunks

    // Extract topics for each chunk
    const chunksWithTopics = chunks.map((chunk) => ({
      chunk,
      topics: chunk.topics || this.extractTopics(chunk.content),
    }))

    const selected: DiversityChunk[] = []
    const selectedTopics = new Set<string>()
    const remaining = [...chunksWithTopics]

    while (selected.length < topK && remaining.length > 0) {
      let bestChunk: typeof chunksWithTopics[0] | null = null
      let bestScore = -Infinity

      for (const candidate of remaining) {
        // Score = similarity + topic novelty
        const novelTopics = candidate.topics.filter((t) => !selectedTopics.has(t))
        const topicNoveltyScore = novelTopics.length / Math.max(1, candidate.topics.length)

        const score = candidate.chunk.similarity * 0.7 + topicNoveltyScore * 0.3

        if (score > bestScore) {
          bestScore = score
          bestChunk = candidate
        }
      }

      if (bestChunk) {
        selected.push(bestChunk.chunk)
        bestChunk.topics.forEach((t) => selectedTopics.add(t))
        remaining.splice(remaining.indexOf(bestChunk), 1)
      } else {
        break
      }
    }

    return selected
  }
}

// Enhanced diversity algorithm integrating all strategies
export class EnhancedDiversityAlgorithm {
  private mmr: MMRDiversitySelector
  private temporal: TemporalDiversityScorer
  private position: PositionDiversityScorer
  private topic: TopicDiversityScorer
  private config: RAGConfiguration['diversity']

  constructor(config: RAGConfiguration['diversity']) {
    this.config = config
    this.mmr = new MMRDiversitySelector(config.mmr.lambda)
    this.temporal = new TemporalDiversityScorer()
    this.position = new PositionDiversityScorer()
    this.topic = new TopicDiversityScorer()
  }

  select(
    chunks: DiversityChunk[],
    documentMetrics: Map<string, DocumentMetrics>,
    topK: number,
    minSimilarity: number
  ): DiversityChunk[] {
    if (chunks.length === 0) return []
    if (chunks.length <= topK) return chunks

    logger.debug(`Enhanced Diversity: Processing ${chunks.length} chunks for top-${topK}`)

    // Filter by minimum similarity
    const filtered = chunks.filter((c) => c.similarity >= minSimilarity)
    if (filtered.length === 0) {
      console.warn('No chunks passed similarity threshold')
      return []
    }

    // Calculate composite scores with all diversity dimensions
    const scoredChunks = filtered.map((chunk) => {
      const temporalScore = this.temporal.calculateScore(chunk)
      const positionScore = this.position.calculateScore(chunk)

      // Composite score with configurable weights
      const composite =
        Math.pow(chunk.similarity, this.config.enhanced.similarityExponent) *
          this.config.enhanced.similarityWeight +
        Math.pow(chunk.semanticImportance, this.config.enhanced.importanceExponent) *
          this.config.enhanced.importanceWeight +
        temporalScore * this.config.enhanced.temporalWeight +
        positionScore * this.config.enhanced.positionWeight

      return {
        ...chunk,
        compositeScore: composite,
        temporalScore,
        positionScore,
      }
    })

    // Sort by composite score
    scoredChunks.sort((a, b) => b.compositeScore - a.compositeScore)

    // Apply selected algorithm
    let selected: DiversityChunk[]

    switch (this.config.algorithm) {
      case 'mmr':
        selected = this.mmr.select(scoredChunks, topK)
        break

      case 'enhanced':
        // Multi-stage selection
        // Stage 1: MMR for relevance-diversity balance
        const mmrCandidates = this.mmr.select(
          scoredChunks,
          Math.min(topK * 3, scoredChunks.length)
        )

        // Stage 2: Temporal diversity
        const temporalCandidates = this.temporal.selectTemporallyDiverse(
          mmrCandidates,
          Math.min(topK * 2, mmrCandidates.length)
        )

        // Stage 3: Positional diversity
        const positionalCandidates = this.position.selectPositionallyDiverse(
          temporalCandidates,
          Math.min(topK * 1.5, temporalCandidates.length)
        )

        // Stage 4: Topic diversity (final selection)
        selected = this.topic.selectTopicallyDiverse(positionalCandidates, topK)
        break

      case 'basic':
      default:
        // Simple greedy selection with fairness
        selected = this.basicDiversitySelection(
          scoredChunks,
          documentMetrics,
          topK
        )
        break
    }

    // Log diversity metrics
    this.logDiversityMetrics(selected)

    return selected
  }

  private basicDiversitySelection(
    chunks: DiversityChunk[],
    documentMetrics: Map<string, DocumentMetrics>,
    topK: number
  ): DiversityChunk[] {
    const numDocs = documentMetrics.size
    const baseChunksPerDoc = Math.floor(topK / numDocs)
    const extraChunks = topK % numDocs

    // Sort documents by best similarity
    const sortedDocs = Array.from(documentMetrics.entries()).sort(
      (a, b) => b[1].bestSimilarity - a[1].bestSimilarity
    )

    // Allocate chunks per document
    const documentTargets = new Map<string, number>()
    sortedDocs.forEach(([docId], idx) => {
      const target = baseChunksPerDoc + (idx < extraChunks ? 1 : 0)
      documentTargets.set(docId, target)
    })

    const maxPerDoc = Math.ceil(topK * (this.config.enhanced.maxChunksPerDoc / 100))

    // Select chunks with fairness constraints
    const selected: DiversityChunk[] = []
    const documentCounts = new Map<string, number>()

    // Phase 1: Ensure every document gets at least one chunk
    for (const [docId] of sortedDocs) {
      const docChunks = chunks.filter((c) => c.documentId === docId)
      if (docChunks.length > 0 && selected.length < topK) {
        selected.push(docChunks[0])
        documentCounts.set(docId, 1)
      }
    }

    // Phase 2: Fill to targets
    const remaining = chunks.filter((c) => !selected.includes(c))
    for (const chunk of remaining) {
      if (selected.length >= topK) break

      const currentCount = documentCounts.get(chunk.documentId) || 0
      const target = documentTargets.get(chunk.documentId) || baseChunksPerDoc

      if (currentCount < target || (currentCount < maxPerDoc && chunk.similarity > 0.2)) {
        selected.push(chunk)
        documentCounts.set(chunk.documentId, currentCount + 1)
      }
    }

    return selected.slice(0, topK)
  }

  private logDiversityMetrics(selected: DiversityChunk[]): void {
    const docDistribution = new Map<string, number>()
    const topicDiversity = this.topic.calculateTopicDiversity(selected)

    for (const chunk of selected) {
      docDistribution.set(
        chunk.documentName,
        (docDistribution.get(chunk.documentName) || 0) + 1
      )
    }

    logger.debug(`Diversity Metrics:`)
    logger.debug(`- Documents represented: ${docDistribution.size}`)
    logger.debug(`- Topic diversity: ${topicDiversity.toFixed(2)}`)
    logger.debug(`- Document distribution:`)
    docDistribution.forEach((count, name) => {
      logger.debug(`  ${name}: ${count} chunks`)
    })
  }
}

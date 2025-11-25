# QuantumPDF RAG Architecture

> **Deep dive into the Retrieval-Augmented Generation system with 3-phase processing, domain agents, and multimodal support**
> **Last Updated: November 2025 | Version 3.0.0**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [3-Phase Processing Pipeline](#3-phase-processing-pipeline)
3. [Retrieval System](#retrieval-system)
4. [Domain Agents](#domain-agents)
5. [Multimodal Integration](#multimodal-integration)
6. [Scoring & Ranking](#scoring--ranking)
7. [Quality Metrics](#quality-metrics)
8. [Configuration](#configuration)

---

## Architecture Overview

### High-Level RAG Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER QUERY                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        QUERY PREPROCESSING                               │
│  • Query expansion    • Intent detection    • Entity extraction         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RETRIEVAL ENGINE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Embedding  │  │   Vector     │  │   Diversity  │                   │
│  │   Generation │──│   Search     │──│   Boosting   │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     3-PHASE PROCESSING                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Phase 1:   │  │   Phase 2:   │  │   Phase 3:   │                   │
│  │   Context    │──│   Self       │──│   Refined    │                   │
│  │   Analysis   │  │   Critique   │  │   Answer     │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                           ┌────────┴────────┐
                           │                 │
                           ▼                 ▼
              ┌─────────────────┐  ┌─────────────────┐
              │  DOMAIN AGENTS  │  │  DIRECT ANSWER  │
              │  (Optional)     │  │                 │
              └─────────────────┘  └─────────────────┘
                           │                 │
                           └────────┬────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          FINAL RESPONSE                                  │
│  • Answer    • Sources    • Quality Metrics    • Agent Insights         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| RAG Engine | `lib/rag-engine.ts` | Core query processing & retrieval |
| AI Client | `lib/ai-client.ts` | Multi-provider LLM integration |
| Domain Agents | `lib/domain-agents.ts` | Specialized analysis |
| Chunking | `lib/advanced-chunking.ts` | Semantic text segmentation |
| Vector DB | `lib/vector-database-client.ts` | Embedding storage & search |

---

## 3-Phase Processing Pipeline

### Phase 1: Context Analysis

The first phase analyzes retrieved context and generates an initial response.

```typescript
// lib/rag-engine.ts
async function analyzeContext(
  query: string, 
  chunks: RetrievedChunk[]
): Promise<ContextAnalysis> {
  const context = chunks
    .map(c => `[Doc: ${c.documentId}]\n${c.content}`)
    .join('\n\n---\n\n')
  
  const prompt = `
    You are analyzing document context to answer a user query.
    
    QUERY: ${query}
    
    RETRIEVED CONTEXT:
    ${context}
    
    Provide a comprehensive analysis including:
    1. Direct answer to the query
    2. Key facts from the context
    3. Relevant quotes with source attribution
    4. Confidence level (high/medium/low)
    5. Any gaps in the available information
  `
  
  return await aiClient.generateText(prompt)
}
```

**Output Structure:**
```typescript
interface ContextAnalysis {
  answer: string
  keyFacts: string[]
  quotes: Array<{ text: string; source: string }>
  confidence: 'high' | 'medium' | 'low'
  gaps: string[]
}
```

### Phase 2: Self-Critique

The second phase critically evaluates the initial analysis.

```typescript
async function selfCritique(
  analysis: ContextAnalysis
): Promise<Critique> {
  const prompt = `
    Review this analysis for accuracy and completeness:
    
    ${JSON.stringify(analysis, null, 2)}
    
    Evaluate:
    1. ACCURACY: Are the claims supported by cited sources?
    2. COMPLETENESS: Does it fully address the query?
    3. CLARITY: Is the answer clear and well-organized?
    4. BIAS: Are there any unsupported assumptions?
    5. IMPROVEMENTS: What specific improvements would help?
  `
  
  return await aiClient.generateText(prompt)
}
```

**Output Structure:**
```typescript
interface Critique {
  accuracy: { score: number; issues: string[] }
  completeness: { score: number; missingAspects: string[] }
  clarity: { score: number; suggestions: string[] }
  bias: { detected: boolean; details: string[] }
  improvements: string[]
}
```

### Phase 3: Refined Answer

The final phase incorporates critique feedback to produce the best answer.

```typescript
async function refineAnswer(
  analysis: ContextAnalysis,
  critique: Critique,
  originalQuery: string
): Promise<RefinedAnswer> {
  const prompt = `
    Based on the initial analysis and self-critique, provide a refined answer.
    
    ORIGINAL QUERY: ${originalQuery}
    
    INITIAL ANALYSIS:
    ${analysis.answer}
    
    CRITIQUE FINDINGS:
    - Accuracy issues: ${critique.accuracy.issues.join(', ')}
    - Missing aspects: ${critique.completeness.missingAspects.join(', ')}
    - Suggested improvements: ${critique.improvements.join(', ')}
    
    Provide a refined answer that:
    1. Addresses all critique points
    2. Maintains accurate source attribution
    3. Acknowledges any remaining uncertainties
    4. Uses clear, professional language
  `
  
  return await aiClient.generateText(prompt)
}
```

---

## Retrieval System

### Embedding Generation

```typescript
// lib/ai-client.ts
class AIClient {
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Check cache first
    const cached = texts.map(t => this.embeddingCache.get(t))
    const uncached = texts.filter((_, i) => !cached[i])
    
    if (uncached.length > 0) {
      const newEmbeddings = await this.callEmbeddingAPI(uncached)
      uncached.forEach((t, i) => this.embeddingCache.set(t, newEmbeddings[i]))
    }
    
    return texts.map((t, i) => cached[i] ?? this.embeddingCache.get(t)!)
  }
  
  // Provider-specific implementations
  private async callEmbeddingAPI(texts: string[]): Promise<number[][]> {
    switch (this.provider) {
      case 'openai':
        return this.openaiEmbeddings(texts)
      case 'huggingface':
        return this.huggingfaceEmbeddings(texts)
      default:
        return texts.map(t => this.fallbackEmbedding(t))
    }
  }
}
```

### Vector Search

```typescript
// lib/rag-engine.ts
async function retrieveChunks(
  queryText: string,
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  // Generate query embedding
  const queryEmbedding = await aiClient.generateEmbeddings([queryText])
  
  // Search vector database
  const results = await vectorDB.query(queryEmbedding[0], {
    topK: options.maxChunks ?? 25,
    filter: options.documentFilter,
    minScore: options.minSimilarity ?? 0.5
  })
  
  // Apply diversity boosting
  if (options.enableDiversity) {
    return applyDiversityBoost(results, options.diversityWeight)
  }
  
  return results
}
```

### Multi-Document Diversity Algorithm

```typescript
function applyDiversityBoost(
  chunks: RetrievedChunk[],
  diversityWeight: number = 0.3
): RetrievedChunk[] {
  const documentCounts = new Map<string, number>()
  
  return chunks
    .map(chunk => {
      const docCount = documentCounts.get(chunk.documentId) ?? 0
      documentCounts.set(chunk.documentId, docCount + 1)
      
      // Penalize chunks from over-represented documents
      const diversityPenalty = docCount * diversityWeight * 0.1
      
      return {
        ...chunk,
        adjustedScore: chunk.similarity - diversityPenalty
      }
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
}
```

---

## Domain Agents

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT MANAGER                                    │
│  • Agent Registration    • Execution Pipeline    • Result Aggregation   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────┬───────────┼───────────┬───────────────┐
        ▼               ▼           ▼           ▼               ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│   Analogy     │ │Compliance │ │ Key Terms │ │  Summary  │ │ Explainer │
│   Maker       │ │  Checker  │ │ Extractor │ │   Agent   │ │   Agent   │
└───────────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

### Available Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| Analogy Maker | Simplify complex concepts | API (OpenAI/Anthropic) |
| Compliance Checker | Legal/policy analysis | API (OpenAI/Anthropic) |
| Key Terms Extractor | Vocabulary extraction | API (OpenAI/Anthropic) |
| Summary Agent | Concise summaries | Local (Transformers.js) or API |
| Explainer Agent | Detailed explanations | API with Math.js integration |
| Fact Checker | Factual verification | API (planned) |

### Agent Implementation

```typescript
// lib/domain-agents.ts
interface DomainAgent {
  type: AgentType
  run(context: AgentContext): Promise<AgentResult>
}

interface AgentContext {
  query: string
  chunks: RetrievedChunk[]
  ragResult: RAGResult
  options?: AgentOptions
}

interface AgentResult {
  agentType: AgentType
  output: string
  metadata: {
    processingTime: number
    tokensUsed: number
    modelUsed: string
  }
}

// Analogy Maker Agent
class AnalogyMakerAgent implements DomainAgent {
  type = 'analogy-maker' as const
  
  async run(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    const prompt = `
      Create 3 simple, everyday analogies to explain these concepts:
      
      Query: ${context.query}
      
      Key concepts from context:
      ${this.extractConcepts(context.chunks)}
      
      Format each analogy as:
      **[Concept]** is like **[Everyday Thing]** because [clear explanation]
      
      Make analogies accessible to someone without technical background.
    `
    
    const output = await this.aiClient.generateText(prompt)
    
    return {
      agentType: this.type,
      output,
      metadata: {
        processingTime: Date.now() - startTime,
        tokensUsed: this.estimateTokens(output),
        modelUsed: this.aiClient.currentModel
      }
    }
  }
}

// Summary Agent with Local Model Option
class SummaryAgent implements DomainAgent {
  type = 'summary' as const
  
  async run(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    if (context.options?.useLocalModels) {
      // Use Transformers.js locally
      const summarizer = new LocalSummarizer()
      await summarizer.initialize()
      
      const combinedText = context.chunks
        .map(c => c.content)
        .join('\n\n')
      
      const summary = await summarizer.summarize(combinedText)
      
      return {
        agentType: this.type,
        output: summary,
        metadata: {
          processingTime: Date.now() - startTime,
          tokensUsed: 0, // Local model, no API tokens
          modelUsed: 'Xenova/distilbart-cnn-6-6'
        }
      }
    }
    
    // Use API
    const prompt = `
      Provide a concise summary of the following content in relation to:
      "${context.query}"
      
      Content:
      ${context.chunks.map(c => c.content).join('\n\n')}
      
      Format:
      - 2-3 sentence executive summary
      - 3-5 key points as bullet points
      - Any important caveats or limitations
    `
    
    const output = await this.aiClient.generateText(prompt)
    
    return {
      agentType: this.type,
      output,
      metadata: {
        processingTime: Date.now() - startTime,
        tokensUsed: this.estimateTokens(output),
        modelUsed: this.aiClient.currentModel
      }
    }
  }
}
```

### Agent Manager

```typescript
class AgentManager {
  private agents: Map<AgentType, DomainAgent> = new Map()
  
  constructor(aiClient: AIClient, ragEngine: RAGEngine) {
    this.agents.set('analogy-maker', new AnalogyMakerAgent(aiClient))
    this.agents.set('compliance-checker', new ComplianceCheckerAgent(aiClient))
    this.agents.set('key-terms', new KeyTermsAgent(aiClient))
    this.agents.set('summary', new SummaryAgent(aiClient))
  }
  
  async runAgent(
    agentType: AgentType,
    context: AgentContext
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentType)
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }
    return agent.run(context)
  }
  
  async runMultipleAgents(
    agentTypes: AgentType[],
    context: AgentContext
  ): Promise<AgentResult[]> {
    return Promise.all(
      agentTypes.map(type => this.runAgent(type, context))
    )
  }
}

// Export singleton getter
export function getAgentManager(
  aiClient: AIClient,
  ragEngine: RAGEngine
): AgentManager {
  return new AgentManager(aiClient, ragEngine)
}
```

---

## Multimodal Integration

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DOCUMENT UPLOAD                                     │
│  PDF / DOCX / XLSX / CSV                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  TEXT         │           │  IMAGES       │           │  EQUATIONS    │
│  EXTRACTION   │           │  EXTRACTION   │           │  EXTRACTION   │
│               │           │               │           │               │
│  PDF.js       │           │  Image        │           │  Mathpix API  │
│  Mammoth.js   │           │  Extractor    │           │  Regex        │
│  SheetJS      │           │               │           │  Fallback     │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        │                           ▼                           │
        │                   ┌───────────────┐                   │
        │                   │  IMAGE        │                   │
        │                   │  CAPTIONING   │                   │
        │                   │               │                   │
        │                   │  Xenova/      │                   │
        │                   │  vit-gpt2-    │                   │
        │                   │  image-       │                   │
        │                   │  captioning   │                   │
        │                   └───────────────┘                   │
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTENT AGGREGATION                                 │
│  Text + Image Captions + Tables + Equations → Unified Content           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CHUNKING & EMBEDDING                                │
│  Semantic boundaries • Structure preservation • Metadata enrichment     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Image Processing

```typescript
// lib/image-extractor.ts
interface ExtractedImage {
  id: string
  documentId: string
  pageNumber?: number
  dataUrl: string
  width: number
  height: number
  caption?: string
  alt?: string
  extractedAt: Date
}

// lib/image-captioner.ts
class ImageCaptioner {
  private model: Pipeline | null = null
  
  async initialize(): Promise<void> {
    if (!this.model) {
      const { pipeline } = await import('@xenova/transformers')
      this.model = await pipeline(
        'image-to-text',
        'Xenova/vit-gpt2-image-captioning'
      )
    }
  }
  
  async caption(imageDataUrl: string): Promise<string> {
    await this.initialize()
    const result = await this.model!(imageDataUrl)
    return result[0].generated_text
  }
}
```

### Equation Processing

```typescript
// lib/equation-extractor.ts
interface ExtractedEquation {
  id: string
  documentId: string
  pageNumber?: number
  latex: string
  mathml?: string
  ascii?: string
  description?: string
  isInline: boolean
  confidence?: number
  extractedAt: Date
}

// With Mathpix integration
async function extractEquations(
  document: ProcessedDocument,
  options: EquationExtractionOptions
): Promise<ExtractedEquation[]> {
  if (options.useMathpix && options.mathpixConfig?.appId) {
    try {
      const processor = new MathpixProcessor({
        mathpixConfig: options.mathpixConfig
      })
      
      return await processor.processImages(
        document.id,
        { mathpixPageImages: options.mathpixPageImages }
      )
    } catch (error) {
      console.warn('Mathpix failed, using regex fallback')
    }
  }
  
  // Regex-based fallback
  return extractWithRegex(document.content)
}
```

### Content Aggregation

```typescript
// lib/enhanced-pdf-processor.ts
async function aggregateContent(
  textContent: string,
  images: ExtractedImage[],
  tables: ExtractedTable[],
  equations: ExtractedEquation[]
): Promise<string> {
  let aggregated = textContent
  
  // Insert image captions at appropriate positions
  images.forEach(img => {
    if (img.caption) {
      const marker = `[Image on page ${img.pageNumber}]`
      aggregated = aggregated.replace(
        marker,
        `${marker}\nCaption: ${img.caption}`
      )
    }
  })
  
  // Insert table markdown
  tables.forEach(table => {
    aggregated += `\n\n[Table: ${table.headers.join(' | ')}]\n${table.markdown}`
  })
  
  // Insert equation descriptions
  equations.forEach(eq => {
    if (eq.description) {
      aggregated += `\n\n[Equation]: ${eq.latex}\nMeaning: ${eq.description}`
    }
  })
  
  return aggregated
}
```

---

## Scoring & Ranking

### Similarity Scoring

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

### Content-Type Boosting

```typescript
function calculateContentTypeBoost(
  chunk: ContentChunk,
  queryIntent: QueryIntent
): number {
  let boost = 1.0
  
  // Boost headings for overview queries
  if (queryIntent.type === 'overview' && chunk.metadata.isHeading) {
    boost *= 1.3
  }
  
  // Boost code for technical queries
  if (queryIntent.type === 'technical' && chunk.metadata.hasCode) {
    boost *= 1.2
  }
  
  // Boost tables for data queries
  if (queryIntent.type === 'data' && chunk.metadata.hasTable) {
    boost *= 1.25
  }
  
  // Boost equations for math queries
  if (queryIntent.type === 'mathematical' && chunk.metadata.hasEquation) {
    boost *= 1.3
  }
  
  return boost
}
```

### Importance Scoring

```typescript
// lib/advanced-chunking.ts
function calculateImportanceScore(chunk: ContentChunk): number {
  let score = 1.0
  
  // Heading boost
  if (/^#{1,3}\s/.test(chunk.content)) {
    score += 0.3
  }
  
  // Proper noun density
  const properNouns = (chunk.content.match(/[A-Z][a-z]+/g) || []).length
  const words = chunk.content.split(/\s+/).length
  score += Math.min(0.2, (properNouns / words) * 0.5)
  
  // Data presence
  if (/\d+%|\$[\d,]+|[\d,]+\s*(users|items|records)/i.test(chunk.content)) {
    score += 0.15
  }
  
  // Code presence
  if (/```[\s\S]+?```/.test(chunk.content)) {
    score += 0.1
  }
  
  return Math.min(2.0, score) // Cap at 2x
}
```

---

## Quality Metrics

### Metric Calculation

```typescript
// lib/rag-engine.ts
interface QualityMetrics {
  accuracy: number      // Source alignment
  completeness: number  // Query coverage
  clarity: number       // Response clarity
  confidence: number    // Overall confidence
}

function calculateMetrics(
  query: string,
  answer: string,
  sources: RetrievedChunk[]
): QualityMetrics {
  return {
    accuracy: calculateAccuracy(answer, sources),
    completeness: calculateCompleteness(query, answer),
    clarity: calculateClarity(answer),
    confidence: calculateConfidence(sources)
  }
}

function calculateAccuracy(answer: string, sources: RetrievedChunk[]): number {
  // Check if claims in answer are supported by sources
  const claims = extractClaims(answer)
  const supported = claims.filter(claim => 
    sources.some(s => s.content.toLowerCase().includes(claim.toLowerCase()))
  )
  return supported.length / Math.max(claims.length, 1)
}

function calculateCompleteness(query: string, answer: string): number {
  // Check if answer addresses main aspects of query
  const queryTerms = extractKeyTerms(query)
  const addressedTerms = queryTerms.filter(term =>
    answer.toLowerCase().includes(term.toLowerCase())
  )
  return addressedTerms.length / Math.max(queryTerms.length, 1)
}

function calculateClarity(answer: string): number {
  // Heuristics for clarity
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim())
  const avgLength = sentences.reduce((sum, s) => 
    sum + s.split(/\s+/).length, 0
  ) / sentences.length
  
  // Optimal sentence length: 15-25 words
  const lengthScore = avgLength >= 15 && avgLength <= 25 ? 1.0 :
    avgLength < 15 ? avgLength / 15 : 25 / avgLength
  
  return lengthScore
}

function calculateConfidence(sources: RetrievedChunk[]): number {
  // Average similarity of top sources
  const topSources = sources.slice(0, 5)
  return topSources.reduce((sum, s) => sum + s.similarity, 0) / topSources.length
}
```

---

## Configuration

### RAG Engine Configuration

```typescript
interface RAGConfig {
  // Retrieval settings
  maxChunksPerQuery: number      // Default: 25
  minSimilarityScore: number     // Default: 0.5
  enableDiversityBoost: boolean  // Default: true
  diversityWeight: number        // Default: 0.3
  
  // Processing settings
  enableRefinement: boolean      // Default: true
  maxTokenBudget: number         // Default: 4096
  enableContentTypeBoost: boolean // Default: true
  
  // Caching
  enableQueryCache: boolean      // Default: true
  queryCacheTTL: number          // Default: 300000 (5 min)
  enableEmbeddingCache: boolean  // Default: true
}

const defaultConfig: RAGConfig = {
  maxChunksPerQuery: 25,
  minSimilarityScore: 0.5,
  enableDiversityBoost: true,
  diversityWeight: 0.3,
  enableRefinement: true,
  maxTokenBudget: 4096,
  enableContentTypeBoost: true,
  enableQueryCache: true,
  queryCacheTTL: 300000,
  enableEmbeddingCache: true
}
```

### Agent Configuration

```typescript
interface AgentSettings {
  'analogy-maker'?: {
    enabled: boolean
    maxAnalogies?: number
  }
  'compliance-checker'?: {
    enabled: boolean
    strictMode?: boolean
  }
  'key-terms'?: {
    enabled: boolean
    maxTerms?: number
  }
  'summary'?: {
    enabled: boolean
    useLocalModels?: boolean
    maxLength?: number
  }
}

const defaultAgentSettings: AgentSettings = {
  'analogy-maker': { enabled: true, maxAnalogies: 3 },
  'compliance-checker': { enabled: true, strictMode: false },
  'key-terms': { enabled: true, maxTerms: 10 },
  'summary': { enabled: true, useLocalModels: true, maxLength: 500 }
}
```

---

## API Reference

### RAGEngine

```typescript
class RAGEngine {
  constructor(aiClient: AIClient, config?: Partial<RAGConfig>)
  
  // Document management
  addDocument(doc: ProcessedDocument): Promise<void>
  removeDocument(docId: string): void
  clearDocuments(): void
  
  // Querying
  query(text: string, options?: QueryOptions): Promise<RAGResult>
  streamQuery(text: string, options?: QueryOptions): AsyncGenerator<string>
  
  // Direct retrieval
  retrieveChunks(text: string, options?: RetrievalOptions): Promise<RetrievedChunk[]>
}
```

### AgentManager

```typescript
class AgentManager {
  constructor(aiClient: AIClient, ragEngine: RAGEngine)
  
  runAgent(type: AgentType, context: AgentContext): Promise<AgentResult>
  runMultipleAgents(types: AgentType[], context: AgentContext): Promise<AgentResult[]>
  getAvailableAgents(): AgentType[]
}
```

---

**Generated**: November 2025  
**Project**: QuantumPDF ChatApp v3.0.0

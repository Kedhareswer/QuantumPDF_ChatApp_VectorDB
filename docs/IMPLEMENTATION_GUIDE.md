# QuantumPDF Implementation Guide

> **Complete guide to implementing and extending QuantumPDF features**
> **Last updated: August 2026**

---

## Table of Contents

1. [Project Setup](#project-setup)
2. [Core Components](#core-components)
3. [AI Provider Configuration](#ai-provider-configuration)
4. [RAG Engine Implementation](#rag-engine-implementation)
5. [Guardrails & Safety](#guardrails--safety)
6. [Evaluation Metrics](#evaluation-metrics)
7. [Enhanced UI/UX Features](#enhanced-uiux-features)
8. [Multimodal Processing](#multimodal-processing)
9. [Vector Database Integration](#vector-database-integration)
10. [State Management](#state-management)
11. [Error Handling](#error-handling)

---

## Project Setup

### Prerequisites

```bash
Node.js >= 20.9.0
npm >= 9.0.0
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd QuantumPDF_ChatApp_VectorDB

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env.local` file:

```env
# AI Provider (choose one or more)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...

# Optional: Vector Database
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=us-east-1
WEAVIATE_URL=http://localhost:8080
WEAVIATE_API_KEY=your_key
```

---

## Core Components

### Application Structure

```
app/
├── page.tsx              # Main page with state orchestration
├── layout.tsx            # Root layout with providers
├── globals.css           # Global styles
└── manifest.ts           # PWA manifest (served at /manifest.webmanifest)

components/
├── chat-interface.tsx    # Chat with streaming + inline citations
├── document-filter.tsx   # Document filtering UI
├── chunk-visualization.tsx # Chunk visualization
├── query-history.tsx     # Query history (chat header)
├── quick-actions.tsx     # Clear / new session / export
├── onboarding-tour.tsx   # First-run driver.js tour
├── unified-pdf-processor.tsx  # Multi-format file upload
├── unified-configuration.tsx  # Settings panel
├── document-library.tsx  # Document management
└── system-status.tsx     # Health monitoring

lib/
├── ai-client.ts          # Multi-provider AI client
├── rag-engine.ts         # Core RAG with 3-phase processing
├── liteparse-client.ts   # Server-side PDF extraction (+ unpdf fallback)
├── anydoc-client.ts      # In-browser wasm extraction, all non-PDF formats
├── citation-format.ts    # Superscript citation rendering
├── store.ts              # Zustand state management
└── vector-database-client.ts  # Vector DB abstraction
```

### Key Interfaces

```typescript
// Document Types
interface ProcessedDocument {
  id: string
  filename: string
  content: string
  chunks: ContentChunk[]
  metadata: DocumentMetadata
  images?: ExtractedImage[]
  tables?: ExtractedTable[]
  equations?: ExtractedEquation[]
}

// Chunk Types
interface ContentChunk {
  id: string
  content: string
  embedding?: number[]
  metadata: ChunkMetadata
}

// AI Provider Types
type AIProvider = 
  | 'openai' | 'anthropic' | 'groq' | 'huggingface'
  | 'aiml' | 'fireworks' | 'deepinfra' | 'deepseek'
  | 'google-ai' | 'vertex-ai' | 'mistral' | 'perplexity'
  | 'xai' | 'alibaba' | 'minimax' | 'cerebras'
  | 'replicate' | 'anyscale' | 'openrouter'
```

---

## AI Provider Configuration

### Configuring AI Client

```typescript
import { AIClient } from '@/lib/ai-client'

// Initialize client
const aiClient = new AIClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
})

// Switch provider at runtime by constructing a new client
const anthropicClient = new AIClient({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
})

// Generate embeddings (accepts an array of texts, returns number[][])
const embeddings = await aiClient.generateEmbeddings(['Your text here'])

// Generate text (messages are role/content pairs)
const response = await aiClient.generateText([
  { role: 'system', content: 'Use the provided context.' },
  { role: 'user', content: 'Summarize this document' }
])

// Stream response (callback-based, not an async generator)
await aiClient.generateTextStream(
  [{ role: 'user', content: 'Explain this concept' }],
  (chunk) => process.stdout.write(chunk)
)
```

### Provider-Specific Models

```typescript
const PROVIDER_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  groq: ['llama-3.1-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  huggingface: ['meta-llama/Meta-Llama-3.1-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.2'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  xai: ['grok-beta', 'grok-vision-beta'],
  perplexity: ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online']
}
```

---

## RAG Engine Implementation

### Initializing RAG Engine

```typescript
import { RAGEngine, RAGConfig } from '@/lib/rag-engine'
import { AIClient } from '@/lib/ai-client'

const config: RAGConfig = {
  // Token budget per query
  maxTokenBudget: 4096,
  
  // Similarity threshold for retrieval
  minSimilarityScore: 0.5,
  
  // Maximum chunks per query
  maxChunksPerQuery: 25,
  
  // Enable diversity across documents
  enableDiversityBoost: true,
  
  // Content-type aware scoring
  enableContentTypeBoost: true,
  
  // Enable 3-phase processing
  enableRefinement: true
}

const ragEngine = new RAGEngine(aiClient, config)
```

### Processing Queries

```typescript
// Add documents to index
await ragEngine.addDocument(processedDocument)

// Query with 3-phase processing
const result = await ragEngine.query('What is the main topic?', {
  stream: true,
  onProgress: (phase, message) => {
    console.log(`${phase}: ${message}`)
  }
})

// Result structure
interface RAGResult {
  answer: string
  chunks: RetrievedChunk[]
  metrics: {
    accuracy: number
    completeness: number
    clarity: number
    confidence: number
  }
  phases: {
    contextAnalysis: string
    selfCritique: string
    refinedAnswer: string
  }
}
```

### 3-Phase Processing Flow

```typescript
// Phase 1: Context Analysis
const contextAnalysis = await analyzeContext(query, retrievedChunks)

// Phase 2: Self-Critique
const critique = await selfCritique(contextAnalysis)

// Phase 3: Refinement
const refinedAnswer = await refineAnswer(contextAnalysis, critique)
```

---

## Guardrails & Safety

The guardrails system (`lib/guardrails.ts`) provides comprehensive safety checks.

### Input Validation

```typescript
import { Guardrails } from '@/lib/guardrails'

// Validate user query
const validation = Guardrails.validateQueryInput(query)
if (!validation.isValid) {
  return { error: validation.errors.join('. ') }
}
const sanitizedQuery = validation.sanitizedInput || query
```

### Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/guardrails'

// Check rate limit (30 requests/minute per session)
const result = checkRateLimit(sessionId, { windowMs: 60000, maxRequests: 30 })
if (!result.allowed) {
  return { error: `Rate limit exceeded. Retry in ${result.retryAfterMs}ms` }
}
```

### Output Validation

```typescript
// Validate LLM response
const outputValidation = Guardrails.validateOutput(response, context, chunks)
if (outputValidation.toxicityScore > 0.5) {
  console.warn('High toxicity detected')
}
```

### PII Detection

```typescript
// Check for sensitive data in documents
const docValidation = Guardrails.validateDocument(content, fileName, fileSize)
if (docValidation.metadata.hasPII) {
  console.warn('Document contains PII')
}
```

---

## Evaluation Metrics

Track quality metrics for continuous improvement.

### Query Evaluation

```typescript
import { createQueryEvaluation, storeEvaluation } from '@/lib/guardrails'

const evaluation = createQueryEvaluation(
  queryId,
  question,
  chunks,          // Retrieved chunks
  response,        // Generated response
  groundednessScore,
  totalDocuments,
  retrievalLatencyMs,
  generationLatencyMs
)

storeEvaluation(evaluation)
```

### Analytics

```typescript
import { Evaluations } from '@/lib/guardrails'

const analytics = Evaluations.getEvaluationAnalytics()
// {
//   totalQueries: 100,
//   avgOverallScore: 0.76,
//   avgGroundedness: 0.85,
//   avgCitationCoverage: 0.72,
//   issueBreakdown: { "Low citation coverage": 15 },
//   recentTrend: "improving"
// }
```

### Latency Monitoring

```typescript
import { Evaluations } from '@/lib/guardrails'

const budget = { retrievalMs: 2000, generationMs: 30000, totalMs: 35000 }
const check = Evaluations.checkLatencyBudget('retrieval', elapsedMs, budget)
if (!check.withinBudget) {
  console.warn(`Retrieval exceeded budget by ${check.overageMs}ms`)
}
```

---

## Enhanced UI/UX Features

### Inline Citations

Citations render as compact superscripts inside the answer, followed by a
`Sources:` line. This replaced the earlier `SourceCards` / `CitationBadge`
components, which were removed — the formatting now lives in a plain helper
rather than a component tree.

```typescript
// lib/citation-format.ts — exports toSuperscript(n) and formatCitationsForDisplay(content)
import { formatCitationsForDisplay } from '@/lib/citation-format'

// Rewrites [1] / [1,2] markers in the answer body into superscripts (¹ ²).
// Used in components/chat-interface.tsx before handing content to react-markdown.
return formatCitationsForDisplay(cleaned.trim())
```

### Document Filtering

Multi-select document filter for scoped queries.

```typescript
// components/document-filter.tsx
import { DocumentFilter } from '@/components/document-filter'

<DocumentFilter
  documents={documents}
  selectedDocumentIds={selectedDocumentIds}
  onSelectionChange={(ids) => {
    setSelectedDocumentIds(ids)
    // Pass to RAG query
    ragEngine.query(query, { filters: { documentIds: ids } })
  }}
/>
```

### Chunk Visualization

Expandable view of retrieved chunks with similarity scores.

```typescript
// components/chunk-visualization.tsx
import { ChunkVisualization } from '@/components/chunk-visualization'

<ChunkVisualization
  chunks={response.chunks}
  onViewPage={handleViewPage}
/>
```

### Query History

Persistent query storage with search and re-run functionality.

```typescript
// components/query-history.tsx
import { QueryHistory, useQueryHistory } from '@/components/query-history'

// In component
const { addQueryHistory } = useQueryHistory()

// After query
addQueryHistory(query, response.length)

// In header
<QueryHistory onSelectQuery={handleQuerySelect} />
```

### Export Conversations

Export lives in the quick-actions menu in the chat header, not in a standalone
component (the old `export-menu.tsx` was an unused duplicate and was removed).

```typescript
// components/quick-actions.tsx
import { QuickActions } from '@/components/quick-actions'

// Renders clear / new-session / export. handleExportChat supports
// 'json' | 'markdown' | 'txt' | 'pdf'.
<QuickActions onClearChat={onClearChat} onNewSession={onNewSession} disabled={disabled} />
```

---

## Multimodal Processing

### PDF Text, OCR & Page Previews (server-side, liteparse)

PDF text, OCR, and page-preview images are extracted **server-side** by
`@llamaindex/liteparse` — a native Rust + PDFium NAPI module — wrapped by
`lib/liteparse-client.ts` and exposed at `POST /api/pdf/extract` (Node.js
runtime). OCR is controlled by liteparse's `ocrEnabled` option, and page
previews come from liteparse's `screenshot()`. If liteparse fails or returns no
text, the wrapper falls back to `unpdf` text extraction (serverless-safe).

The client orchestrator `lib/pdf-document-processor.ts` (`PdfDocumentProcessor`)
POSTs the uploaded file to that route, then runs the retained **client-side**
PDF.js extractors for embedded images, tables, and equations.

```typescript
import { PdfDocumentProcessor } from '@/lib/pdf-document-processor'

const processor = new PdfDocumentProcessor()

// POSTs the file to /api/pdf/extract for liteparse text/OCR/previews,
// then runs the client-side image/table/equation extractors.
const result = await processor.processFile(pdfFile, (progress) => {
  console.log(`${progress.stage}: ${progress.progress}%`)
})

result.text       // Full text content (liteparse)
result.chunks      // Chunked text
result.metadata    // pages, ocrUsed, extractionQuality, multimodal, ...
```

### Image Extraction (client-side, PDF.js)

```typescript
import { PDFImageExtractor } from '@/lib/image-extractor'

const extractor = new PDFImageExtractor()

// Extract embedded images / page previews from a loaded PDF.js document
const previews = await extractor.extractPagePreviews(pdfDocument)
const images = await extractor.extractInlineImages(pdfDocument)

// Image structure
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
```

### Image Captioning

**Not currently implemented.** `@xenova/transformers` was removed (no in-browser
model), and the `image-captioner.ts` / `vision-models.ts` modules that wrapped the
cloud fallbacks were deleted in the August 2026 cleanup because nothing imported
them.

`image-extractor.ts` still extracts embedded images and their metadata; they are
surfaced in the multimodal panel without captions. Wiring captions back up means
calling a vision-capable provider through `lib/ai-client.ts` at the point where
`DOCXImageExtractor` / the PDF.js image extractor return their results.

### Table Extraction

```typescript
import { PDFTableExtractor } from '@/lib/table-extractor'

const extractor = new PDFTableExtractor()

// Extract tables from text
const tables = await extractor.extractTablesFromText(documentText)

// Table structure
interface ExtractedTable {
  id: string
  documentId: string
  pageNumber?: number
  headers: string[]
  rows: string[][]
  markdown: string
  extractedAt: Date
}
```

### Complete Multimodal Pipeline

The full pipeline is orchestrated by `PdfDocumentProcessor`: liteparse provides
text, OCR, and page previews server-side; the client-side PDF.js extractors add
embedded images, tables, and equations. `components/unified-pdf-processor.tsx`
invokes it for uploaded PDFs.

```typescript
import { PdfDocumentProcessor } from '@/lib/pdf-document-processor'

const processor = new PdfDocumentProcessor()

const result = await processor.processFile(pdfFile, (progress) => {
  console.log(`${progress.stage}: ${progress.progress}%`)
})

// Result (PDFProcessingResult) includes
result.text            // Full text content (liteparse, PDF.js fallback)
result.chunks          // Chunked text
result.advancedChunks  // Semantic chunks (lib/advanced-chunking.ts)
result.metadata        // pages, ocrUsed, extractionQuality, multimodal, ...
```

---

## Vector Database Integration

### Local In-Memory (Default)

```typescript
import { VectorDatabaseClient } from '@/lib/vector-database-client'

const client = new VectorDatabaseClient({
  provider: 'local',
  dimension: 1536
})

// Add vectors
await client.upsert([
  { id: 'chunk-1', vector: [...], metadata: { content: '...' } }
])

// Search
const results = await client.query(queryVector, { topK: 10 })
```

### Pinecone Integration

```typescript
const client = new VectorDatabaseClient({
  provider: 'pinecone',
  apiKey: process.env.PINECONE_API_KEY,
  environment: 'us-east-1',
  indexName: 'quantumpdf',
  dimension: 1536
})

await client.initialize()
await client.upsert(vectors)
```

### Weaviate Integration

```typescript
const client = new VectorDatabaseClient({
  provider: 'weaviate',
  apiKey: process.env.WEAVIATE_API_KEY,
  environment: 'http://localhost:8080',
  indexName: 'Document',
  dimension: 1536
})

await client.initialize()
await client.upsert(vectors)
```

---

## State Management

### Zustand Store Structure

```typescript
// lib/store.ts
interface AppState {
  // Document State
  documents: ProcessedDocument[]
  currentDocumentId: string | null
  
  // AI State
  aiProvider: AIProvider
  aiConfig: AIConfig
  
  // Chat State
  messages: ChatMessage[]
  isStreaming: boolean
  
  // UI State
  sidebarOpen: boolean
  activeTab: string
  
  // Actions
  addDocument: (doc: ProcessedDocument) => void
  removeDocument: (id: string) => void
  setAIProvider: (provider: AIProvider) => void
  addMessage: (message: ChatMessage) => void
}
```

### Using Store in Components

```typescript
import { useAppStore } from '@/lib/store'

function MyComponent() {
  // Select specific state
  const documents = useAppStore((state) => state.documents)
  const addDocument = useAppStore((state) => state.addDocument)
  
  // Or destructure multiple values
  const { documents, aiConfig } = useAppStore()
  
  return (
    // Your component
  )
}
```

---

## Error Handling

### Error Boundary

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

function App() {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error, info) => {
        console.error('App Error:', error)
        // Report to telemetry
        telemetry.recordError(error, info)
      }}
    >
      <MainContent />
    </ErrorBoundary>
  )
}
```

### Toast Notifications

```typescript
import { useToast } from '@/hooks/use-toast'

function MyComponent() {
  const { toast } = useToast()
  
  const handleError = (error: Error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive'
    })
  }
  
  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Document processed successfully'
    })
  }
}
```

### Graceful Degradation

```typescript
// AI Provider Fallback (construct a new client to switch providers)
async function generateWithFallback(prompt: string) {
  const messages = [{ role: 'user' as const, content: prompt }]
  try {
    return await primaryClient.generateText(messages)
  } catch (error) {
    console.warn('Primary provider failed, trying fallback')
    const fallbackClient = new AIClient({
      provider: 'huggingface',
      apiKey: process.env.HUGGINGFACE_API_KEY!,
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct'
    })
    return await fallbackClient.generateText(messages)
  }
}

// Equation Extraction (Regex-based)
async function extractEquations(doc: ProcessedDocument) {
  return regexExtractor.extract(doc.content)
}
```

---

## Testing

### Unit Tests

```typescript
// Example pattern (Vitest, globals enabled)
import { AIClient } from '@/lib/ai-client'

describe('AIClient', () => {
  it('should generate embeddings', async () => {
    const client = new AIClient({ provider: 'openai', apiKey: 'test', model: 'text-embedding-3-small' })
    // generateEmbeddings takes an array of texts and returns number[][]
    const embeddings = await client.generateEmbeddings(['test text'])
    expect(embeddings[0]).toHaveLength(1536)
  })

  it('should construct a client per provider', () => {
    const client = new AIClient({ provider: 'anthropic', apiKey: 'test2', model: 'claude-3-5-sonnet-20241022' })
    expect(client).toBeInstanceOf(AIClient)
  })
})
```

### Integration Tests

```typescript
// Example pattern (Vitest, globals enabled)
import { RAGEngine } from '@/lib/rag-engine'

describe('RAGEngine', () => {
  it('should process queries with 3-phase refinement', async () => {
    const engine = new RAGEngine(mockAIClient)
    await engine.addDocument(testDocument)
    
    const result = await engine.query('What is the main topic?')
    
    expect(result.phases.contextAnalysis).toBeDefined()
    expect(result.phases.selfCritique).toBeDefined()
    expect(result.phases.refinedAnswer).toBeDefined()
  })
})
```

### Running Tests

Tests use **Vitest** (jsdom) and live in `__tests__/` with setup at
`__tests__/setup.ts`. Current test files: `logger.test.ts`,
`liteparse-client.test.ts`, and `citation-format.test.ts`.

```bash
# Run all tests (watch)
npx vitest

# Run once (no watch)
npx vitest run

# Run a single test file
npx vitest run __tests__/liteparse-client.test.ts
```

---

## Deployment

### Production Build

```bash
# Build optimized bundle (Turbopack)
npm run build

# Start production server
npm start
```

> **Native binary note:** `@llamaindex/liteparse` ships platform-specific native
> binaries via `optionalDependencies`. Run `npm install` on the **target**
> platform (e.g. Linux) so the correct binary is fetched — do **not** copy a
> Windows `node_modules` to a Linux host.

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...

# Optional services
PINECONE_API_KEY=...
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

---

**Generated**: June 2026  
**Project**: QuantumPDF ChatApp v3.1.0  
**Latest Updates**: Server-side liteparse PDF pipeline (Next.js 16 / React 19), compact citation superscripts, Guardrails, Evaluation Metrics

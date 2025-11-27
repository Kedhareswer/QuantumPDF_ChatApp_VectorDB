# QuantumPDF Implementation Guide

> **Complete guide to implementing and extending QuantumPDF features**
> **Last Updated: November 2025 | Version 3.0.0**

---

## Table of Contents

1. [Project Setup](#project-setup)
2. [Core Components](#core-components)
3. [AI Provider Configuration](#ai-provider-configuration)
4. [RAG Engine Implementation](#rag-engine-implementation)
5. [Enhanced UI/UX Features](#enhanced-uiux-features)
6. [Mathpix Integration](#mathpix-integration)
7. [Multimodal Processing](#multimodal-processing)
8. [Vector Database Integration](#vector-database-integration)
9. [State Management](#state-management)
10. [Error Handling](#error-handling)

---

## Project Setup

### Prerequisites

```bash
Node.js >= 18.0.0
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

# Optional: Mathpix (for professional equation OCR)
MATHPIX_APP_ID=your_app_id
MATHPIX_APP_KEY=your_app_key

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
└── manifest.json         # PWA manifest

components/
├── chat-interface.tsx    # Chat with streaming
├── source-card.tsx       # Interactive source cards
├── citation-badge.tsx    # Clickable citations
├── document-filter.tsx   # Document filtering UI
├── chunk-visualization.tsx # Chunk visualization
├── query-history.tsx    # Query history sidebar
├── export-menu.tsx      # Export conversations
├── unified-pdf-processor.tsx  # Multi-format file upload
├── unified-configuration.tsx  # Settings panel
├── document-library.tsx  # Document management
└── system-status.tsx     # Health monitoring

lib/
├── ai-client.ts          # Multi-provider AI client
├── rag-engine.ts         # Core RAG with 3-phase processing
├── mathpix-processor.ts  # Mathpix API + Math.js
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
import { AIClient, AIProvider } from '@/lib/ai-client'

// Initialize client
const aiClient = new AIClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
})

// Switch provider at runtime
aiClient.setProvider('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229'
})

// Generate embeddings
const embeddings = await aiClient.generateEmbeddings('Your text here')

// Generate text
const response = await aiClient.generateText(
  'Summarize this document',
  'Your context here'
)

// Stream response
const stream = aiClient.streamText(
  'Explain this concept',
  'Context information'
)
for await (const chunk of stream) {
  process.stdout.write(chunk)
}
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

## Enhanced UI/UX Features

### Source Cards

Interactive source display with document metadata and similarity scores.

```typescript
// components/source-card.tsx
import { SourceCards } from '@/components/source-card'

<SourceCards
  sources={response.sources}
  chunks={response.chunks}
  onViewPage={(documentId, page) => {
    // Navigate to PDF page
  }}
/>
```

### Clickable Citations

Inline citation badges that allow navigation to specific PDF pages.

```typescript
// components/citation-badge.tsx
import { CitationBadge } from '@/components/citation-badge'

// In markdown content, replace [1] with:
<CitationBadge
  index={1}
  source="Document Name · p.5"
  documentId="doc-123"
  page={5}
  onViewPage={handleViewPage}
/>
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

Export conversations in multiple formats.

```typescript
// components/export-menu.tsx
import { ExportMenu } from '@/components/export-menu'

<ExportMenu messages={messages} />
```

---

## Mathpix Integration

### Configuration

```typescript
// In unified-configuration.tsx
interface MathpixConfig {
  appId: string
  appKey: string
  enabled: boolean
}

// Store in Zustand
const useMathpixConfig = create((set) => ({
  mathpixConfig: {
    appId: '',
    appKey: '',
    enabled: false
  },
  setMathpixConfig: (config) => set({ mathpixConfig: config })
}))
```

### Using Mathpix Processor

```typescript
import { MathpixProcessor, MathpixConfig } from '@/lib/mathpix-processor'

// Initialize
const mathpixConfig: MathpixConfig = {
  appId: process.env.MATHPIX_APP_ID,
  appKey: process.env.MATHPIX_APP_KEY
}

const processor = new MathpixProcessor({ mathpixConfig })

// Process PDF page images
const result = await processor.processImages(documentId, {
  mathpixConfig,
  mathpixPageImages: [
    { page: 1, dataUrl: 'data:image/png;base64,...' },
    { page: 2, dataUrl: 'data:image/png;base64,...' }
  ],
  maxEquations: 50,
  detectInline: true,
  detectBlock: true
}, (progress) => {
  console.log(`Processing page ${progress.pageNumber}`)
})

// Result structure
interface MathpixExtractionResult {
  equations: ExtractedEquation[]
  totalFound: number
  extractionTime: number
}

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
```

### Math Expression Evaluation

```typescript
import { MathEvaluator } from '@/lib/mathpix-processor'

const evaluator = new MathEvaluator()

// Set variables
evaluator.setVariable('x', 5)
evaluator.setVariable('y', 10)

// Evaluate expressions
const result = evaluator.evaluate('x^2 + y')  // Returns 35

// Simplify expressions
const simplified = evaluator.simplify('2*x + 3*x')  // Returns '5*x'

// LaTeX to expression conversion happens automatically
// \frac{x}{y} → (x)/(y)
// \sqrt{x} → sqrt(x)
// \sin(x) → sin(x)
```

### Fallback to Regex Detection

```typescript
// equation-extractor.ts automatically falls back
async function extractEquations(document, options) {
  if (options.useMathpix && options.mathpixConfig?.appId) {
    // Try Mathpix first
    try {
      return await mathpixProcessor.processImages(...)
    } catch (error) {
      console.warn('Mathpix failed, falling back to regex')
    }
  }
  
  // Fallback to regex-based detection
  return regexBasedExtraction(document.content)
}
```

---

## Multimodal Processing

### Image Extraction

```typescript
import { ImageExtractor } from '@/lib/image-extractor'

const extractor = new ImageExtractor()

// Extract from PDF
const images = await extractor.extractFromPDF(pdfDocument)

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

```typescript
import { ImageCaptioner } from '@/lib/image-captioner'

const captioner = new ImageCaptioner()

// Initialize model (loads Xenova/vit-gpt2-image-captioning)
await captioner.initialize()

// Caption single image
const caption = await captioner.caption(imageDataUrl)

// Batch caption
const captions = await captioner.batchCaption(images, (progress) => {
  console.log(`Captioned ${progress.processed}/${progress.total}`)
})
```

### Table Extraction

```typescript
import { TableExtractor } from '@/lib/table-extractor'

const extractor = new TableExtractor()

// Extract tables from text
const tables = extractor.extractTables(documentText)

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

```typescript
import { EnhancedPDFProcessor } from '@/lib/enhanced-pdf-processor'

const processor = new EnhancedPDFProcessor({
  extractImages: true,
  extractTables: true,
  extractEquations: true,
  generateCaptions: true,
  useMathpix: true,
  mathpixConfig: {
    appId: '...',
    appKey: '...'
  }
})

const result = await processor.process(pdfFile, (progress) => {
  console.log(`${progress.stage}: ${progress.percent}%`)
})

// Result includes
result.content      // Full text content
result.chunks       // Processed chunks
result.images       // Extracted images with captions
result.tables       // Detected tables
result.equations    // Extracted equations
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
  
  // Mathpix State (NEW)
  mathpixConfig: MathpixConfig
  
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
  setMathpixConfig: (config: MathpixConfig) => void
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
// AI Provider Fallback
async function generateWithFallback(prompt: string) {
  try {
    return await aiClient.generateText(prompt)
  } catch (error) {
    console.warn('Primary provider failed, trying fallback')
    aiClient.setProvider('huggingface')
    return await aiClient.generateText(prompt)
  }
}

// Mathpix Fallback
async function extractEquations(doc: ProcessedDocument) {
  if (mathpixConfig.enabled) {
    try {
      return await mathpixProcessor.process(doc)
    } catch {
      // Fall back to regex
    }
  }
  return regexExtractor.extract(doc.content)
}
```

---

## Testing

### Unit Tests

```typescript
// __tests__/ai-client.test.ts
import { AIClient } from '@/lib/ai-client'

describe('AIClient', () => {
  it('should generate embeddings', async () => {
    const client = new AIClient({ provider: 'openai', apiKey: 'test' })
    const embeddings = await client.generateEmbeddings('test text')
    expect(embeddings).toHaveLength(1536)
  })
  
  it('should switch providers', () => {
    const client = new AIClient({ provider: 'openai', apiKey: 'test' })
    client.setProvider('anthropic', { apiKey: 'test2' })
    expect(client.currentProvider).toBe('anthropic')
  })
})
```

### Integration Tests

```typescript
// __tests__/rag-engine.test.ts
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

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Run specific file
npm test ai-client
```

---

## Deployment

### Production Build

```bash
# Build optimized bundle
npm run build

# Start production server
npm start

# Or export static files
npm run export
```

### Environment Configuration

```bash
# Production environment variables
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...

# Optional services
MATHPIX_APP_ID=...
MATHPIX_APP_KEY=...
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

**Generated**: November 2025  
**Project**: QuantumPDF ChatApp v3.0.0  
**Latest Updates**: Enhanced UI/UX features (Source Cards, Citations, Filtering, Chunk Visualization, Query History, Export)

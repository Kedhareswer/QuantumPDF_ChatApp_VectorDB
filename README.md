# QuantumPDF - AI Document Analysis Platform

> **Advanced document analysis with 3-phase RAG, guardrails, evaluation metrics, and 19+ AI providers**
> **Version 3.1.0 | June 2026**

![QuantumPDF](https://img.shields.io/badge/version-3.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

---
![flow.png](public/flow.png)

## 🌟 Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **3-Phase RAG** | Context Analysis → Self-Critique → Refined Answer |
| **19+ AI Providers** | OpenAI, Anthropic, Groq, DeepSeek, Mistral, and more |
| **Guardrails System** | Input validation, rate limiting, toxicity detection, PII detection |
| **Evaluation Metrics** | Retrieval quality, groundedness, citation coverage, latency tracking |
| **Cross-Document Retrieval** | Fair distribution with multi-document query detection |
| **Adaptive Hybrid Search** | Dynamic semantic/keyword weighting based on query type |
| **Enhanced UI/UX** | Source Cards, Citations, Filtering, Chunk Visualization, History, Export |
| **Multimodal Processing** | Images, tables, equations extracted and analyzed |
| **Multi-Format Support** | PDF, DOCX, XLSX, CSV processing |
| **Server-Side PDF Parsing** | Native liteparse (Rust + PDFium) text, OCR, and page previews |
| **PWA Support** | Install as desktop/mobile app |

### AI Provider Support (Updated June 2026)

<table>
<tr>
<td>

**Major Providers**
- ✅ OpenAI (GPT-5.1, GPT-4o, o3)
- ✅ Anthropic (Claude 4.5 Sonnet/Haiku)
- ✅ Google AI (Gemini 3 Pro, 2.5 Flash)
- ✅ xAI (Grok 4, Grok 3)
- ✅ Mistral (Large 3, Magistral)
- ✅ DeepSeek (V3.2, Reasoner)

</td>
<td>

**Fast Inference**
- ✅ Groq (Llama 4, GPT-OSS)
- ✅ Fireworks (Kimi K2, Qwen 3)
- ✅ Cerebras (Llama 3.3)
- ✅ Perplexity (Sonar Deep Research)

</td>
<td>

**Open Source & Enterprise**
- ✅ HuggingFace
- ✅ DeepInfra
- ✅ Replicate
- ✅ OpenRouter
- ✅ AIML API
- ✅ Anyscale

</td>
</tr>
</table>

### Enhanced UI/UX Features

| Feature | Purpose | Location |
|---------|---------|----------|
| 📄 **Source Cards** | Interactive source display with metadata | Below messages |
| 🔗 **Clickable Citations** | Inline citations with page navigation | In message content |
| 🔍 **Document Filtering** | Filter queries to specific documents | Above input |
| 📊 **Chunk Visualization** | View retrieved chunks with similarity scores | Expandable section |
| 📜 **Query History** | Persistent query storage and re-run | Header sidebar |
| 💾 **Export Conversations** | Export as Markdown, PDF, or clipboard | Header menu |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- API key (OpenAI, Anthropic, or other supported provider)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd QuantumPDF_ChatApp_VectorDB

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
# Required: At least one AI provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# Optional: Cloud vector database
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=us-east-1
```

---

## 📖 Usage

### Upload Documents

```
Supported formats: PDF, DOCX, DOC, XLSX, XLS, CSV, TSV
```

1. Click "Upload Documents" or drag & drop
2. Wait for processing (multimodal extraction)
3. Document appears in library

### Chat with Documents

1. Type your question
2. AI retrieves relevant context using 3-phase RAG
3. Response includes sources and confidence metrics

### Enhanced UI Features

1. **Source Cards**: View sources with similarity scores and page numbers
2. **Clickable Citations**: Click citations to jump to PDF pages
3. **Document Filtering**: Filter queries to specific documents using chips
4. **Chunk Visualization**: Expand to see all retrieved chunks
5. **Query History**: Access previous queries from sidebar
6. **Export**: Export conversations as Markdown or PDF

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Frontend                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Chat     │  │   Agent     │  │  Document   │  │   Config    │    │
│  │  Interface  │  │  Selector   │  │   Library   │  │   Panel     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Processing Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    PDF      │  │   Image     │  │   Table     │  │  Equation   │    │
│  │  Processor  │  │  Extractor  │  │  Extractor  │  │  Extractor  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           RAG Engine                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   Phase 1   │  │   Phase 2   │  │   Phase 3   │                      │
│  │  Context    │─▶│   Self      │─▶│   Refined   │                      │
│  │  Analysis   │  │  Critique   │  │   Answer    │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Enhanced UI/UX Features                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐               │
│  │  Source   │ │Citations  │ │  Filter   │ │  Chunks   │               │
│  │  Cards    │ │           │ │           │ │  View     │               │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘               │
│  ┌───────────┐ ┌───────────┐                                            │
│  │  History  │ │  Export   │                                            │
│  └───────────┘ └───────────┘                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI Providers                                    │
│  OpenAI │ Anthropic │ Groq │ DeepSeek │ Mistral │ 14+ more providers   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
QuantumPDF_ChatApp_VectorDB/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page component
│   ├── layout.tsx         # Root layout
│   └── manifest.json      # PWA manifest
├── components/            # React components
│   ├── chat-interface.tsx # Chat with streaming
│   ├── source-card.tsx   # Interactive source cards
│   ├── citation-badge.tsx # Clickable citations
│   ├── document-filter.tsx # Document filtering
│   ├── chunk-visualization.tsx # Chunk transparency
│   ├── query-history.tsx # Query persistence
│   ├── export-menu.tsx   # Conversation export
│   ├── unified-pdf-processor.tsx # File upload
│   └── unified-configuration.tsx # Settings panel
├── lib/                   # Core libraries
│   ├── ai-client.ts       # Multi-provider AI client
│   ├── rag-engine.ts      # 3-phase RAG system
│   ├── advanced-chunking.ts # Semantic chunking
│   └── store.ts           # Zustand state
├── types/                 # TypeScript definitions
├── docs/                  # Documentation
└── __tests__/             # Test files
```

---

## 🔧 Configuration

### AI Provider Settings

```typescript
// Configure in UI or programmatically
const aiConfig = {
  provider: 'openai',        // or 'anthropic', 'groq', etc.
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096
}
```

### RAG Engine Settings

```typescript
const ragConfig = {
  maxChunksPerQuery: 25,     // Retrieved context limit
  minSimilarityScore: 0.5,   // Relevance threshold
  enableDiversityBoost: true, // Multi-document fairness
  enableRefinement: true     // 3-phase processing
}
```

### UI Feature Configuration

```typescript
// Document filtering
const selectedDocumentIds = ['doc-1', 'doc-2']

// Query with filter
await ragEngine.query(query, {
  filters: { documentIds: selectedDocumentIds }
})

// Export conversations
<ExportMenu messages={messages} />

// Query history (auto-saves)
<QueryHistory onSelectQuery={handleQuery} />
```

---

## 📊 Performance

| Metric | Target | Achieved |
|--------|--------|----------|
| PDF Processing (1MB) | <15s | ~12s ✅ |
| Embedding Generation | <5s | ~4.5s ✅ |
| Vector Search | <100ms | ~80ms ✅ |
| Chat Response | <5s | ~3.5s ✅ |
| Cached Response | <500ms | ~200ms ✅ |

---

## 🧪 Testing

```bash
# Run all tests (watch mode)
npx vitest

# Run tests once (no watch)
npx vitest run

# Run a single test file
npx vitest run liteparse-client
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICK_START_GUIDE.md) | 5-minute setup |
| [Architecture](docs/ARCHITECTURE_FLOWS.md) | System diagrams |
| [RAG Guide](docs/RAG_ARCHITECTURE.md) | RAG implementation |
| [Implementation](docs/IMPLEMENTATION_GUIDE.md) | Code reference |
| [Optimization](docs/OPTIMIZATION_GUIDE.md) | Performance tips |
| [Project Status](docs/PROJECT_STATUS.md) | Feature status |
| [PWA Guide](docs/PWA_GUIDE.md) | Progressive Web App |

---

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (Turbopack), React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State** | Zustand |
| **PDF** | @llamaindex/liteparse (native server-side; PDF.js fallback + client image/table/equation extractors) |
| **Documents** | Mammoth.js, SheetJS (pinned to the SheetJS CDN tarball), PapaParse |
| **Local AI** | None in-browser — local summarization falls back to extractive |
| **Vector DB** | In-Memory, Pinecone, Weaviate |
| **Testing** | Vitest, Playwright |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT models
- [Anthropic](https://anthropic.com) for Claude models
- [Hugging Face](https://huggingface.co) for the Inference API
- [Vercel](https://vercel.com) for Next.js
- [shadcn/ui](https://ui.shadcn.com) for UI components

---

<p align="center">
  <strong>Built with ❤️ for document intelligence</strong>
</p>

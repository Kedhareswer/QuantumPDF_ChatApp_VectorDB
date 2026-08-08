# QuantumPDF - AI Document Analysis Platform

> **Advanced document analysis with 3-phase RAG, guardrails, evaluation metrics, and 14 AI providers**

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
| **14 AI Providers** | OpenAI, Anthropic, Google, Groq, DeepSeek, Mistral, xAI, and more |
| **Guardrails System** | Input validation, rate limiting, toxicity detection, PII detection |
| **Evaluation Metrics** | Retrieval quality, groundedness, citation coverage, latency tracking |
| **Cross-Document Retrieval** | Fair distribution with multi-document query detection |
| **Adaptive Hybrid Search** | Dynamic semantic/keyword weighting based on query type |
| **Enhanced UI/UX** | Inline citations, filtering, chunk visualization, history, export |
| **Multimodal Processing** | Images, tables, equations extracted and analyzed |
| **Multi-Format Support** | PDF, Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV/TSV |
| **Server-Side PDF Parsing** | Native liteparse (Rust + PDFium) text, OCR, and page previews |
| **In-Browser Document Parsing** | Everything non-PDF is converted to Markdown by anydoc compiled to WebAssembly — the bytes never leave your machine |
| **Guided Onboarding** | First-run product tour (driver.js) |
| **PWA Support** | Install as desktop/mobile app |

### AI Provider Support

<table>
<tr>
<td>

**Major Providers**
- ✅ OpenAI (GPT-5.6 Sol / Terra / Luna)
- ✅ Anthropic (Claude 5 Fable / Opus / Sonnet)
- ✅ Google AI (Gemini 3.6 / 3.5 Flash)
- ✅ xAI (Grok 4.5, Grok 4.3)
- ✅ Mistral (Large / Medium / Small, Ministral 3)
- ✅ DeepSeek (V4 Pro, V4 Flash)

</td>
<td>

**Fast Inference**
- ✅ Groq (GPT-OSS, MiniMax M2.7, Qwen 3.6)
- ✅ Fireworks (DeepSeek V4, Kimi K3, GLM 5.2)
- ✅ Cerebras (GPT-OSS 120B, Gemma 4)
- ✅ Perplexity (OpenAI-compatible gateway)

</td>
<td>

**Open Source & Enterprise**
- ✅ HuggingFace
- ✅ DeepInfra
- ✅ OpenRouter
- ✅ AIML API

</td>
</tr>
</table>

### Enhanced UI/UX Features

| Feature | Purpose | Location |
|---------|---------|----------|
| 🔗 **Inline Citations** | Compact superscripts with a Sources line under each answer | In message content |
| 🔍 **Document Filtering** | Filter queries to specific documents | Above input |
| 📊 **Chunk Visualization** | View retrieved chunks with similarity scores | Expandable section |
| 📜 **Query History** | Persistent query storage and re-run | Chat header |
| 💾 **Export Conversations** | Export as JSON, Markdown, TXT or PDF | Quick actions menu |
| 🧭 **First-Run Tour** | Points at provider setup, upload and chat | On first visit (desktop) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- npm 9+ (pnpm works too)
- API key (OpenAI, Anthropic, or other supported provider)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd QuantumPDF_ChatApp_VectorDB

# Install dependencies
npm install

# Configure environment (see Environment Variables below for the full list)
# Create .env.local and add at least one AI provider key.
# You can also skip this entirely and paste a key into the in-app Settings tab.

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
PDF                                    up to 100 MB — server-side, with OCR for scanned pages
DOC DOCX DOCM ODT RTF EPUB             up to  50 MB — in-browser
PPT PPTX PPS ODP                       up to  50 MB — in-browser
XLS XLSX XLSM XLSB ODS CSV TSV         up to  50 MB — in-browser
```

1. Click "Upload Documents" or drag & drop
2. Wait for processing (multimodal extraction)
3. Document appears in library

### Chat with Documents

1. Type your question
2. AI retrieves relevant context using 3-phase RAG
3. Response includes sources and confidence metrics

### Enhanced UI Features

1. **Inline Citations**: Superscript markers in the answer, with a Sources line beneath it
2. **Document Filtering**: Filter queries to specific documents using chips
3. **Chunk Visualization**: Expand to see all retrieved chunks and their similarity scores
4. **Query History**: Access previous queries from the chat header
5. **Export**: Export conversations as JSON, Markdown, TXT or PDF

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Frontend                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Chat     │  │   Document   │  │  Document   │  │   Config    │    │
│  │  Interface  │  │   Processor  │  │   Library   │  │   Panel     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Extraction Layer                                │
│  ┌──────────────────────────┐   ┌──────────────────────────────────┐   │
│  │  PDF: liteparse (server) │   │  Non-PDF: anydoc-wasm (browser)  │   │
│  │  text · OCR · previews   │   │  Word/Slides/Sheets/EPUB → MD    │   │
│  └──────────────────────────┘   └──────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   Image     │  │   Table     │  │  Equation   │  (client, PDF.js)   │
│  │  Extractor  │  │  Extractor  │  │  Extractor  │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
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
│  │ Citations │ │  Filter   │ │  Chunks   │ │  History  │               │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘               │
│  ┌───────────┐ ┌───────────┐                                            │
│  │  Export   │ │   Tour    │                                            │
│  └───────────┘ └───────────┘                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          AI Providers                                    │
│  OpenAI │ Anthropic │ Google │ Groq │ DeepSeek │ Mistral │ 8 more        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
QuantumPDF_ChatApp_VectorDB/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page component
│   ├── layout.tsx         # Root layout
│   └── manifest.ts        # PWA manifest (served at /manifest.webmanifest)
├── components/            # React components
│   ├── chat-interface.tsx # Chat with streaming + citations
│   ├── document-filter.tsx # Document filtering
│   ├── chunk-visualization.tsx # Chunk transparency
│   ├── query-history.tsx # Query persistence
│   ├── quick-actions.tsx # Clear / new session / export
│   ├── onboarding-tour.tsx # First-run driver.js tour
│   ├── unified-pdf-processor.tsx # File upload
│   ├── unified-configuration.tsx # Settings panel
│   └── ui/                # shadcn primitives (only the ones in use)
├── lib/                   # Core libraries
│   ├── ai-client.ts       # Multi-provider AI client
│   ├── rag-engine.ts      # 3-phase RAG system
│   ├── advanced-chunking.ts # Semantic chunking
│   ├── liteparse-client.ts # Server-side PDF extraction
│   ├── anydoc-client.ts   # In-browser wasm extraction (non-PDF)
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

### Scoping a Query to Specific Documents

```typescript
// The document filter chips above the input drive this
await ragEngine.query(query, {
  filters: { documentIds: ['doc-1', 'doc-2'] }
})
```

---

## 📊 Performance

Rough figures from local runs — they depend heavily on your provider, document size and network, so treat them as ballpark rather than guarantees.

| Metric | Ballpark |
|--------|----------|
| PDF text extraction (1 MB, no OCR) | a few seconds |
| Non-PDF extraction (in-browser wasm) | sub-second after the module is warm |
| First non-PDF upload | + one-off ~6 MB wasm download, prefetched on page load |
| Vector search (local, in-memory) | tens of milliseconds |
| Chat response | dominated by provider latency |

---

## 🧪 Testing

```bash
# Run tests once (no watch)
npm test

# Watch mode
npx vitest

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
| [PWA Guide](docs/PWA_GUIDE.md) | Progressive Web App |
| [Security Residuals](docs/SECURITY-RESIDUALS.md) | Known accepted risks |
| [CLAUDE.md](CLAUDE.md) | Architecture reference for AI coding agents |

---

## 🛠 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (Turbopack), React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State** | Zustand (persist middleware) |
| **PDF** | @llamaindex/liteparse (native, server-side; unpdf fallback + client-side image/table/equation extractors) |
| **Documents** | @firecrawl/anydoc-wasm (in-browser WebAssembly → Markdown), PapaParse (TSV→CSV) |
| **Onboarding** | driver.js |
| **Local AI** | None in-browser — all inference goes to the configured provider |
| **Vector DB** | In-Memory, Pinecone, Weaviate |
| **Testing** | Vitest + Testing Library (jsdom) |

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

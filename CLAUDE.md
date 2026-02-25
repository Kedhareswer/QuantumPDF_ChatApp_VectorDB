# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000 (Turbopack)

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting
npm run lint         # Run Next.js ESLint

# Testing (Vitest + jsdom)
npx vitest           # Run all tests
npx vitest run       # Run tests once (no watch)
npx vitest run <file> # Run a single test file

# PWA
npm run pwa:icons:svg  # Generate SVG icons
npm run pwa:icons:png  # Generate PNG icons
npm run pwa:test       # Build + start for PWA testing
```

Tests live in `__tests__/` with setup at `__tests__/setup.ts`. The path alias `@/*` resolves to the repo root.

## Architecture Overview

QuantumPDF is a full-stack Next.js 16 + React 19 document analysis platform. All core business logic lives in **`/lib/`** (35 files). UI is in **`/components/`** (32+ files). API routes are in **`/app/api/`**.

### Request Flow

1. User uploads document → `components/unified-pdf-processor.tsx` dispatches to the relevant processor in `lib/` (`pdf-parser.ts`, `enhanced-pdf-processor.ts`, `docx-processor.ts`, `spreadsheet-processor.ts`)
2. Document text is chunked by `lib/advanced-chunking.ts` (semantic-aware, adaptive chunk sizing with overlap)
3. Chunks are embedded via `lib/ai-client.ts` (with 30-min TTL embedding cache) and stored in the vector DB via `lib/vector-database-client.ts`
4. User query → `lib/guardrails.ts` input validation → `lib/query-processor.ts` (HyDE, step-back prompting, query caching)
5. `lib/rag-engine.ts` orchestrates 3-phase RAG: **Phase 1** vector retrieval → **Phase 2** self-critique → **Phase 3** refined answer generation
6. Output passes through `lib/guardrails.ts` output validation (groundedness, hallucination detection) before returning to the UI

### Key Modules

| Module | Role |
|--------|------|
| `lib/ai-client.ts` | Multi-provider AI gateway (18+ providers: OpenAI, Anthropic, Groq, Gemini, Mistral, DeepSeek, etc.) |
| `lib/rag-engine.ts` | 3-phase RAG orchestrator with quality metrics (accuracy, completeness, clarity, confidence) |
| `lib/query-processor.ts` | HyDE + step-back prompting, query type classification, per-document-hash cache |
| `lib/advanced-chunking.ts` | Semantic-aware chunking with metadata (keywords, importance, word count) |
| `lib/vector-database-client.ts` | Abstraction over Pinecone, Weaviate, and local in-memory implementations |
| `lib/guardrails.ts` | PII detection, injection prevention, rate limiting, output groundedness checks |
| `lib/store.ts` | Zustand store (persistent) — messages, documents, AI config, vector DB config, UI state |
| `lib/cache-system.ts` | Shared cache infrastructure used by embedding and query caches |

### Multimodal Document Processing

PDF extraction uses PDF.js + Tesseract.js OCR. Additional extractors in `lib/`:
- `image-extractor.ts` + `image-captioner.ts` — extracts and captions embedded images
- `table-extractor.ts` — structured table extraction
- `equation-extractor.ts` — math equations via KaTeX
- `ocr-processor.ts` — fallback OCR for scanned pages

### API Routes

- `POST /api/pdf/extract` — server-side PDF extraction
- `POST /api/search/unified` — unified vector + keyword search
- `GET|POST /api/vector-db` — vector DB CRUD operations
- `POST /api/huggingface/*` — proxies to HuggingFace Inference API

### State Management

Zustand store in `lib/store.ts` with `persist` middleware (localStorage). All component state derives from here — avoid local component state for anything that should survive re-renders.

## Important Configuration Notes

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` — TypeScript errors will not fail the build. Fix type errors but don't rely on the build to catch them.
- `onnxruntime-node`, `@huggingface/transformers`, and `sharp` are server-external packages and must not be imported in client components.
- Node.js built-ins (`fs`, `net`, `tls`, etc.) are polyfilled to `false` on the client — any server-only code must stay in API routes or be gated with `typeof window === 'undefined'`.
- Turbopack is the default bundler (Next.js 16).

## Environment Variables

At minimum, one AI provider key is required:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
GOOGLE_API_KEY=
DEEPSEEK_API_KEY=
MISTRAL_API_KEY=

# Optional: cloud vector DB (falls back to local in-memory)
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# Optional: additional providers
HUGGINGFACE_API_KEY=
OPENROUTER_API_KEY=
```

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS 4, shadcn/ui (Radix UI primitives), Framer Motion
- **State:** Zustand with persist middleware
- **PDF/Docs:** pdfjs-dist, tesseract.js, mammoth (DOCX), xlsx + papaparse (spreadsheets)
- **Local AI:** @xenova/transformers (Transformers.js, runs in-browser)
- **Vector DB:** @pinecone-database/pinecone, weaviate-ts-client
- **Markdown:** react-markdown + remark-gfm + rehype-katex
- **Testing:** Vitest + @testing-library/react + jsdom, Playwright (E2E)
- **Icons:** Lucide React

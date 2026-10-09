# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000 (Turbopack)

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting (ESLint 9 flat config — eslint.config.mjs; there is no .eslintrc)
npm run lint         # Run Next.js ESLint

# Testing (Vitest + jsdom)
npm test             # Run tests once (no watch)
npx vitest           # Watch mode
npx vitest run <file> # Run a single test file
npm run test:e2e     # Playwright: production build + real browser, provider stubbed (e2e/)

# PWA
npm run pwa:icons    # Regenerate every PWA icon from public/brain.png (needs sharp)
npm run pwa:test     # Build + start for PWA testing
```

Unit tests live in `__tests__/` with setup at `__tests__/setup.ts`; Playwright specs live in `e2e/` (config: `playwright.config.ts`, which uses `/opt/pw-browsers/chromium` when present). The path alias `@/*` resolves to the repo root.

## Architecture Overview

QuantumPDF is a full-stack Next.js 16 + React 19 document analysis platform. All core business logic lives in **`/lib/`** (26 files). UI is in **`/components/`** (19 files + 21 shadcn primitives in `components/ui/`). API routes are in **`/app/api/`**.

**Keep it that way.** An August 2026 sweep deleted 50 unreferenced files (~9,700 lines) and 31 unused dependencies. Before adding a `lib/` module or a `components/ui/` primitive, check that something actually imports it — the accumulation was entirely files that were written, never wired up, and then described in the docs as if they were live. A quick reachability check from `app/**` beats trusting the docs.

### Request Flow

1. User uploads document → `components/unified-pdf-processor.tsx` dispatches on file type: PDFs to `lib/pdf-document-processor.ts` (server-side liteparse route), everything else to `lib/document-processor.ts` (in-browser anydoc wasm). See the document pipeline below.
2. Document text is chunked by `lib/advanced-chunking.ts` (semantic-aware, adaptive chunk sizing with overlap)
3. Chunks are embedded via `lib/ai-client.ts` (with 30-min TTL embedding cache) and stored in the vector DB via `lib/vector-database-client.ts`
   - Providers with an embeddings API (`PROVIDER_SPECS[...].embeddings`) are called in batches; a failure **throws**. Providers without one (Anthropic, Groq, DeepSeek, xAI, …) always use `generateLexicalEmbedding` (feature-hashed keywords). Never mix the two: vectors from different spaces make cosine scores meaningless. `AIClient.embeddingSpaceId` identifies the space, and `RAGEngine.initialize` re-embeds loaded documents when it changes.
   - Retrieval runs in the browser over `RAGEngine.documents`. When Pinecone/Weaviate is configured, `app/page.tsx` attaches it via `ragEngine.setVectorSearch(...)`: its nearest-neighbour hits are *added* to the candidate set and get their own vote in rank fusion. The full in-browser scan always runs too, so a remote index that is missing documents can only add recall, never hide chunks. For the `local` provider, `VectorDatabaseClient` makes no server calls at all.
   - Documents (chunks + Float32 embeddings + `embeddingSpace`) and chat history persist in IndexedDB via `lib/session-persistence.ts` and are restored on load. The AI API key is deliberately *not* persisted.
   - PDF chunks carry page numbers: `liteparse-client.ts` joins per-page text (`joinPages`) and `buildChunks(..., pageStarts)` returns `chunkPages`, aligned index-for-index with `chunks`, which travels on the document so citations can say `[file, p.N]`.
4. User query → `lib/guardrails.ts` input validation → `lib/query-processor.ts` (HyDE, step-back prompting, query caching)
5. `lib/rag-engine.ts` orchestrates 3-phase RAG: **Phase 1** hybrid retrieval + draft answer → **Phase 2** LLM fact-check (`verifyAnswer`: per-claim supported/unsupported verdicts as JSON) → **Phase 3** revision, only when the check says `revise`, followed by a re-check of the revised answer
6. `groundednessScore` / `hallucinationDetected` come from the verifier's claim verdicts on the *final* answer; the lexical `checkGroundedness` heuristic is only the fallback when the verifier's JSON doesn't parse (or in fast mode).
7. `lib/guardrails.ts` `validateOutput` is **enforced**: the displayed answer is its `sanitizedOutput` (control characters stripped; emails/phones/SSNs/Luhn-valid card numbers that appear in no retrieved source are redacted), and its remaining findings ride along as `warnings` shown under the answer.
8. **Fast answers** (store `fastMode`, toggle in the chat's advanced controls) skip follow-up resolution, query rewriting/HyDE/step-back and the fact check: one LLM call per question. Retrieval keeps only chunks within `RAGEngine.RELATIVE_FLOOR` (50%) of the best match.

### Key Modules

| Module | Role |
|--------|------|
| `lib/ai-client.ts` | Multi-provider AI gateway (18+ providers: OpenAI, Anthropic, Groq, Gemini, Mistral, DeepSeek, etc.) |
| `lib/rag-engine.ts` | 3-phase RAG orchestrator with quality metrics (accuracy, completeness, clarity, confidence) |
| `lib/query-processor.ts` | HyDE + step-back prompting, query type classification, per-document-hash cache |
| `lib/advanced-chunking.ts` | Semantic-aware chunking with metadata (keywords, importance, word count) |
| `lib/vector-database-client.ts` | Browser client for `/api/vector-db` (Pinecone, Weaviate); no-op for `local` |
| `lib/session-persistence.ts` | IndexedDB persistence of documents + chat history across reloads |
| `lib/guardrails.ts` | PII detection, injection prevention, rate limiting, output groundedness checks |
| `lib/store.ts` | Zustand store (persistent) — messages, documents, AI config, vector DB config, UI state |

### Multimodal Document Processing

Two Rust engines split the work, both bundled into the deploy (no external service, no API key) — but they run in different places:

| Input | Engine | Where it runs | Wrapper |
|---|---|---|---|
| PDF | `@llamaindex/liteparse` (PDFium, native addon) — text, OCR, page previews | server, `POST /api/pdf/extract` | `lib/liteparse-client.ts` |
| DOC/DOCX/DOCM, ODT, RTF, EPUB, PPT/PPTX/PPS, ODP, XLS/XLSX/XLSM/XLSB, ODS, CSV, TSV | `@firecrawl/anydoc-wasm` (MIT) → GitHub-Flavored Markdown | **browser (WebAssembly)** | `lib/anydoc-client.ts` |

PDFs stay on liteparse because **anydoc has no OCR and no page previews** — it errors on scanned/image-only PDFs by design. OCR is controlled by liteparse's `ocrEnabled` option; if liteparse fails or returns no text, the wrapper falls back to `unpdf` text extraction.

anydoc notes:
- **Runs entirely in the tab.** There is no `/api/document/extract` route any more, and no native anydoc addon: document bytes never leave the machine, and there is no per-platform binary to keep alive. `lib/anydoc-client.ts` is a `"use client"` module.
- The wasm module is ~6MB and is **prefetched on page load**: `app/page.tsx` calls `prefetchAnydoc()` from a `requestIdleCallback` so the download starts in the background without competing with the app's own startup chunks, and the first upload doesn't wait on it. `loadAnydoc()` memoizes the `import()` + `init()`, so an extraction that starts mid-prefetch awaits the same promise rather than fetching twice; a failed init clears the cache so the next upload retries (prefetch failures are swallowed, and surface at the real extraction instead). Turbopack emits the binary to `.next/static/media/*.wasm` via wasm-bindgen's `new URL(..., import.meta.url)` pattern.
- Calls are **synchronous** and single-threaded — `toMarkdownBytes` returns a `string`, not a promise, and blocks the main thread. Move it to a Worker if a large sheet makes that visible.
- No `Buffer` in this module — it is browser code. Use `TextEncoder`/`TextDecoder`.
- TSV has no byte signature and no anydoc format, so `anydoc-client.ts` re-emits it as CSV via a papaparse round-trip (preserves fields containing commas).
- Format detection is `formatFromBytes` first, `formatFromExtension` as fallback — legacy `.xls` carries no signature anydoc sniffs and only resolves via the extension. Both return `undefined` (not `null`) when nothing matches.
- Extraction failures **throw**; the thrown `Error` carries a `code` (`unsupported`, `malformed`, `encrypted`, `resourceLimit`, `missingPart`). Do not reintroduce the old "processing failed" fallback report, which silently indexed the error text as if it were the document.
- `MAX_MARKDOWN_CHARS` (1M) caps a pathological document; the truncation is surfaced as a warning.
- `SUPPORTED_EXTENSIONS` is the single source of truth for the accepted non-PDF list — `unified-pdf-processor.tsx` imports it rather than duplicating it.

The client orchestrator `lib/pdf-document-processor.ts` POSTs the uploaded file to that route, then runs the retained **client-side** PDF.js extractors for embedded content:
- `image-extractor.ts` — extracts embedded images
- `table-extractor.ts` — structured table extraction
- `equation-extractor.ts` — math equations via KaTeX

`pdfjs-dist` is no longer the primary text engine — it now backs only these client-side extractors (loaded via `lib/pdf-client.js`) and the server-side fallback in `liteparse-client.ts`. (The unused URL-ingestion module `enhanced-url-processor.ts` and the `/api/search/unified` route were removed in October 2026.)

### API Routes

- `POST /api/pdf/extract` — server-side PDF text/OCR/preview extraction via liteparse (Node.js runtime)
- `GET|POST /api/vector-db` — vector DB CRUD operations
- `POST /api/huggingface/text`, `POST /api/huggingface/embedding` — proxies to Hugging Face Inference Providers. They use the caller's key; the server's `HUGGINGFACE_API_KEY` is only used for same-origin requests and is rate-limited per IP (`lib/server-key-guard.ts`). Set `HUGGINGFACE_SERVER_KEY=disabled` to never share it.
- `GET /api/ping` — health check

### State Management

Zustand store in `lib/store.ts` with `persist` middleware (localStorage). All component state derives from here — avoid local component state for anything that should survive re-renders.

## Important Configuration Notes

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` — TypeScript errors will not fail the build. Fix type errors but don't rely on the build to catch them.
- `@llamaindex/liteparse`, `onnxruntime-node`, `@huggingface/transformers`, and `sharp` are server-external packages (`serverExternalPackages` in `next.config.mjs`) and must not be imported in client components. `@firecrawl/anydoc-wasm` is the opposite — it is client-only. Both are excluded from Vite's dep scanning in `vitest.config.ts`; without that the test worker dies trying to pre-bundle the `.node` binary and the 6MB `.wasm`.
- **Native binaries / deployment:** only `@llamaindex/liteparse` still ships platform-specific native binaries via `optionalDependencies` (e.g. `@llamaindex/liteparse-linux-x64-gnu`). A production deploy must run `npm install` on the target platform (e.g. Linux) so the correct native binary is fetched — do **not** copy a Windows `node_modules` to a Linux host. `outputFileTracingIncludes` in `next.config.mjs` traces it into the `/api/pdf/extract` function; a new route using liteparse needs an entry there. anydoc needs none of this — wasm is platform-independent and ships as a static asset.
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
- **PDF/Docs:** @llamaindex/liteparse (native server-side PDF text/OCR/previews), @firecrawl/anydoc-wasm (in-browser WebAssembly, every non-PDF format → Markdown), unpdf (serverless-safe PDF text fallback), pdfjs-dist (client-side multimodal extractors), papaparse (TSV→CSV only), jszip (DOCX embedded images). `mammoth`, `xlsx` and `tesseract.js` were all removed — anydoc replaced the first two, and liteparse's `ocrEnabled` replaced the last.
- **Onboarding:** driver.js — first-run product tour in `components/onboarding-tour.tsx`, anchored on `data-tour` attributes plus `#chat-input`. Desktop-only (below `lg` the sidebar it points at is off-canvas), gated on the `quantum-pdf-tour-completed` localStorage flag, which is set on start rather than on finish so StrictMode's double-mount cannot burn it.
- **Local AI:** none in-browser. `@xenova/transformers` was removed, and so were the unreferenced `local-summarizer.ts` / `vision-models.ts` fallbacks that depended on it. Summarization and captioning go through the configured cloud provider.
- **Vector DB:** @pinecone-database/pinecone, weaviate-ts-client
- **Markdown:** react-markdown + remark-gfm + rehype-katex
- **Testing:** Vitest + @testing-library/react + jsdom, Playwright (E2E)
- **Icons:** Lucide React

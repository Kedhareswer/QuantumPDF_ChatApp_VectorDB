# Replace PDF Parser Engine with liteparse — Design

- **Date:** 2026-06-04
- **Status:** Approved (design); implementing
- **Scope:** Goal 2 of 2. Builds on Goal 1 (branch `feat/liteparse-pdf-parser`, off `chore/dependency-upgrade-cleanup`).

## 1. Context

The current PDF pipeline extracts text **client-side** via PDF.js (`lib/enhanced-pdf-processor.ts`, `EnhancedPDFProcessor`), with Tesseract OCR (`ocr-processor.ts`), table extraction (`table-extractor.ts`), embedded-image extraction (`image-extractor.ts`), equation extraction (`equation-extractor.ts`), page previews, and multimodal metadata. There are also redundant/legacy modules (`pdf-parser.ts`, `pdf-processor-advanced.ts`, `pdf-processor-browser.ts`, `pdf-init.ts`) and a server route `app/api/pdf/extract/route.ts` (PDF.js).

`@llamaindex/liteparse` (Node/TS) is a document parser exposing `new LiteParse().parse(input)` → `{ text, pages: [{ pageNum, textItems(with bbox) }] }`, with built-in Tesseract.js OCR and layout/table awareness. (Exact Node API + result shape are validated by an implementation spike before the plan is finalized.)

## 2. Goals

1. Replace the PDF **text + OCR + table** engine with liteparse, running **server-side** in a Next.js API route.
2. Preserve **full parity**: text, OCR, tables, page previews, embedded images, equations.
3. Keep the existing `PDFProcessingResult` contract so RAG, the Zustand store, and the UI are unchanged.
4. Verify it works: unit tests + manual smoke (text PDF, scanned PDF, RAG query).

## 3. Decisions (from brainstorming)

- **Deployment:** Next.js API route (server-side `@llamaindex/liteparse`). Not a Cloudflare Worker; not in-browser WASM.
- **Scope:** Full parity + port multimodal.
- **Image/equation parity:** **Hybrid (Approach A)** — liteparse owns text/OCR/tables (and page previews if it emits screenshots in Node); the existing **client-side** PDF.js `image-extractor` and `equation-extractor` are retained for those two features only.
- **Fallback:** liteparse primary; retain a **minimal PDF.js text fallback** (pdfjs-dist stays for images/equations anyway) so uploads don't hard-fail.

## 4. Architecture & data flow

liteparse becomes the PDF text/OCR/table engine in `app/api/pdf/extract/route.ts`. The client uploads the file and receives `{ text, chunks, metadata }`; embedded-image + equation extraction stay client-side via PDF.js. The assembled document keeps the existing shape.

1. `components/unified-pdf-processor.tsx` → POST the PDF (multipart) to `/api/pdf/extract`.
2. Route (Node): `liteparse-client.ts` runs liteparse → text + per-page items + OCR (when enabled) + table layout; runs `advanced-chunking.ts` → chunks; builds metadata; returns JSON. On liteparse failure → PDF.js text fallback, else structured error.
3. Client: runs existing `image-extractor` + `equation-extractor` (PDF.js) on the file → merges into `metadata.multimodal`; page previews from liteparse screenshots if available, else client-rendered.
4. Client assembles the document object (unchanged) → embeddings → store.

Trade-off accepted: the PDF is read twice (server liteparse + client PDF.js for images/equations). Acceptable because the client already holds the bytes.

## 5. Components

- **New:** `lib/liteparse-client.ts` — server-only wrapper mapping liteparse output → `PDFProcessingResult`-compatible `{ text, chunks, metadata }`.
- **Rewritten:** `app/api/pdf/extract/route.ts` (liteparse + chunking + fallback); `components/unified-pdf-processor.tsx` + a slimmed client orchestrator (POST to route, then run client image/equation extractors, merge).
- **Removed:** `lib/pdf-parser.ts`, `lib/pdf-processor-advanced.ts`, `lib/pdf-processor-browser.ts`, `lib/pdf-init.ts`, `lib/ocr-processor.ts` (liteparse OCR), `lib/table-extractor.ts` (liteparse tables), `components/pdf-client-wrapper.tsx`. The bulk of `lib/enhanced-pdf-processor.ts` text/OCR logic is removed; any retained client orchestration moves to a small focused module.
- **Kept:** `lib/image-extractor.ts`, `lib/equation-extractor.ts`, `lib/advanced-chunking.ts`, and `pdfjs-dist` (now only for images/equations + text fallback).
- **Dependencies:** add `@llamaindex/liteparse` (+ a `serverExternalPackages` entry if it bundles WASM/native binaries). `tesseract.js` is removable if liteparse fully owns OCR and nothing else uses it (verify `image-captioner.ts` usage first).

## 6. Result contract (unchanged)

`PDFProcessingResult` = `{ text: string; chunks: string[]; advancedChunks?: TextChunk[]; metadata: { documentType, title, …, pages, processingMethod, extractionQuality, fileSize, processingTime, successfulPages, failedPages, confidence, warnings, ocrUsed?, ocrConfidence?, multimodal? } }`. `processingMethod` becomes `"liteparse"` (or `"pdfjs-fallback"`). DOCX/spreadsheet processors are untouched.

## 7. Error handling

- liteparse throws → fall back to PDF.js text extraction (warning recorded in `metadata.warnings`, `processingMethod = "pdfjs-fallback"`).
- Both fail → route returns a structured `{ success: false, error }` (same failure UX as today).
- File validation (type, 50–100MB cap) preserved.

## 8. Testing & verification

- **Unit:** `liteparse-client` maps a small text-PDF fixture → expected non-empty text + ≥1 chunk; a scanned-PDF fixture exercises OCR. Route handler test: POST a PDF buffer → 200 + `{ text, chunks }`.
- **Gates:** `npm run build`, `npm run lint`, `npx vitest run`, `npm audit` stay green.
- **Manual smoke:** upload a text PDF and a scanned PDF → chunks created → RAG answer returned; confirm table/image/equation panels and page previews.

## 9. Out of scope

- DOCX (`mammoth`) and spreadsheet (`xlsx`) processing — unchanged (liteparse could unify later).
- Image captioning — remains degraded after the Goal 1 `@xenova/transformers` removal.
- Cloudflare Worker / in-browser WASM deployment.

## 10. Risks to validate early (implementation spike)

1. `@llamaindex/liteparse` installs and runs in a Next.js Node API route; confirm the real `parse()` signature and result shape.
2. Whether liteparse emits page **screenshots** in Node (decides preview source).
3. `serverExternalPackages` / bundler config for any WASM/native assets.
4. Server memory/time for large PDFs (50–100MB cap already enforced).

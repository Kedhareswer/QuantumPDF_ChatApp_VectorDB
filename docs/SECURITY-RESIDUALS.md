# Security Residuals

**Last reviewed:** 2026-08-08

`npm audit` currently reports **2 moderate, 0 high, 0 critical** — both entries are
the same accepted residual described below.

## Accepted residual

### `uuid` < 11.1.1 — via `weaviate-ts-client` (2 audit entries)

- **Advisory:** GHSA-w5hq-g745-h8pq — missing buffer bounds check in uuid v3/v5/v6
  **when a `buf` argument is provided**.
- **Why accepted:** the vulnerable path is not exercised. `weaviate-ts-client`
  generates v4 UUIDs and never passes `buf`. The only `npm` remedy is
  `npm audit fix --force`, which performs a **breaking downgrade** to
  `weaviate-ts-client@1.3.1`.
- **Future resolution:** `weaviate-ts-client` is deprecated; migrating to the
  maintained `weaviate-client` package resolves this.

## History

An earlier pass (2026-06-04, branch `chore/dependency-upgrade-cleanup`) took the
tree from 28 vulnerabilities (2 critical, 13 high, 13 moderate) down to 2 moderate
by upgrading `next` and `vitest`, dropping `@xenova/transformers` — which removed
the whole `onnxruntime → onnx-proto → protobufjs` chain — and pulling patched
transitive packages.

Two notes from that pass no longer apply:

- **The SheetJS CDN pin is gone.** `xlsx` was installed from
  `https://cdn.sheetjs.com/...` because SheetJS does not publish patched releases
  to npm, which meant installs and CI needed network access to `cdn.sheetjs.com`.
  Both `xlsx` and `mammoth` were removed entirely when `@firecrawl/anydoc-wasm`
  took over non-PDF parsing. **There is no CDN dependency in this repo any more.**
- **`tesseract.js` is gone too.** Image OCR now happens inside liteparse
  (`ocrEnabled`) on the server rather than in a browser worker.

The August 2026 cleanup removed a further 31 unused dependencies (the unreferenced
half of the shadcn/ui set and its Radix primitives, plus `framer-motion`,
`recharts`, `zod`, `immer`, `next-themes` and others) and applied `npm audit fix`,
clearing 9 high-severity advisories in transitive packages.

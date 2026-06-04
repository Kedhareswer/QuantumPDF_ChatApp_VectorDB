# Security Residuals — Dependency Upgrade (Goal 1)

**Date:** 2026-06-04 · **Branch:** `chore/dependency-upgrade-cleanup`

`npm audit` started at **28 vulnerabilities (2 critical, 13 high, 13 moderate)** and ended at **2 moderate (0 critical, 0 high)**.

## Resolved

| Issue | Severity | How |
|---|---|---|
| `next` (≈19 advisories) | high | Upgraded 16.1.6 → 16.2.7 |
| `vitest` | critical | `npm audit fix` (→ 4.1.x) |
| `protobufjs` | critical | Removed optional `@xenova/transformers` (−77 pkgs); the entire `onnxruntime → onnx-proto → protobufjs` chain is gone |
| `xlsx` (prototype pollution + ReDoS) | high | Installed the official patched build from the SheetJS CDN (`xlsx@0.20.3`) |
| `postcss`, `brace-expansion`, `dompurify`, `@xmldom/xmldom`, `flatted`, `minimatch`, `lodash-es`, `underscore`, `picomatch`, `@protobufjs/utf8`, `mdast-util-to-hast` | high/moderate | `npm audit fix` + a `postcss` self-override (`"$postcss"`) |

## Accepted residuals (2 moderate)

### `uuid` < 11.1.1 — via `weaviate-ts-client` (2 audit entries)
- **Advisory:** GHSA-w5hq-g745-h8pq — missing buffer bounds check in uuid v3/v5/v6 **when a `buf` argument is provided**.
- **Why accepted:** Practical risk is near-zero — `weaviate-ts-client` generates v4 UUIDs and does not pass a `buf` argument, so the vulnerable code path is not exercised. The only `npm` fix is `npm audit fix --force`, which performs a **breaking downgrade** to `weaviate-ts-client@1.3.1` — outside the approved "safe, no breaking changes" scope.
- **Future resolution:** `weaviate-ts-client` is deprecated; migrating to the maintained `weaviate-client` package resolves this.

## Notes / consequences

- **xlsx via CDN:** `package.json` references `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (SheetJS does not publish patched releases to npm). Installs and CI must be able to reach `cdn.sheetjs.com`.
- **`@xenova/transformers` removed:** local in-browser summarization now uses the extractive-summary fallback, and local image captioning falls back to placeholders or a configured cloud vision provider. Re-evaluate during Goal 2 (liteparse), which reworks the multimodal pipeline.

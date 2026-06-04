# Dependency Upgrade, Compatibility, Cleanup & Vulnerability Patch — Design

- **Date:** 2026-06-04
- **Status:** Approved (design); pending implementation plan
- **Scope:** Goal 1 of 2. (Goal 2 — replace the PDF parser engine with run-llama/liteparse — is a separate, later effort with its own spec.)

## 1. Context

QuantumPDF is a Next.js 16 + React 19 document-analysis app. Core logic lives in `/lib`, UI in `/components`, API routes in `/app/api`. The build masks type errors (`next.config.mjs` sets `typescript.ignoreBuildErrors: true`) and automated coverage is thin (one test file, `__tests__/store.test.ts`).

### Findings (from `npm audit`, `npm outdated`, and `.planning/debug/full-app-quality-audit.md`)

**Known vulnerabilities:**
- `next` @ 16.1.6 — **HIGH**, ~19 advisories (HTTP request smuggling, Server Actions CSRF bypass, multiple DoS, XSS, SSRF, cache poisoning, middleware/proxy bypass). Fixed by upgrading to **16.2.7**.
- High transitive: `flatted`, `minimatch` (ReDoS), `@xmldom/xmldom` (XML injection), `lodash-es` (prototype pollution) — the last via `mermaid → @mermaid-js/parser → langium → chevrotain`.
- Moderate: `dompurify` (multiple XSS), `brace-expansion` (ReDoS), `@protobufjs/utf8`, `mdast-util-to-hast`, `picomatch`.

**Maintenance / hygiene:**
- **Two lockfiles** coexist (`package-lock.json` + `pnpm-lock.yaml`), which caused `npm outdated` to report every package as `MISSING`.
- Several deps pinned to **`"latest"`** (non-reproducible builds): `pdfjs-dist`, `zustand`, `immer`, `weaviate-ts-client`, `@huggingface/inference`, `@pinecone-database/pinecone`, `use-sync-external-store`.
- ~590 TypeScript errors masked by `ignoreBuildErrors`, ~300 `console.log` calls, and dead/unreferenced files (e.g. `example-optimized-usage.ts`, `lib/pdf-processor-advanced.ts`).

## 2. Goals

1. Patch all known vulnerabilities — zero high/critical at the end (remaining moderates documented with justification).
2. Refresh dependencies to the latest **within existing semver ranges** (patch/minor), keeping the build green.
3. Cleanup: single lockfile, no `"latest"` pins, dead files removed, console noise tamed.
4. Verifiably working app: build, lint, existing tests, and core user flows all pass.

## 3. Non-goals (explicitly out of scope this pass)

- **Risky major version bumps:** `lucide-react` 0.554→1.x, `react-day-picker` 9→10, `react-resizable-panels` 3→4, `@vercel/analytics` 1→2, `tesseract.js` 6→7.
- **The ~590 TypeScript errors** and removing `ignoreBuildErrors` (its own effort).
- **PDF-module consolidation** and `pdfjs-dist` / `tesseract.js` upgrades — owned by Goal 2 (liteparse). These deps will be **pinned, not upgraded**, since Goal 2 may remove them.
- New features or behavior changes.

## 4. Approach

**Staged, with a verification gate after each stage** (chosen over a big-bang upgrade because the thin test safety net makes per-stage isolation essential). All work on a feature branch; each stage is a single revertable commit.

### Stage 0 — Foundation & baseline
- Standardize on **npm** (matches `package.json` scripts and CLAUDE.md). Delete `pnpm-lock.yaml`.
- Clean install from `package-lock.json`.
- Record a baseline: `npm run build`, `npm run lint`, `npx vitest run`, `npm audit` outputs (saved for before→after comparison).
- **Outcome:** resolves the dual-lockfile `MISSING` confusion; establishes a known-good starting point.

### Stage 1 — Vulnerability patches
- Bump `next` 16.1.6 → **16.2.7**.
- `npm audit fix` for transitive highs/moderates (`flatted`, `minimatch`, `@xmldom/xmldom`, `dompurify`, `brace-expansion`, `@protobufjs/utf8`, `mdast-util-to-hast`).
- Add an npm **`overrides`** block for the deep `mermaid → lodash-es` chain. Exact patched versions are confirmed by re-running `npm audit` (avoid `audit fix --force`, which could force a breaking `mermaid` major).
- **Gate:** `npm run build` green; `npm audit` shows **no high/critical**.

### Stage 2 — Safe minor/patch refresh
- Update dependencies to the latest **within existing semver ranges** (e.g. `react`/`react-dom` 19.2.1→19.2.7, `recharts`, `date-fns`, `mammoth`, `framer-motion`, `zod`). No major bumps.
- **Gate:** `npm run build` + `npm run lint` + `npx vitest run` green.

### Stage 3 — Hygiene & cleanup
- Replace every `"latest"` dependency with a concrete caret range at the **actually-installed** version (`pdfjs-dist`, `zustand`, `immer`, `weaviate-ts-client`, `@huggingface/inference`, `@pinecone-database/pinecone`, `use-sync-external-store`).
- Delete clearly-unreferenced dead files (e.g. `example-optimized-usage.ts`), verified unreferenced by import search. **Do not** touch PDF modules reserved for Goal 2 (`pdf-parser.ts`, `pdf-processor-advanced.ts`, `pdf-processor-browser.ts`, `pdf-init.ts`, `enhanced-pdf-processor.ts`).
- Tame the ~300 `console.log`s: gate behind a debug flag or remove the noisiest operational logging. Preserve `console.warn`/`console.error` for genuine error paths.
- **Gate:** `npm run build` + `npm run lint` + `npx vitest run` green.

## 5. Verification strategy

**Per-gate (automated):** `npm run build`, `npm run lint`, `npx vitest run`, `npm audit`.

**Final manual smoke test (the real safety net given low coverage):**
1. `npm run dev` boots without console errors.
2. Upload a PDF → document processes and chunks are created.
3. Run a RAG chat query against the uploaded doc → grounded answer returns.
4. Spot-check one secondary flow (e.g. vector-DB config panel renders, a DOCX/CSV upload works).

If any gate fails, isolate within the current stage's commit, fix (using web research for breaking-change notes where relevant), and re-verify before moving on.

## 6. Risks & rollback

- **Transitive vuln with no clean fix:** if the only resolution is a breaking major (e.g. `mermaid` chain), leave it, document the residual moderate, and defer to a major-bump effort. Do not force-break the build.
- **A minor bump introduces a regression:** each stage is one commit → `git revert` that stage and pin the offending package.
- **`overrides` breaks a transitive consumer:** validated by the Stage 1 build gate before proceeding.

## 7. Success criteria

- [ ] `npm audit` reports **no high/critical** vulnerabilities; any residual moderates documented with reason.
- [ ] Exactly **one** lockfile (`package-lock.json`).
- [ ] **Zero** `"latest"` version specifiers in `package.json`.
- [ ] `npm run build`, `npm run lint`, and `npx vitest run` all pass.
- [ ] Manual smoke test passes (upload + RAG chat + one secondary flow).
- [ ] No risky major bumps, no TS-debt work, no PDF-module changes (Goal 2 boundary respected).

## 8. Coordination with Goal 2 (liteparse)

PDF-related dependencies (`pdfjs-dist`, `tesseract.js`) and the 5 overlapping PDF modules are intentionally left alone here. Goal 2 will replace the PDF engine and is expected to remove/replace much of that surface, so polishing it now would be wasted effort. This pass only **pins** those deps for reproducibility.

# Dependency Upgrade, Cleanup & Vulnerability Patch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch all known vulnerabilities and refresh dependencies (within existing semver ranges) for the QuantumPDF Next.js 16 app, plus hygiene cleanup (single lockfile, pinned versions, dead-file removal, debug-gated logging) — with a green build and verified core flows.

**Architecture:** Four staged commits on branch `chore/dependency-upgrade-cleanup`, each gated by `npm run build` + `npm run lint` + `npx vitest run` + `npm audit`, finished with a manual smoke test. No risky major bumps; no TypeScript-debt work; PDF modules left untouched for Goal 2.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, npm, Vitest + jsdom. Platform: **Windows / PowerShell**.

**Conventions for this plan:**
- Run all commands from the repo root: `C:\Users\mbkhn\Downloads\inspired\QuantumPDF_ChatApp_VectorDB`.
- `npm audit` and `npm outdated` exit non-zero when they have findings — that is normal, read the output.
- "PDF modules" (excluded this pass): `lib/pdf-parser.ts`, `lib/pdf-processor-advanced.ts`, `lib/pdf-processor-browser.ts`, `lib/pdf-init.ts`, `lib/enhanced-pdf-processor.ts`, `lib/ocr-processor.ts`, `lib/image-extractor.ts`, `lib/table-extractor.ts`, `lib/equation-extractor.ts`, `lib/image-captioner.ts`, `components/pdf-client-wrapper.tsx`, `components/unified-pdf-processor.tsx`, `app/api/pdf/extract/route.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `pnpm-lock.yaml` | Delete | Remove duplicate lockfile; standardize on npm |
| `package.json` | Modify | next bump, `overrides`, pin `"latest"` deps, minor refresh |
| `package-lock.json` | Regenerated | Single source of truth for the dependency tree |
| `lib/logger.ts` | Create | Debug-gated logger (debug/info silenced in prod; warn/error always) |
| `__tests__/logger.test.ts` | Create | Unit test for the logger gating behavior |
| `lib/rag-engine.ts` | Modify | `console.log` → `logger.debug` (171) |
| `app/page.tsx` | Modify | `console.log` → `logger.debug` (27) |
| `lib/ai-client.ts` | Modify | `console.log` → `logger.debug` (17) |
| `lib/query-processor.ts` | Modify | `console.log` → `logger.debug` (10) |
| `lib/vector-database.ts` | Modify | `console.log` → `logger.debug` (7) |
| `lib/diversity-algorithm.ts` | Modify | `console.log` → `logger.debug` (6) |
| `lib/rate-limiter.ts`, `lib/local-summarizer.ts`, `lib/enhanced-url-processor.ts`, `lib/performance-monitor.ts`, `lib/telemetry.ts`, `app/api/huggingface/embedding/route.ts`, `components/chat-interface.tsx`, `components/pwa-install-prompt.tsx`, `components/service-worker-registration.tsx` | Modify | `console.log` → `logger.debug` (remaining non-PDF, ~26 total) |
| `example-optimized-usage.ts` | Delete | Confirmed dead (no runtime imports) |

---

## Task 0: Foundation & Baseline (Stage 0)

**Files:**
- Delete: `pnpm-lock.yaml`
- Regenerate: `package-lock.json`, `node_modules/`

- [ ] **Step 1: Confirm you are on the feature branch**

Run: `git branch --show-current`
Expected: `chore/dependency-upgrade-cleanup`
If not: `git checkout chore/dependency-upgrade-cleanup`

- [ ] **Step 2: Remove the duplicate pnpm lockfile**

Run: `git rm pnpm-lock.yaml`
Expected: `rm 'pnpm-lock.yaml'`

- [ ] **Step 3: Clean install with npm**

Run (PowerShell):
```powershell
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
npm install
```
Expected: install completes; `node_modules/` and an updated `package-lock.json` exist. (Warnings about deprecated transitive packages are acceptable.)

- [ ] **Step 4: Capture the baseline (for before→after comparison)**

Run each and note the result:
```powershell
npm run build
npm run lint
npx vitest run
npm audit
```
Expected baseline: build succeeds; lint clean; **1 test file passes** (`__tests__/store.test.ts`); audit reports the known highs/moderates (`next`, `flatted`, `minimatch`, `xmldom`, `dompurify`, `lodash-es` via mermaid, etc.).

> If `npm run build` FAILS at baseline, STOP — that is a pre-existing break to diagnose before upgrading anything (use the `/debug` workflow). Do not proceed to Task 1 on a red baseline.

- [ ] **Step 5: Commit**

```powershell
git add package-lock.json
git commit -m "chore: standardize on npm and remove duplicate pnpm-lock.yaml"
```

---

## Task 1: Vulnerability Patches (Stage 1)

**Files:**
- Modify: `package.json` (next version + `overrides`)
- Regenerate: `package-lock.json`

- [ ] **Step 1: Upgrade Next.js to the patched release**

Run: `npm install next@16.2.7 eslint-config-next@16.2.7`
Expected: `next` and `eslint-config-next` resolve to `16.2.7` in `package.json`.

- [ ] **Step 2: Apply automatic transitive fixes**

Run: `npm audit fix`
Expected: `dompurify`, `flatted`, `minimatch`, `brace-expansion`, `@xmldom/xmldom`, `@protobufjs/utf8`, `mdast-util-to-hast`, `picomatch` get patched. Do **NOT** use `npm audit fix --force` (it can force a breaking `mermaid` major).

- [ ] **Step 3: Re-run audit to see what remains**

Run: `npm audit`
Expected: the only remaining findings should be the deep `mermaid → @mermaid-js/parser → langium → chevrotain → lodash-es` chain (and possibly `next`'s `postcss`, already handled by Step 1).

- [ ] **Step 4: Add an `overrides` block for the remaining transitive chain**

Edit `package.json` — add a top-level `"overrides"` key (sibling of `devDependencies`). Use the patched versions reported in Step 3's audit output. Based on current advisories:

```json
  "overrides": {
    "lodash-es": "^4.17.24"
  }
```

If Step 3 named additional unresolved packages (e.g. a specific `langium`/`chevrotain` version), add them here too, each pinned to the "fix available" version from the audit text.

- [ ] **Step 5: Reinstall and re-audit**

Run:
```powershell
npm install
npm audit
```
Expected: **no high or critical** vulnerabilities. Record any residual **moderate** findings and the reason they can't be fixed without a breaking major (these are acceptable per the spec).

> If `lodash-es@^4.17.24` does not exist on the registry, use the exact version the audit's "fix available" line names. If overriding breaks `mermaid` at the build gate (Step 6), revert the override, leave the moderate documented, and proceed.

- [ ] **Step 6: Verify the gate**

Run:
```powershell
npm run build
npm audit
```
Expected: build succeeds; audit shows no high/critical.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json
git commit -m "fix(security): patch known vulnerabilities (next 16.2.7, audit fix, lodash-es override)"
```

---

## Task 2: Safe Minor/Patch Refresh (Stage 2)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Bump the exact-pinned React packages to the latest patch**

`react` and `react-dom` are pinned exactly (`19.2.1`), so `npm update` will not move them. Bump explicitly:

Run: `npm install react@19.2.7 react-dom@19.2.7`
Expected: both resolve to `19.2.7`.

- [ ] **Step 2: Refresh everything else within existing semver ranges**

Run: `npm update`
Expected: caret-ranged deps (`recharts`, `date-fns`, `mammoth`, `framer-motion`, `zod`, `react-hook-form`, `react-markdown`, etc.) move to the newest version satisfying their range. **No major versions change** (ranges forbid it).

- [ ] **Step 3: Confirm no major bumps slipped in**

Run: `npm outdated`
Expected: the deferred majors are STILL listed as behind (`lucide-react`, `react-day-picker`, `react-resizable-panels`, `@vercel/analytics`, `tesseract.js`). If any of those changed major version, revert it: `npm install <pkg>@<previous-range>`.

- [ ] **Step 4: Verify the gate**

Run:
```powershell
npm run build
npm run lint
npx vitest run
```
Expected: build succeeds; lint clean; tests pass.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore(deps): refresh dependencies within semver ranges (react 19.2.7, etc.)"
```

---

## Task 3: Debug-Gated Logger Utility (Stage 3a, TDD)

**Files:**
- Create: `lib/logger.ts`
- Test: `__tests__/logger.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/logger.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { logger } from "@/lib/logger"

describe("logger", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("silences debug() in production", () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_DEBUG
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("hidden")
    expect(spy).not.toHaveBeenCalled()
  })

  it("emits debug() outside production", () => {
    process.env.NODE_ENV = "development"
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("shown")
    expect(spy).toHaveBeenCalledWith("shown")
  })

  it("emits debug() in production when NEXT_PUBLIC_DEBUG=true", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_DEBUG = "true"
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("forced")
    expect(spy).toHaveBeenCalledWith("forced")
  })

  it("always emits warn() and error()", () => {
    process.env.NODE_ENV = "production"
    delete process.env.NEXT_PUBLIC_DEBUG
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger.warn("w")
    logger.error("e")
    expect(warnSpy).toHaveBeenCalledWith("w")
    expect(errorSpy).toHaveBeenCalledWith("e")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/logger.test.ts`
Expected: FAIL — cannot resolve `@/lib/logger` (module does not exist yet).

- [ ] **Step 3: Implement the logger**

Create `lib/logger.ts`:

```ts
/**
 * Debug-gated logger. `debug`/`info` are silenced in production unless
 * NEXT_PUBLIC_DEBUG=true. `warn`/`error` always pass through.
 * The flag is read at call-time so tests (and runtime env) can toggle it.
 */
function debugEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG === "true" ||
    process.env.NODE_ENV !== "production"
  )
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (debugEnabled()) console.log(...args)
  },
  info: (...args: unknown[]): void => {
    if (debugEnabled()) console.info(...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },
  error: (...args: unknown[]): void => {
    console.error(...args)
  },
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/logger.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/logger.ts __tests__/logger.test.ts
git commit -m "feat(logging): add debug-gated logger utility"
```

---

## Task 4: Route `console.log` Through the Logger (Stage 3b)

Mechanical, per-file transform. For **each** file below: (a) add the logger import, (b) replace every `console.log(` with `logger.debug(`. **Leave `console.warn` and `console.error` untouched.** Do **not** touch any PDF module.

Import to add — for files in `lib/`:
```ts
import { logger } from "./logger"
```
For `app/page.tsx` and `components/*.tsx` and `app/api/**`:
```ts
import { logger } from "@/lib/logger"
```

> The transform is a literal token replace of `console.log(` → `logger.debug(` (use replace-all per file). It preserves arguments and multi-line calls. After each file, the per-file grep must report zero `console.log(`.

- [ ] **Step 1: Transform the high-volume `lib/` files**

For each of `lib/rag-engine.ts` (171), `lib/ai-client.ts` (17), `lib/query-processor.ts` (10), `lib/vector-database.ts` (7), `lib/diversity-algorithm.ts` (6):
1. Add `import { logger } from "./logger"` near the top (after existing imports).
2. Replace-all `console.log(` → `logger.debug(`.

Verify per file, e.g.:
Run: `Select-String -Path lib/rag-engine.ts -Pattern "console\.log\(" | Measure-Object`
Expected: Count `0`.

- [ ] **Step 2: Transform `app/page.tsx` (27)**

1. Add `import { logger } from "@/lib/logger"`.
2. Replace-all `console.log(` → `logger.debug(`.

Run: `Select-String -Path app/page.tsx -Pattern "console\.log\(" | Measure-Object`
Expected: Count `0`.

- [ ] **Step 3: Transform the remaining non-PDF files**

Apply the same transform (with the correct import path) to: `lib/rate-limiter.ts` (4), `lib/local-summarizer.ts` (4), `lib/enhanced-url-processor.ts` (3), `lib/performance-monitor.ts` (1), `lib/telemetry.ts` (1), `app/api/huggingface/embedding/route.ts` (4), `components/chat-interface.tsx` (2), `components/pwa-install-prompt.tsx` (3), `components/service-worker-registration.tsx` (4).

- [ ] **Step 4: Confirm only PDF/OCR `console.log`s remain**

Run:
```powershell
Select-String -Path lib/*.ts,components/*.tsx,app/**/*.tsx,app/**/*.ts -Pattern "console\.log\(" | Select-Object Path,LineNumber
```
Expected: matches ONLY in PDF modules (`pdf-parser.ts`, `pdf-processor-advanced.ts`, `enhanced-pdf-processor.ts`, `ocr-processor.ts`, `image-extractor.ts`, `table-extractor.ts`). These are intentionally deferred to Goal 2.

- [ ] **Step 5: Verify the gate**

Run:
```powershell
npm run build
npm run lint
npx vitest run
```
Expected: build succeeds; lint clean; tests pass.

- [ ] **Step 6: Commit**

```powershell
git add lib/ app/ components/
git commit -m "refactor(logging): route console.log through debug-gated logger in non-PDF modules"
```

---

## Task 5: Pin Floating Deps & Remove Dead File (Stage 3c)

**Files:**
- Modify: `package.json`
- Delete: `example-optimized-usage.ts`

- [ ] **Step 1: Read the installed versions of the `"latest"` deps**

Run:
```powershell
npm ls pdfjs-dist zustand immer weaviate-ts-client @huggingface/inference @pinecone-database/pinecone use-sync-external-store --depth=0
```
Expected (note the ACTUAL resolved version of each — these are the values to pin):
- `@huggingface/inference` ≈ 4.13.18
- `@pinecone-database/pinecone` ≈ 7.2.0
- `pdfjs-dist` ≈ 6.0.227
- `immer` ≈ 11.1.8
- `use-sync-external-store` ≈ 1.6.0
- `weaviate-ts-client` ≈ 2.2.0
- `zustand` ≈ 5.0.14

- [ ] **Step 2: Pin each in `package.json`**

In `package.json`, replace each `"latest"` specifier with `^<installed-version>` from Step 1. Example result (use YOUR Step 1 versions):

```json
    "@huggingface/inference": "^4.13.18",
    "@pinecone-database/pinecone": "^7.2.0",
    "immer": "^11.1.8",
    "pdfjs-dist": "^6.0.227",
    "use-sync-external-store": "^1.6.0",
    "weaviate-ts-client": "^2.2.0",
    "zustand": "^5.0.14",
```

> `pdfjs-dist` and `tesseract.js` are pinned, NOT upgraded — Goal 2 owns them. Pinning only locks what is already installed.

- [ ] **Step 3: Reinstall to sync the lockfile**

Run: `npm install`
Expected: install succeeds with no version changes (pins match installed versions).

- [ ] **Step 4: Delete the confirmed dead file**

Run: `git rm example-optimized-usage.ts`
Expected: `rm 'example-optimized-usage.ts'`

> Do NOT delete `lib/pdf-processor-advanced.ts` even though it is also unreferenced — it is a PDF module reserved for Goal 2.

- [ ] **Step 5: Verify the gate**

Run:
```powershell
npm run build
npm run lint
npx vitest run
npm audit
```
Expected: build succeeds; lint clean; tests pass; audit still shows no high/critical.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: pin floating dependencies and remove dead example file"
```

---

## Task 6: Final Verification & Smoke Test

**No code changes — verification only.**

- [ ] **Step 1: Confirm `package.json` has no `"latest"` specifiers**

Run: `Select-String -Path package.json -Pattern '"latest"'`
Expected: no matches.

- [ ] **Step 2: Confirm a single lockfile**

Run: `Get-ChildItem -Filter *lock* | Select-Object Name`
Expected: only `package-lock.json` (no `pnpm-lock.yaml`, no `yarn.lock`).

- [ ] **Step 3: Full automated suite**

Run:
```powershell
npm run build
npm run lint
npx vitest run
npm audit
```
Expected: all green; audit no high/critical.

- [ ] **Step 4: Manual smoke test (the real safety net)**

```powershell
npm run dev
```
Then in the browser at `http://localhost:3000`:
1. App loads with no console errors.
2. Upload a text-based PDF → it processes and reports chunks created.
3. Configure/confirm an AI provider, then ask a question about the uploaded doc → a grounded RAG answer returns.
4. One secondary flow: upload a small CSV or DOCX → it processes; OR open the vector-DB config panel and confirm it renders.

Expected: all four pass. Stop the dev server (`Ctrl+C`) when done.

> If a `"latest"`-pinned dep (e.g. `pdfjs-dist`) resolved to a newer version that breaks PDF upload at this step, pin it down to the last known-good version instead and re-run the gate. Note it for the Goal 2 effort.

- [ ] **Step 5: Confirm success criteria (from the spec)**

- [ ] `npm audit`: no high/critical (residual moderates documented).
- [ ] Exactly one lockfile (`package-lock.json`).
- [ ] Zero `"latest"` specifiers in `package.json`.
- [ ] `npm run build`, `npm run lint`, `npx vitest run` all pass.
- [ ] Smoke test passed (PDF upload + RAG chat + one secondary flow).
- [ ] No major bumps, no TS-debt changes, no PDF-module edits.

- [ ] **Step 6: Push the branch (optional, when ready for review)**

```powershell
git push -u origin chore/dependency-upgrade-cleanup
```

---

## Notes & Contingencies

- **Audit can't reach zero moderates:** acceptable per spec. Document each residual moderate (package, advisory, why the only fix is a breaking major) in the PR description.
- **A minor bump regresses behavior:** each stage is one commit — `git revert <stage-commit>` and pin the offending package to its previous range.
- **Goal 2 coordination:** `pdfjs-dist`, `tesseract.js`, and all PDF modules (including their ~35 `console.log`s and the dead `pdf-processor-advanced.ts`) are intentionally left for the liteparse replacement effort.

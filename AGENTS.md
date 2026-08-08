# AGENTS.md

Operational guide for coding agents in `QuantumPDF_ChatApp_VectorDB`.

## Scope and Precedence

1. Follow the direct user request first.
2. Then follow repository policy in `CLAUDE.md`.
3. Then follow this file.
4. Finally, follow local conventions in edited files.

If rules conflict, use the highest-priority source.

## Cursor and Copilot Rules Check

- `.cursorrules`: not present.
- `.cursor/rules/`: not present.
- `.github/copilot-instructions.md`: not present.
- Conclusion: no extra Cursor/Copilot policy files are active right now.

## Build, Lint, and Test Commands

Run all commands from repository root.

### Core commands

```bash
npm run dev
npm run build
npm start
npm run lint
```

### PWA commands

```bash
npm run pwa:icons   # regenerate every PWA icon from public/brain.png (needs sharp)
npm run pwa:test    # build + start, so the service worker is active
```

### Test commands (Vitest)

```bash
# run all tests once
npm test

# watch mode
npx vitest

# run a single test file (important)
npx vitest run __tests__/my-feature.test.ts

# run a single test case by name
npx vitest run __tests__/my-feature.test.ts -t "handles empty input"
```

Coverage is not wired up: `@vitest/coverage-v8` is not installed, so
`--coverage` aborts. Install it first if you need a coverage run.

Single-test execution is the default for fast iteration.

## Key Directories

- `app/`: pages, layouts, metadata, and API handlers.
- `app/api/`: backend endpoints for PDF extraction/search/vector DB.
- `components/`: feature UI.
- `components/ui/`: shared UI primitives.
- `lib/`: core business logic (RAG, AI clients, DB adapters, guardrails).
- `hooks/`: reusable React hooks.
- `types/`: declaration files and shared types.

## Code Style: Imports and Modules

- Prefer `@/` imports over long relative paths.
- Group imports: framework/external first, then internal imports.
- Use `import type` for type-only imports when practical.
- Keep server-only logic out of client components.
- Server-external packages in `next.config.mjs` must remain server-side: `@llamaindex/liteparse`, `onnxruntime-node`, `@huggingface/transformers`, `sharp`.
- `@firecrawl/anydoc-wasm` is the inverse: **client-only**. `lib/anydoc-client.ts` is `"use client"` and imports the wasm lazily in the browser. Do not move it into a route handler — the old `/api/document/extract` route was deleted on purpose.
- Node built-ins (`fs`, `net`, `tls`, …) are unavailable on the client; keep that code in route handlers or gate it on `typeof window === 'undefined'`.

## Code Style: Formatting

- Match existing style in each touched file.
- Common style in app/lib files: 2-space indentation, semicolon-light formatting, double quotes.
- Some shadcn/generated files use semicolons; keep local consistency.
- Keep functions focused and avoid unrelated formatting churn.
- Add comments only for non-obvious behavior.

## Code Style: Types

- Preserve strict TypeScript discipline.
- Prefer explicit interfaces/types for contracts and state objects.
- Avoid introducing new `any`; if required, narrow immediately.
- Validate unknown input at boundaries (API payloads, provider responses).
- Reuse existing domain types before creating duplicates.

## Code Style: Naming

- Components/types: `PascalCase`.
- Variables/functions: `camelCase`.
- File names: mostly `kebab-case.ts` / `kebab-case.tsx`.
- Constants: `UPPER_SNAKE_CASE` only for true constants.
- Route handlers: export `GET`, `POST`, etc. from `route.ts`.

## React and Next.js Conventions

- Use `"use client"` only when client runtime features are required.
- Keep secrets/provider keys in server routes, never client-side.
- Use Zustand for persistent cross-component app state.
- Preserve accessibility semantics (`aria-*`, labels, keyboard flow).
- Follow established UI composition with shadcn primitives and Tailwind utilities.

## Error Handling and Logging

- Wrap I/O and async boundaries in `try/catch`.
- API routes should return structured JSON errors with proper HTTP status.
- UI should surface safe messages and log details via existing error flow.
- Include useful context in logs (provider, action, IDs), never secrets.

## Verification Expectations

For non-trivial changes, run:

1. `npm run lint`
2. `npx vitest run <single-test-file>` (when tests apply)
3. `npm run build` (for broad/risky changes)

Because build ignores TypeScript errors, agents must still fix type issues proactively.

## Security and Data Handling

- Never commit API keys, tokens, or credentials.
- Keep environment-variable usage consistent with existing provider config.
- Validate file uploads (type, size) and external URLs.
- Treat inbound config and request payloads as untrusted input.

## Change Discipline for Agents

- Make minimal, targeted changes.
- Preserve the existing architecture (RAG pipeline, vector abstraction, guardrails).
- Avoid opportunistic refactors unless required.
- Update docs when commands/behavior/interfaces change.
- Follow local file conventions when they differ across folders.
Keep this file up to date when scripts, tooling, or repo policies change.

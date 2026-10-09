// Copies PDF.js's prebuilt (legacy, for older browsers) worker into public/ so the browser loads it as a
// plain same-origin static file. Runs before `dev` and `build`, so the copy
// always matches the installed pdfjs-dist version.
//
// Why not let the bundler handle it: Turbopack's worker bootstrap uses
// importScripts(), which is forbidden in the module workers PDF.js creates, so
// the bundled worker died silently and every getDocument() hung forever.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const source = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "legacy", "build", "pdf.worker.min.mjs")
const target = path.join(process.cwd(), "public", "pdf.worker.min.mjs")

mkdirSync(path.dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`Copied ${path.relative(process.cwd(), source)} -> public/pdf.worker.min.mjs`)

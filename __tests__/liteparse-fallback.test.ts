import { describe, expect, it, vi } from "vitest"

// Simulate liteparse's native addon failing to load (e.g. on Vercel serverless,
// where the native NAPI/PDFium binary can't run). extractPdf must then fall back
// to unpdf (serverless-safe) instead of crashing with "DOMMatrix is not defined".
vi.mock("@llamaindex/liteparse", () => ({
  LiteParse: class {
    constructor() {
      throw new Error("Failed to load native module for linux-x64")
    }
  },
}))

import { extractPdf } from "@/lib/liteparse-client"

// Minimal valid one-page PDF with extractable text.
function buildPdf(text: string): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 300 144] >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((body, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`
  })
  pdf += `trailer\n<< /Root 1 0 R /Size ${objs.length + 1} >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Uint8Array(Buffer.from(pdf, "latin1"))
}

describe("extractPdf fallback when liteparse native is unavailable", () => {
  it("falls back to unpdf and still returns text + chunks (no DOMMatrix crash)", async () => {
    const result = await extractPdf(buildPdf("Serverless fallback works"), { fileName: "fallback.pdf" })

    expect(result.processingMethod).toBe("pdfjs-fallback")
    expect(result.text).toContain("Serverless fallback works")
    expect(result.chunks.length).toBeGreaterThanOrEqual(1)
    expect(result.warnings.join(" ")).toMatch(/liteparse failed/i)
  }, 20000)
})

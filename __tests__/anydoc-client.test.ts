import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the anydoc wasm module so this test is deterministic and CI-safe
// (no 6MB wasm instantiation / no fixture documents). The real module is
// exercised manually in the browser.
const LONG_TEXT =
  "# Quarterly Report\n\nThis paragraph is intentionally long enough to exceed the " +
  "high-quality threshold so the extraction quality is reported as high. ".repeat(12)

// vi.mock factories are hoisted, so anything they close over must come from
// vi.hoisted rather than a plain top-level const.
const { toMarkdownBytes, init } = vi.hoisted(() => ({
  toMarkdownBytes: vi.fn(),
  init: vi.fn(),
}))

vi.mock("@firecrawl/anydoc-wasm", () => {
  // Mirrors the real extension table: .xls maps onto the xlsx parser, and
  // signature-less formats (csv) return undefined from formatFromBytes.
  const EXTENSION_MAP: Record<string, string> = {
    doc: "doc",
    docx: "docx",
    xls: "xlsx",
    xlsx: "xlsx",
    csv: "csv",
    pdf: "pdf",
  }
  return {
    // wasm-bindgen's default export instantiates the module.
    default: init,
    // Only ZIP containers carry a signature we recognise here.
    formatFromBytes: (bytes: Uint8Array) =>
      new TextDecoder().decode(bytes).startsWith("PK") ? "docx" : undefined,
    formatFromExtension: (ext: string) => EXTENSION_MAP[ext.replace(/^\./, "")] ?? undefined,
    toMarkdownBytes,
  }
})

import { extractDocument } from "@/lib/anydoc-client"

const bytesOf = (s: string) => new TextEncoder().encode(s)
const textOf = (b: Uint8Array) => new TextDecoder().decode(b)

describe("anydoc-client extractDocument", () => {
  beforeEach(() => {
    toMarkdownBytes.mockReset()
    toMarkdownBytes.mockReturnValue(LONG_TEXT)
  })

  it("uses the byte signature and returns chunked markdown", async () => {
    const result = await extractDocument(bytesOf("PKzipped-docx"), { fileName: "report.docx" })

    expect(toMarkdownBytes).toHaveBeenCalledWith(expect.anything(), "docx")
    expect(result.format).toBe("docx")
    expect(result.extractionQuality).toBe("high")
    expect(result.text).toBe(LONG_TEXT.trim())
    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.chunks.every((c) => c.trim().length > 0)).toBe(true)
    expect(result.wordCount).toBeGreaterThan(0)
    expect(result.warnings).toEqual([])
  })

  it("falls back to the extension when the bytes carry no signature (legacy .xls)", async () => {
    const result = await extractDocument(bytesOf("ÐÏà ole-excel"), { fileName: "book.xls" })

    expect(toMarkdownBytes).toHaveBeenCalledWith(expect.anything(), "xlsx")
    expect(result.format).toBe("xlsx")
  })

  it("re-emits TSV as CSV, preserving fields that contain a comma", async () => {
    const result = await extractDocument(bytesOf("name\tqty\nwid,get\t3\n"), { fileName: "data.tsv" })

    expect(result.format).toBe("csv")

    const [payload, format] = toMarkdownBytes.mock.calls[0] as unknown as [Uint8Array, string]
    expect(format).toBe("csv")
    // The embedded comma must be quoted, not treated as a new column.
    expect(textOf(payload)).toContain('"wid,get",3')
  })

  it("routes PDFs away from anydoc", async () => {
    await expect(extractDocument(bytesOf("%PDF-1.7"), { fileName: "paper.pdf" })).rejects.toThrow(
      /\/api\/pdf\/extract/,
    )
  })

  it("rejects an unsupported extension instead of indexing a failure report", async () => {
    await expect(extractDocument(bytesOf("hello"), { fileName: "notes.xyz" })).rejects.toThrow(
      /Unsupported document format/,
    )
  })

  it("instantiates the wasm module once, however many documents are converted", async () => {
    await extractDocument(bytesOf("PKzipped-docx"), { fileName: "a.docx" })
    await extractDocument(bytesOf("PKzipped-docx"), { fileName: "b.docx" })

    expect(init).toHaveBeenCalledTimes(1)
  })

  it("rejects an empty extraction", async () => {
    toMarkdownBytes.mockReturnValueOnce("   ")

    await expect(
      extractDocument(bytesOf("PKzipped-docx"), { fileName: "empty.docx" }),
    ).rejects.toThrow(/No text content/)
  })

  it("truncates a pathological document and warns", async () => {
    toMarkdownBytes.mockReturnValueOnce("lorem ipsum dolor sit amet. ".repeat(40_000))

    const result = await extractDocument(bytesOf("PKzipped-docx"), { fileName: "huge.docx" })

    expect(result.text.length).toBe(1_000_000)
    expect(result.warnings.join(" ")).toMatch(/truncated/i)
  })
})

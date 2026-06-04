import { describe, expect, it, vi } from "vitest"

// Mock the native liteparse module so this test is deterministic and CI-safe
// (no native binary / no fixture PDF). The real binary is exercised manually.
const LONG_TEXT =
  "LiteParse extracts spatial text from documents. " +
  "This paragraph is intentionally long enough to exceed the high-quality threshold " +
  "so the extraction quality is reported as high. ".repeat(12)

vi.mock("@llamaindex/liteparse", () => ({
  LiteParse: class {
    config: unknown
    constructor(config: unknown) {
      this.config = config
    }
    async parse() {
      return {
        text: LONG_TEXT,
        pages: [
          {
            pageNum: 1,
            width: 600,
            height: 800,
            text: LONG_TEXT,
            textItems: [{ text: "LiteParse", x: 0, y: 0, width: 10, height: 10, confidence: 0.97 }],
          },
        ],
      }
    }
    async screenshot() {
      return [{ pageNum: 1, width: 600, height: 800, imageBuffer: Buffer.from("PNGDATA") }]
    }
    getConfig() {
      return this.config
    }
  },
}))

import { extractPdf } from "@/lib/liteparse-client"

describe("liteparse-client extractPdf", () => {
  it("maps liteparse output to text, chunks, and page previews", async () => {
    const result = await extractPdf(new Uint8Array([1, 2, 3]), { enableOCR: true, fileName: "test.pdf" })

    expect(result.processingMethod).toBe("liteparse")
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.chunks.length).toBeGreaterThanOrEqual(1)
    expect(result.advancedChunks.length).toBe(result.chunks.length)
    expect(result.pages).toBe(1)
    expect(result.extractionQuality).toBe("high")
  })

  it("flags OCR usage when enabled and confidence is present", async () => {
    const result = await extractPdf(new Uint8Array([1, 2, 3]), { enableOCR: true })
    expect(result.ocrUsed).toBe(true)
  })

  it("produces page previews as base64 page-preview images", async () => {
    const result = await extractPdf(new Uint8Array([1, 2, 3]), { capturePreviews: true })
    expect(result.previews).toHaveLength(1)
    expect(result.previews[0].type).toBe("page-preview")
    expect(result.previews[0].pageNumber).toBe(1)
    expect(result.previews[0].dataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it("skips previews when capturePreviews is false", async () => {
    const result = await extractPdf(new Uint8Array([1, 2, 3]), { capturePreviews: false })
    expect(result.previews).toHaveLength(0)
  })
})

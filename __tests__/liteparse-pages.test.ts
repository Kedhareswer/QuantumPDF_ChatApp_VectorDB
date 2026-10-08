import { describe, expect, it, vi } from "vitest"

const pageText = (n: number) =>
  Array.from({ length: 15 }, (_, i) => `Page ${n} paragraph ${i} explains subject${n} thoroughly.`).join(" ")

vi.mock("@llamaindex/liteparse", () => ({
  LiteParse: class {
    async parse() {
      // Deliberately out of order: extraction must sort by pageNum.
      return {
        text: "",
        pages: [
          { pageNum: 2, width: 600, height: 800, text: pageText(2), textItems: [] },
          { pageNum: 1, width: 600, height: 800, text: pageText(1), textItems: [] },
        ],
      }
    }
    async screenshot() {
      return []
    }
  },
}))

import { extractPdf } from "@/lib/liteparse-client"

describe("extractPdf page numbers", () => {
  it("returns chunkPages aligned with chunks, covering every page", async () => {
    const result = await extractPdf(new Uint8Array([1]), { fileName: "two-pages.pdf", capturePreviews: false })
    expect(result.chunkPages).toHaveLength(result.chunks.length)
    expect(result.chunkPages[0]).toBe(1)
    expect(result.chunkPages).toContain(2)
    expect(result.text.indexOf("Page 1")).toBeLessThan(result.text.indexOf("Page 2"))
    result.advancedChunks.forEach((c, i) => expect(c.metadata.page).toBe(result.chunkPages[i]))
  })
})

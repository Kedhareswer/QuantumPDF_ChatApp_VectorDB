import { describe, expect, it } from "vitest"
import { buildChunks, joinPages, pageAtOffset } from "@/lib/advanced-chunking"

/** Every word of the source must survive chunking somewhere. */
function lostWords(text: string, chunks: string[]): string[] {
  const joined = chunks.join(" ")
  return [...new Set(text.match(/[A-Za-z0-9]+/g) || [])].filter((w) => !joined.includes(w))
}

describe("buildChunks", () => {
  it("keeps a short section that cannot be merged backwards (e.g. an intro before a code block)", () => {
    const code = "```js\n" + Array.from({ length: 30 }, (_, i) => `const value${i} = compute(${i}) // step ${i}`).join("\n") + "\n```"
    const { chunks } = buildChunks(`Zephyr install notes\n\n${code}`, "notes.md")
    expect(chunks.join(" ")).toContain("Zephyr install notes")
  })

  it("keeps a document shorter than the minimum chunk size", () => {
    const { chunks } = buildChunks("Invoice 4471 due March 3.", "short.txt")
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain("4471")
  })

  it("keeps trailing text without end punctuation in long sections", () => {
    const sentences = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} describes item${i} in detail.`).join(" ")
    const text = `${sentences} final unpunctuated tail marker`
    const { chunks } = buildChunks(text, "long.txt")
    expect(lostWords(text, chunks)).toEqual([])
  })
})

describe("page tagging", () => {
  it("maps offsets to 1-based pages", () => {
    expect(pageAtOffset([0, 100, 250], 0)).toBe(1)
    expect(pageAtOffset([0, 100, 250], 99)).toBe(1)
    expect(pageAtOffset([0, 100, 250], 100)).toBe(2)
    expect(pageAtOffset([0, 100, 250], 9999)).toBe(3)
    expect(pageAtOffset([], 5)).toBeNull()
  })

  it("tags each chunk with the page it starts on", () => {
    const page = (n: number) =>
      Array.from({ length: 12 }, (_, i) => `Page ${n} sentence ${i} talks about topic${n} in some detail.`).join(" ")
    const { text, pageStarts } = joinPages([page(1), page(2), page(3)])
    const { chunks, chunkPages } = buildChunks(text, "paged.pdf", "d", pageStarts)

    expect(chunkPages).toHaveLength(chunks.length)
    chunks.forEach((chunk, i) => {
      // A chunk's first sentence names the page it came from
      const first = chunk.match(/Page (\d+)/)
      expect(first && Number(first[1])).toBe(chunkPages![i])
    })
    expect(new Set(chunkPages)).toEqual(new Set([1, 2, 3]))
  })

  it("leaves chunkPages undefined when pages are unknown", () => {
    expect(buildChunks("Some text without pages. ".repeat(20)).chunkPages).toBeUndefined()
  })
})

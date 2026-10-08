import { describe, expect, it } from "vitest"
import { buildChunks } from "@/lib/advanced-chunking"

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

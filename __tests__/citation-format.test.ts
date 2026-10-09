import { describe, expect, it } from "vitest"
import { findCitedChunk, linkCitations } from "@/lib/citation-format"

const chunks = [
  { documentName: "Common_Labs.pdf", page: 3 },
  { documentName: "Common_Labs.pdf", page: 1 },
  { documentName: "Other Report.docx" },
]

describe("findCitedChunk", () => {
  it("matches file and page exactly", () => {
    expect(findCitedChunk("Common_Labs.pdf, p.1", chunks)).toBe(1)
  })

  it("falls back to the first chunk of the file when the page is missing", () => {
    expect(findCitedChunk("Common_Labs.pdf, p.99", chunks)).toBe(0)
    expect(findCitedChunk("Other Report.docx", chunks)).toBe(2)
  })

  it("returns -1 for an unknown file", () => {
    expect(findCitedChunk("Nope.pdf, p.1", chunks)).toBe(-1)
  })
})

describe("linkCitations", () => {
  it("numbers citations by chunk position, not by order of appearance", () => {
    const out = linkCitations("A [Common_Labs.pdf, p.1]. B [Common_Labs.pdf, p.3].", chunks)
    expect(out).toBe("A[2](#cite-2). B[1](#cite-1).")
  })

  it("emits one link per citation when a claim cites several chunks", () => {
    const out = linkCitations("X [Common_Labs.pdf, p.3] [Other Report.docx].", chunks)
    expect(out).toBe("X[1](#cite-1)[3](#cite-3).")
  })

  it("collapses a repeated citation on the same claim", () => {
    expect(linkCitations("X [Common_Labs.pdf, p.3] [Common_Labs.pdf, p.3].", chunks)).toBe("X[1](#cite-1).")
  })

  it("adds no Sources footer", () => {
    expect(linkCitations("A [Common_Labs.pdf, p.1].", chunks)).not.toContain("Sources")
  })

  it("keeps an unmatched citation as written", () => {
    expect(linkCitations("A [Nope.pdf, p.2].", chunks)).toBe("A [Nope.pdf, p.2].")
  })

  it("does not touch markdown links or numeric arrays", () => {
    const input = "See [the docs](https://example.com) and the list [1, 2, 3]."
    expect(linkCitations(input, chunks)).toBe(input)
  })
})

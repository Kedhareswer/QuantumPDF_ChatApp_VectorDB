import { describe, expect, it } from "vitest"
import {
  buildChunks,
  findMarkdownHeadings,
  sectionAtOffset,
  SECTION_LABEL_MAX,
} from "@/lib/advanced-chunking"

/** A spreadsheet the way anydoc renders it: one `## <sheet name>` + GFM table per sheet. */
function sheet(name: string, rows: number, tag: string): string {
  const body = Array.from({ length: rows }, (_, i) => `| ${tag}-${i} | ${i * 7} | note ${tag} row ${i} |`)
  return [`## ${name}`, "", "| Item | Cost | Note |", "| --- | --- | --- |", ...body].join("\n")
}

describe("findMarkdownHeadings / sectionAtOffset", () => {
  it("strips markers, closing hashes and whitespace, and skips fenced code", () => {
    const text = "intro\n# Title #\n```\n# not a heading\n```\n###   Deep   heading  \n#hashtag\n#\nC# notes"
    const headings = findMarkdownHeadings(text)

    expect(headings.map((h) => h.label)).toEqual(["Title", "Deep heading"])
    expect(text.slice(headings[0].offset).startsWith("# Title")).toBe(true)
    expect(text.slice(headings[1].offset).startsWith("###")).toBe(true)
  })

  it("handles CRLF line endings", () => {
    const headings = findMarkdownHeadings("# One\r\nbody\r\n## Two\r\n")
    expect(headings.map((h) => h.label)).toEqual(["One", "Two"])
    expect(headings[1].offset).toBe("# One\r\nbody\r\n".length)
  })

  it("caps long headings", () => {
    const [heading] = findMarkdownHeadings(`# ${"word ".repeat(40)}`)
    expect(heading.label.length).toBeLessThanOrEqual(SECTION_LABEL_MAX)
    expect(heading.label.endsWith("…")).toBe(true)
  })

  it("returns the nearest heading at or before an offset, null before the first", () => {
    const headings = [
      { offset: 10, label: "A" },
      { offset: 50, label: "B" },
    ]
    expect(sectionAtOffset(headings, 0)).toBeNull()
    expect(sectionAtOffset(headings, 10)).toBe("A")
    expect(sectionAtOffset(headings, 49)).toBe("A")
    expect(sectionAtOffset(headings, 50)).toBe("B")
    expect(sectionAtOffset([], 5)).toBeNull()
  })
})

describe("buildChunks chunkSections", () => {
  it("labels every chunk of a multi-sheet workbook with its sheet name", () => {
    const text = [sheet("Revenue Q1", 60, "rev"), sheet("Costs", 60, "cost")].join("\n\n")
    const { chunks, chunkSections } = buildChunks(text, "book.xlsx", "d", undefined, { sections: true })

    expect(chunks.length).toBeGreaterThan(2)
    expect(chunkSections).toHaveLength(chunks.length)
    chunks.forEach((chunk, i) => {
      // Rows are tagged with their sheet, so each chunk's own rows say which sheet it belongs to.
      const tag = /\| (rev|cost)-\d+ \|/.exec(chunk)?.[1]
      if (tag) expect(chunkSections![i]).toBe(tag === "rev" ? "Revenue Q1" : "Costs")
    })
    expect(new Set(chunkSections)).toEqual(new Set(["Revenue Q1", "Costs"]))
  })

  it("does not jump back to an earlier sheet when sheets repeat identical rows", () => {
    // Same columns and same values in every month: only the heading differs.
    const month = (name: string) =>
      [`## ${name}`, "", "| Item | Cost |", "| --- | --- |", ...Array.from({ length: 40 }, (_, i) => `| line ${i} | ${i} |`)].join("\n")
    const text = ["Jan", "Feb", "Mar"].map(month).join("\n\n")
    const { chunks, chunkSections } = buildChunks(text, "months.xlsx", "d", undefined, { sections: true })

    expect(chunkSections).toHaveLength(chunks.length)
    // Sections must appear in document order, never stepping backwards.
    const order = ["Jan", "Feb", "Mar"]
    const indices = chunkSections!.map((s) => order.indexOf(s ?? ""))
    expect(indices.every((v, i) => i === 0 || v >= indices[i - 1])).toBe(true)
    expect(new Set(chunkSections)).toEqual(new Set(order))
  })

  it("splits identical multi-chunk sheets evenly between their headings", () => {
    const month = (name: string) =>
      [`## ${name}`, "", "| Item | Cost |", "| --- | --- |", ...Array.from({ length: 300 }, (_, i) => `| line ${i} | ${i} |`)].join("\n")
    const text = ["Jan", "Feb", "Mar"].map(month).join("\n\n")
    const { chunks, chunkSections } = buildChunks(text, "months.xlsx", "d", undefined, { sections: true })

    const count = (label: string) => chunkSections!.filter((s) => s === label).length
    expect(chunks.length).toBeGreaterThanOrEqual(9)
    expect(count("Jan")).toBe(chunks.length / 3)
    expect(count("Feb")).toBe(chunks.length / 3)
    expect(count("Mar")).toBe(chunks.length / 3)
  })

  it("uses Word-style headings and null before the first one", () => {
    const para = (s: string) => `${s} `.repeat(60).trim()
    const text = [para("Preamble text before any heading."), "# Introduction", para("Intro body sentence."), "## Details", para("Detail body sentence.")].join("\n\n")
    const { chunks, chunkSections } = buildChunks(text, "doc.docx", "d", undefined, { sections: true })

    expect(chunkSections).toHaveLength(chunks.length)
    expect(chunkSections![0]).toBeNull()
    chunks.forEach((chunk, i) => {
      if (chunk.startsWith("Intro body")) expect(chunkSections![i]).toBe("Introduction")
      if (chunk.startsWith("Detail body")) expect(chunkSections![i]).toBe("Details")
    })
    expect(chunkSections).toContain("Details")
  })

  it("is all-null for text without headings, and absent unless requested", () => {
    const text = "Plain sentence without structure. ".repeat(80)
    const withSections = buildChunks(text, "plain.csv", "d", undefined, { sections: true })
    expect(withSections.chunkSections).toEqual(withSections.chunks.map(() => null))
    expect(buildChunks(text, "plain.csv").chunkSections).toBeUndefined()
  })

  it("leaves chunks and chunkPages unchanged when sections are requested", () => {
    const pages = ["# Alpha\n\n" + "Page one words here. ".repeat(60), "# Beta\n\n" + "Page two words here. ".repeat(60)]
    const text = pages.join("\n\n")
    const pageStarts = [0, pages[0].length + 2]

    const plain = buildChunks(text, "p.pdf", "d", pageStarts)
    const sectioned = buildChunks(text, "p.pdf", "d", pageStarts, { sections: true })

    expect(sectioned.chunks).toEqual(plain.chunks)
    expect(sectioned.chunkPages).toEqual(plain.chunkPages)
    expect(sectioned.chunkSections).toHaveLength(plain.chunks.length)
  })
})

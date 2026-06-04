import { describe, expect, it } from "vitest"
import { formatCitationsForDisplay, toSuperscript } from "@/lib/citation-format"

describe("toSuperscript", () => {
  it("maps multi-digit numbers", () => {
    expect(toSuperscript(1)).toBe("¹")
    expect(toSuperscript(10)).toBe("¹⁰")
  })
})

describe("formatCitationsForDisplay", () => {
  it("replaces an inline citation with a superscript and a Sources line", () => {
    const out = formatCitationsForDisplay("MCH normal range is 27-31 pg [Common_Labs.pdf, p.1].")
    expect(out).not.toContain("[Common_Labs.pdf, p.1]")
    expect(out).toContain("pg¹.")
    expect(out).toContain("**Sources:**")
    expect(out).toContain("¹ Common_Labs.pdf, p.1")
  })

  it("dedupes repeated citations to the same number", () => {
    const out = formatCitationsForDisplay(
      "A [Common_Labs.pdf, p.1]. B [Common_Labs.pdf, p.1]. C [Common_Labs.pdf, p.3].",
    )
    // Two distinct sources -> ¹ and ²
    expect(out).toContain("A¹.")
    expect(out).toContain("B¹.")
    expect(out).toContain("C².")
    // Sources line lists each unique source once
    expect(out.match(/Common_Labs\.pdf, p\.1/g)?.length).toBe(1)
    expect(out).toContain("² Common_Labs.pdf, p.3")
  })

  it("returns content unchanged when there are no citations", () => {
    const input = "Just a plain answer with no citations."
    expect(formatCitationsForDisplay(input)).toBe(input)
  })

  it("does not touch markdown links or numeric arrays", () => {
    const input = "See [the docs](https://example.com) and the list [1, 2, 3]."
    expect(formatCitationsForDisplay(input)).toBe(input)
  })

  it("handles a bare filename citation without a page", () => {
    const out = formatCitationsForDisplay("Sodium range is 135-145 mmol/L [Common_Labs.pdf].")
    expect(out).not.toContain("[Common_Labs.pdf]")
    expect(out).toContain("mmol/L¹.")
    expect(out).toContain("¹ Common_Labs.pdf")
  })
})

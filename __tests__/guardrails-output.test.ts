import { describe, expect, it } from "vitest"
import { validateOutput } from "@/lib/guardrails"

const chunks = [{ content: "Contact support at help@acme.com or 555-123-4567.", source: "doc.pdf" }]

describe("validateOutput", () => {
  it("keeps sensitive values that appear in the sources", () => {
    const r = validateOutput("Email help@acme.com or call 555 123 4567 [doc.pdf].", "", chunks)
    expect(r.sanitizedOutput).toContain("help@acme.com")
    expect(r.sanitizedOutput).toContain("555 123 4567")
    expect(r.redactions).toEqual([])
  })

  it("redacts sensitive values the sources do not contain", () => {
    const r = validateOutput("Write to ceo@acme.com, SSN 123-45-6789, card 4111 1111 1111 1111 [doc.pdf].", "", chunks)
    expect(r.sanitizedOutput).not.toMatch(/ceo@acme\.com|123-45-6789|4111/)
    expect(r.sanitizedOutput).toContain("[email address removed]")
    expect(r.sanitizedOutput).toContain("[US SSN removed]")
    expect(r.sanitizedOutput).toContain("[card number removed]")
    expect(r.issues.join(" ")).toMatch(/Removed 3 values/)
  })

  it("does not treat ordinary long numbers as card numbers", () => {
    const r = validateOutput("Order 1234 5678 9012 3456 shipped [doc.pdf].", "", chunks)
    expect(r.sanitizedOutput).toContain("1234 5678 9012 3456")
  })

  it("flags missing citations and hedging, but not 'not found' answers", () => {
    expect(validateOutput("I think the fee is ten euros.", "", chunks).issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/hedging/), expect.stringMatching(/no citations/)]),
    )
    expect(validateOutput("Not found in the provided documents.", "", chunks).issues).toEqual([])
  })

  it("does not flag security vocabulary that the old word list blocked", () => {
    const r = validateOutput("The attack exploited a password reset flaw [doc.pdf].", "", chunks)
    expect(r.isValid).toBe(true)
  })

  it("strips control characters", () => {
    expect(validateOutput("Fine\u0007 answer [doc.pdf].", "", chunks).sanitizedOutput).toBe("Fine answer [doc.pdf].")
  })
})

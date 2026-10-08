import { afterEach, describe, expect, it, vi } from "vitest"
import { RAGEngine } from "@/lib/rag-engine"
import { AIClient } from "@/lib/ai-client"

/**
 * End-to-end run of RAGEngine.query against a stubbed OpenAI-compatible
 * provider with no embeddings API (Groq), so retrieval uses the local lexical
 * embedding and only chat calls hit "the network".
 */
function stubChat(critiqueVerdict: "pass" | "revise") {
  const prompts: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      const last = body.messages[body.messages.length - 1].content as string
      const system = body.messages[0].content as string
      prompts.push(system.includes("citation auditor") ? "critique" : last.includes("<issues>") ? "refine" : "other")
      let content = "OK"
      if (system.includes("citation auditor")) {
        content = JSON.stringify({ uncited_claims: [], hallucinated_claims: [], missing_info: [], verdict: critiqueVerdict })
      } else if (last.includes("<issues>")) {
        content = "Refined: the warranty lasts 24 months [handbook.pdf]."
      } else if (last.includes("<sources>")) {
        content = "The warranty lasts 24 months [handbook.pdf]."
      } else if (last.includes("REWRITTEN:")) {
        content = "REWRITTEN: how long does the product warranty last\nALT1: warranty duration\nCONFIDENCE: 0.9"
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
    }),
  )
  return prompts
}

async function engineWithDocs() {
  const engine = new RAGEngine()
  await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
  const chunks = [
    "The product warranty lasts 24 months from the date of purchase and covers manufacturing defects.",
    "Shipping is free for orders above 50 euros within the European Union.",
    "Returns are accepted within 30 days if the item is unused and in original packaging.",
  ]
  await engine.addDocument({ id: "doc1", name: "handbook.pdf", content: chunks.join("\n"), chunks, embeddings: [], uploadedAt: new Date() })
  return engine
}

afterEach(() => {
  vi.unstubAllGlobals()
  AIClient.clearEmbeddingCache()
})

describe("RAGEngine.query", () => {
  it("retrieves the relevant chunk and skips refinement when the critique passes", async () => {
    const prompts = stubChat("pass")
    const engine = await engineWithDocs()
    prompts.length = 0

    const res = await engine.query("How long does the product warranty last and what does it cover?", { complexityLevel: "normal" })

    expect(res.answer).toContain("24 months")
    expect(res.retrievedChunks[0].content).toContain("warranty")
    expect(prompts).toContain("critique")
    expect(prompts).not.toContain("refine")
    // Similarity stays a cosine-like 0..1 score (not a ~0.03 RRF score)
    expect(res.retrievedChunks[0].similarity).toBeGreaterThan(0.1)
  })

  it("refines the draft when the critique asks for revision", async () => {
    const prompts = stubChat("revise")
    const engine = await engineWithDocs()
    prompts.length = 0

    const res = await engine.query("How long does the product warranty last and what does it cover?", { complexityLevel: "normal" })
    expect(prompts).toContain("refine")
    expect(res.answer).toContain("Refined")
  })

  it("never serves a cached answer across different document filters", async () => {
    stubChat("pass")
    const engine = await engineWithDocs()
    await engine.query("What is the return policy for unused items?", { complexityLevel: "simple" })
    const scoped = await engine.query("What is the return policy for unused items?", {
      complexityLevel: "simple",
      filters: { documentIds: ["some-other-doc"] },
    })
    // The filter excludes every document, so nothing may be retrieved — a cache hit would return doc1's chunks.
    expect(scoped.retrievedChunks.every((c) => (c as { documentId?: string }).documentId !== "doc1")).toBe(true)
  })
})

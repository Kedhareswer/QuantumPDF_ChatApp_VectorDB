import { afterEach, describe, expect, it, vi } from "vitest"
import { RAGEngine } from "@/lib/rag-engine"
import { AIClient } from "@/lib/ai-client"
import { resetQueryProcessor } from "@/lib/query-processor"

/**
 * End-to-end runs of RAGEngine.query against a stubbed OpenAI-compatible
 * provider with no embeddings API (Groq), so retrieval uses the local lexical
 * embedding and only chat calls hit "the network".
 */
type Verdict = { claims: Array<{ claim: string; supported: boolean }>; verdict: "pass" | "revise" }

function stubChat(verdicts: Verdict[], answer = "The warranty lasts 24 months [handbook.pdf, p.2].") {
  const calls: Array<{ kind: string; user: string }> = []
  let verifications = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      const user = body.messages[body.messages.length - 1].content as string
      const system = body.messages[0].content as string
      let kind = "other"
      let content = "OK"
      if (system.includes("fact-checker")) {
        kind = "verify"
        const v = verdicts[Math.min(verifications++, verdicts.length - 1)]
        content = JSON.stringify({ ...v, uncited_claims: [], hallucinated_claims: [], missing_info: [] })
      } else if (user.includes("<issues>")) {
        kind = "refine"
        content = "Refined: the warranty lasts 24 months [handbook.pdf, p.2]."
      } else if (user.includes("<sources>")) {
        kind = "answer"
        content = answer
      } else if (user.includes("REWRITTEN:")) {
        content = "REWRITTEN: how long does the product warranty last\nALT1: warranty duration\nCONFIDENCE: 0.9"
      }
      calls.push({ kind, user })
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
    }),
  )
  return calls
}

const CHUNKS = [
  "Shipping is free for orders above 50 euros within the European Union.",
  "The product warranty lasts 24 months from the date of purchase and covers manufacturing defects.",
  "Returns are accepted within 30 days if the item is unused and in original packaging.",
]

async function engineWithDocs() {
  const engine = new RAGEngine()
  await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
  await engine.addDocument({
    id: "doc1",
    name: "handbook.pdf",
    content: CHUNKS.join("\n"),
    chunks: CHUNKS,
    chunkPages: [1, 2, 3],
    embeddings: [],
    uploadedAt: new Date(),
  })
  return engine
}

const PASS: Verdict = { claims: [{ claim: "warranty is 24 months", supported: true }], verdict: "pass" }
const QUESTION = "How long does the product warranty last and what does it cover?"

afterEach(() => {
  vi.unstubAllGlobals()
  AIClient.clearEmbeddingCache()
  resetQueryProcessor() // the answer cache is a process-wide singleton
})

describe("RAGEngine.query", () => {
  it("retrieves the relevant chunk and skips refinement when verification passes", async () => {
    const calls = stubChat([PASS])
    const engine = await engineWithDocs()
    calls.length = 0

    const res = await engine.query(QUESTION, { complexityLevel: "normal" })

    expect(res.answer).toContain("24 months")
    expect(res.retrievedChunks[0].content).toContain("warranty")
    expect(calls.map((c) => c.kind)).toContain("verify")
    expect(calls.map((c) => c.kind)).not.toContain("refine")
    // Similarity stays a cosine-like 0..1 score (not a ~0.03 RRF score)
    expect(res.retrievedChunks[0].similarity).toBeGreaterThan(0.1)
  })

  it("labels context and sources with the chunk's page number", async () => {
    const calls = stubChat([PASS])
    const engine = await engineWithDocs()
    calls.length = 0

    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    const warranty = res.retrievedChunks.find((c) => c.content.includes("warranty"))!
    expect(warranty.page).toBe(2)
    expect(warranty.source).toBe("handbook.pdf · p.2")
    const answerPrompt = calls.find((c) => c.kind === "answer")!.user
    expect(answerPrompt).toContain("[SOURCE: handbook.pdf | Page 2]")
  })

  it("derives groundedness from the LLM verifier's per-claim verdicts", async () => {
    stubChat([
      {
        claims: [
          { claim: "warranty is 24 months", supported: true },
          { claim: "warranty covers accidental damage", supported: false },
        ],
        verdict: "pass",
      },
    ])
    const engine = await engineWithDocs()
    const res = await engine.query(QUESTION, { complexityLevel: "normal" })

    expect(res.groundednessScore).toBe(0.5)
    expect(res.hallucinationDetected).toBe(true)
    expect(res.verifiedClaims?.unsupportedClaims).toEqual(["warranty covers accidental damage"])
  })

  it("verifies simple questions too (groundedness always comes from the verifier)", async () => {
    const calls = stubChat([PASS])
    const engine = await engineWithDocs()
    calls.length = 0

    const res = await engine.query("What is the warranty?", { complexityLevel: "simple" })
    expect(calls.map((c) => c.kind)).toContain("verify")
    expect(res.groundednessScore).toBe(1)
  })

  it("revises the draft and re-verifies the final answer when verification fails", async () => {
    const calls = stubChat([
      { claims: [{ claim: "warranty is 36 months", supported: false }], verdict: "revise" },
      { claims: [{ claim: "warranty is 24 months", supported: true }], verdict: "pass" },
    ])
    const engine = await engineWithDocs()
    calls.length = 0

    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    const kinds = calls.map((c) => c.kind)
    expect(kinds).toContain("refine")
    expect(kinds.filter((k) => k === "verify")).toHaveLength(2)
    expect(res.answer).toContain("Refined")
    // Score describes the final answer, not the rejected draft
    expect(res.groundednessScore).toBe(1)
    expect(res.hallucinationDetected).toBe(false)
  })

  it("adds chunks returned by an attached vector store even when they score low locally", async () => {
    stubChat([PASS])
    const chunks = [
      "The product warranty lasts 24 months from the date of purchase and covers manufacturing defects.",
      // Shares no terms with the question: below the similarity floor, so only the vector store can surface it.
      "Zebras graze quietly beneath violet nebulae near Quokka Station.",
    ]
    const build = async () => {
      const engine = new RAGEngine()
      await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
      await engine.addDocument({ id: "doc2", name: "mixed.pdf", content: chunks.join("\n"), chunks, embeddings: [], uploadedAt: new Date() })
      return engine
    }
    const remoteOnly = (r: { retrievedChunks: Array<{ content: string }> }) => r.retrievedChunks.some((c) => c.content.includes("Zebras"))

    const options = { complexityLevel: "normal" as const, filters: { minSimilarity: 0.2 } }

    // Control: without the vector store, that chunk is not retrieved.
    const baseline = await (await build()).query(QUESTION, options)
    expect(remoteOnly(baseline)).toBe(false)
    resetQueryProcessor()

    const engine = await build()
    const search = vi.fn(async () => [{ documentId: "doc2", chunkIndex: 1, score: 0.9 }])
    engine.setVectorSearch(search)
    const res = await engine.query(QUESTION, options)
    expect(search).toHaveBeenCalled()
    expect(remoteOnly(res)).toBe(true)
  })

  it("keeps answering from the browser index when the vector store fails", async () => {
    stubChat([PASS])
    const engine = await engineWithDocs()
    engine.setVectorSearch(async () => {
      throw new Error("pinecone down")
    })

    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    expect(res.retrievedChunks[0].content).toContain("warranty")
  })

  it("never serves a cached answer across different document filters", async () => {
    stubChat([PASS])
    const engine = await engineWithDocs()
    await engine.query("What is the return policy for unused items?", { complexityLevel: "simple" })
    const scoped = await engine.query("What is the return policy for unused items?", {
      complexityLevel: "simple",
      filters: { documentIds: ["some-other-doc"] },
    })
    // The filter excludes every document, so nothing may be retrieved — a cache hit would return doc1's chunks.
    expect(scoped.retrievedChunks.every((c) => c.documentId !== "doc1")).toBe(true)
  })
})

describe("RAGEngine fast mode and relevance floor", () => {
  it("answers with a single LLM call in fast mode", async () => {
    const calls = stubChat([PASS])
    const engine = await engineWithDocs()
    calls.length = 0

    const res = await engine.query(QUESTION, {
      complexityLevel: "normal",
      fastMode: true,
      conversationHistory: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
    })
    expect(calls.map((c) => c.kind)).toEqual(["answer"])
    expect(res.answer).toContain("24 months")
    expect(res.verifiedClaims).toBeUndefined() // groundedness is the lexical estimate
  })

  it("drops chunks far below the best match", async () => {
    stubChat([PASS])
    const engine = new RAGEngine()
    await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
    const chunks = [
      "The product warranty lasts 24 months from the date of purchase and covers manufacturing defects.",
      "Zebras graze quietly beneath violet nebulae near Quokka Station.",
    ]
    await engine.addDocument({ id: "d3", name: "m.pdf", content: "", chunks, embeddings: [], uploadedAt: new Date() })
    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    expect(res.retrievedChunks.map((c) => c.content)).toEqual([chunks[0]])
  })

  it("shows guardrail findings and redactions on the answer", async () => {
    stubChat([PASS], "Email the CEO at ceo@acme.com about the 24 month warranty [handbook.pdf, p.2].")
    const engine = await engineWithDocs()
    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    expect(res.answer).toContain("[email address removed]")
    expect(res.warnings?.join(" ")).toMatch(/not found in your documents/)
  })
})

describe("RAGEngine page ranges", () => {
  it("labels a chunk that spans pages with the range", async () => {
    const calls = stubChat([PASS])
    const engine = new RAGEngine()
    await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
    await engine.addDocument({
      id: "pr",
      name: "short.pdf",
      content: "",
      chunks: ["Shipping is free. The product warranty lasts 24 months from the date of purchase and covers defects."],
      chunkPages: [1],
      chunkPageEnds: [2],
      embeddings: [],
      uploadedAt: new Date(),
    })
    calls.length = 0
    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    expect(res.retrievedChunks[0].source).toBe("short.pdf · p.1–2")
    expect(calls.find((c) => c.kind === "answer")!.user).toContain("[SOURCE: short.pdf | Pages 1–2]")
  })
})

describe("RAGEngine section labels (non-PDF)", () => {
  it("labels sources and context with the chunk's heading or sheet", async () => {
    const calls = stubChat([PASS])
    const engine = new RAGEngine()
    await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
    await engine.addDocument({
      id: "x1",
      name: "budget.xlsx",
      content: "",
      chunks: ["The product warranty lasts 24 months from the date of purchase and covers manufacturing defects."],
      chunkSections: ["Warranty"],
      embeddings: [],
      uploadedAt: new Date(),
    })
    calls.length = 0
    const res = await engine.query(QUESTION, { complexityLevel: "normal" })
    expect(res.retrievedChunks[0].source).toBe("budget.xlsx · Warranty")
    expect(res.retrievedChunks[0].section).toBe("Warranty")
    expect(calls.find((c) => c.kind === "answer")!.user).toContain("[SOURCE: budget.xlsx | Section: Warranty]")
  })
})

describe("RAGEngine document embedding spaces", () => {
  it("re-embeds a restored document produced by a different embedding model", async () => {
    stubChat([PASS])
    const engine = new RAGEngine()
    await engine.initialize({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" })
    const stale = [[1, 0, 0]]
    await engine.addDocument({
      id: "d",
      name: "old.pdf",
      content: "x",
      chunks: ["The warranty lasts 24 months."],
      embeddings: stale,
      embeddingSpace: "openai:text-embedding-3-small",
      uploadedAt: new Date(),
    })
    const doc = engine.getDocuments()[0]
    expect(doc.embeddingSpace).toMatch(/^local-lexical/)
    expect(doc.embeddings[0].length).toBeGreaterThan(3)
  })
})

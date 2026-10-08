import { afterEach, describe, expect, it, vi } from "vitest"
import { AIClient, generateLexicalEmbedding } from "@/lib/ai-client"

type Call = { url: string; init: RequestInit; body: Record<string, unknown> }

/** Stub fetch with one response per call (the last one repeats). */
function stubFetch(...responses: Array<{ status?: number; json?: unknown; text?: string; sse?: string[] }>) {
  const calls: Call[] = []
  let i = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : {} })
      const r = responses[Math.min(i++, responses.length - 1)]
      if (r.sse) {
        const body = new ReadableStream({
          start(controller) {
            for (const line of r.sse!) controller.enqueue(new TextEncoder().encode(`data: ${line}\n\n`))
            controller.close()
          },
        })
        return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })
      }
      return new Response(r.text ?? JSON.stringify(r.json ?? {}), { status: r.status ?? 200 })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  AIClient.clearEmbeddingCache()
})

describe("AIClient request shapes", () => {
  it("sends GPT-5/6 models max_completion_tokens and no temperature", async () => {
    const calls = stubFetch({ json: { choices: [{ message: { content: "hi" } }] } })
    const client = new AIClient({ provider: "openai", apiKey: "k", model: "gpt-6.1-sol" })
    await expect(client.generateText([{ role: "user", content: "x" }], { temperature: 0.1 })).resolves.toBe("hi")
    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions")
    expect(calls[0].body.max_completion_tokens).toBeGreaterThan(0)
    expect(calls[0].body).not.toHaveProperty("max_tokens")
    expect(calls[0].body).not.toHaveProperty("temperature")
  })

  it("keeps temperature for non-reasoning OpenAI-compatible models", async () => {
    const calls = stubFetch({ json: { choices: [{ message: { content: "ok" } }] } })
    await new AIClient({ provider: "groq", apiKey: "k", model: "openai/gpt-oss-120b" }).generateText(
      [{ role: "user", content: "x" }],
      { temperature: 0.3 },
    )
    expect(calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions")
    expect(calls[0].body.temperature).toBe(0.3)
    expect(calls[0].body.max_tokens).toBeGreaterThan(0)
  })

  it("calls Anthropic natively: browser header, no sampling params on 5-series, text blocks only", async () => {
    const calls = stubFetch({
      json: {
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: "The answer." },
        ],
      },
    })
    const client = new AIClient({ provider: "anthropic", apiKey: "k", model: "claude-sonnet-5-5" })
    const text = await client.generateText([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
    ])
    expect(text).toBe("The answer.")
    const headers = calls[0].init.headers as Record<string, string>
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages")
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true")
    expect(calls[0].body).not.toHaveProperty("temperature")
    expect(calls[0].body.system).toBe("sys")
    expect(calls[0].body.messages).toEqual([{ role: "user", content: "q" }])
  })

  it("migrates retired model ids before sending", async () => {
    const calls = stubFetch({ json: { content: [{ type: "text", text: "x" }] } })
    await new AIClient({ provider: "anthropic", apiKey: "k", model: "claude-sonnet-5" }).generateText([
      { role: "user", content: "q" },
    ])
    expect(calls[0].body.model).toBe("claude-sonnet-5-5")
  })

  it("sends Gemini the system prompt as systemInstruction and skips thought parts", async () => {
    const calls = stubFetch({
      json: { candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: "Answer" }] } }] },
    })
    const client = new AIClient({ provider: "googleai", apiKey: "k", model: "gemini-3.5-flash-lite" })
    const text = await client.generateText([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
    ])
    expect(text).toBe("Answer")
    expect(calls[0].url).toContain("/models/gemini-3.5-flash-lite:generateContent")
    expect(calls[0].url).not.toContain("key=") // key goes in a header, not the URL
    expect(calls[0].body.systemInstruction).toEqual({ parts: [{ text: "sys" }] })
    expect((calls[0].body.contents as unknown[]).length).toBe(1)
  })

  it("surfaces the provider's error message instead of the status text", async () => {
    stubFetch({ status: 404, json: { error: { message: "The model `nope` does not exist" } } })
    const client = new AIClient({ provider: "openai", apiKey: "k", model: "nope" })
    await expect(client.generateText([{ role: "user", content: "x" }])).rejects.toThrow(/does not exist/)
  })

  it("retries a 429 and then succeeds", async () => {
    vi.useFakeTimers()
    try {
      const calls = stubFetch({ status: 429, json: { error: "slow down" } }, { json: { choices: [{ message: { content: "ok" } }] } })
      const promise = new AIClient({ provider: "mistral", apiKey: "k", model: "mistral-small-latest" }).generateText([
        { role: "user", content: "x" },
      ])
      await vi.runAllTimersAsync()
      await expect(promise).resolves.toBe("ok")
      expect(calls).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("streams OpenAI-compatible deltas and hides inline <think> blocks", async () => {
    stubFetch({
      sse: [
        JSON.stringify({ choices: [{ delta: { content: "<think>plan" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "</think>Hello" } }] }),
        JSON.stringify({ choices: [{ delta: { content: " world" } }] }),
        "[DONE]",
      ],
    })
    let out = ""
    await new AIClient({ provider: "deepseek", apiKey: "k", model: "deepseek-flash" }).generateTextStream(
      [{ role: "user", content: "x" }],
      (c) => (out += c),
    )
    expect(out).toBe("Hello world")
  })
})

describe("AIClient embeddings", () => {
  it("batches remote embeddings in one request and keeps input order", async () => {
    const calls = stubFetch({
      json: {
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      },
    })
    const client = new AIClient({ provider: "openai", apiKey: "k", model: "gpt-5.6-terra" })
    const out = await client.generateEmbeddings(["a", "b"])
    expect(calls).toHaveLength(1)
    expect(calls[0].body.model).toBe("text-embedding-3-small")
    expect(calls[0].body.input).toEqual(["a", "b"])
    expect(out).toEqual([
      [1, 0],
      [0, 1],
    ])
  })

  it("throws when a remote embeddings API fails instead of returning fake vectors", async () => {
    stubFetch({ status: 401, json: { error: { message: "bad key" } } })
    const client = new AIClient({ provider: "mistral", apiKey: "k", model: "mistral-small-latest" })
    await expect(client.generateEmbedding("hello")).rejects.toThrow(/bad key/)
  })

  it("uses local lexical embeddings, without network calls, for providers with no embeddings API", async () => {
    const calls = stubFetch({ json: {} })
    const client = new AIClient({ provider: "anthropic", apiKey: "k", model: "claude-sonnet-5-5" })
    expect(client.usesRemoteEmbeddings).toBe(false)
    const [v] = await client.generateEmbeddings(["quarterly revenue grew"])
    expect(calls).toHaveLength(0)
    expect(v).toEqual(generateLexicalEmbedding("quarterly revenue grew"))
  })

  it("keys the cache by embedding model, so switching models never reuses vectors", () => {
    const a = new AIClient({ provider: "openai", apiKey: "k", model: "gpt-5.6-terra" })
    const b = new AIClient({ provider: "openai", apiKey: "k", model: "text-embedding-3-large" })
    expect(a.embeddingSpaceId).not.toBe(b.embeddingSpaceId)
  })
})

describe("generateLexicalEmbedding", () => {
  const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0)

  it("is deterministic and unit-length", () => {
    const v = generateLexicalEmbedding("Net revenue increased 12% in 2025")
    expect(v).toEqual(generateLexicalEmbedding("Net revenue increased 12% in 2025"))
    expect(Math.sqrt(cos(v, v))).toBeCloseTo(1, 6)
  })

  it("scores texts that share terms above unrelated ones", () => {
    const q = generateLexicalEmbedding("what was the revenue growth")
    const related = generateLexicalEmbedding("Revenue growth was strong this quarter, driven by subscriptions.")
    const unrelated = generateLexicalEmbedding("The cat sat quietly on the warm windowsill.")
    expect(cos(q, related)).toBeGreaterThan(cos(q, unrelated) + 0.1)
  })
})

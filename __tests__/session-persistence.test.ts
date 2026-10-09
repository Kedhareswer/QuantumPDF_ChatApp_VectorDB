import { describe, expect, it } from "vitest"
import { SessionPersistence, createMemoryStore } from "@/lib/session-persistence"
import type { Document, Message } from "@/lib/store"

const doc = (id: string, uploadedAt: Date): Document => ({
  id,
  name: `${id}.pdf`,
  content: "text",
  chunks: ["chunk one", "chunk two"],
  chunkPages: [1, 2],
  embeddings: [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ],
  embeddingSpace: "openai:text-embedding-3-small",
  uploadedAt,
})

describe("SessionPersistence", () => {
  it("round-trips documents (embeddings as float32), oldest first", async () => {
    const p = new SessionPersistence(createMemoryStore())
    await p.saveDocument(doc("b", new Date(2026, 1, 2)))
    await p.saveDocument(doc("a", new Date(2026, 1, 1)))

    const loaded = await p.loadDocuments()
    expect(loaded.map((d) => d.id)).toEqual(["a", "b"])
    expect(loaded[0].chunks).toEqual(["chunk one", "chunk two"])
    expect(loaded[0].chunkPages).toEqual([1, 2])
    expect(loaded[0].embeddingSpace).toBe("openai:text-embedding-3-small")
    expect(loaded[0].uploadedAt).toBeInstanceOf(Date)
    expect(Array.isArray(loaded[0].embeddings[0])).toBe(true)
    loaded[0].embeddings[0].forEach((v, i) => expect(v).toBeCloseTo([0.1, 0.2, 0.3][i], 6))
  })

  it("stores TextChunk-style chunks as plain strings", async () => {
    const p = new SessionPersistence(createMemoryStore())
    await p.saveDocument({ ...doc("c", new Date()), chunks: [{ content: "rich chunk" }] })
    expect((await p.loadDocuments())[0].chunks).toEqual(["rich chunk"])
  })

  it("deletes one document and clears everything", async () => {
    const p = new SessionPersistence(createMemoryStore())
    await p.saveDocument(doc("a", new Date()))
    await p.saveDocument(doc("b", new Date()))
    await p.deleteDocument("a")
    expect((await p.loadDocuments()).map((d) => d.id)).toEqual(["b"])

    await p.saveMessages([{ id: "m", role: "user", content: "hi", timestamp: new Date() }])
    await p.clear()
    expect(await p.loadDocuments()).toEqual([])
    expect(await p.loadMessages()).toEqual([])
  })

  it("round-trips messages, keeping only the most recent 200", async () => {
    const p = new SessionPersistence(createMemoryStore())
    const messages: Message[] = Array.from({ length: 250 }, (_, i) => ({
      id: String(i),
      role: i % 2 ? "assistant" : "user",
      content: `m${i}`,
      timestamp: new Date(2026, 0, 1, 0, i),
    }))
    await p.saveMessages(messages)
    const loaded = await p.loadMessages()
    expect(loaded).toHaveLength(200)
    expect(loaded[0].id).toBe("50")
    expect(loaded[0].timestamp).toBeInstanceOf(Date)
  })

  it("is a silent no-op without storage (SSR, private mode)", async () => {
    const p = new SessionPersistence(null)
    await expect(p.saveDocument(doc("a", new Date()))).resolves.toBeUndefined()
    expect(await p.loadDocuments()).toEqual([])
  })

  it("never throws when the store fails", async () => {
    const broken = createMemoryStore()
    broken.set = async () => {
      throw new Error("QuotaExceededError")
    }
    const p = new SessionPersistence(broken)
    await expect(p.saveDocument(doc("a", new Date()))).resolves.toBeUndefined()
  })
})

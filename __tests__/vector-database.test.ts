import { afterEach, describe, expect, it, vi } from "vitest"
import type { VectorDocument } from "@/lib/vector-database-types"

const pinecone = vi.hoisted(() => ({
  upsert: vi.fn<(options: { records: Array<{ metadata: { timestamp: string } }> }) => Promise<void>>(async () => {}),
  query: vi.fn(async () => ({ matches: [{ id: "d_0", score: 0.9, metadata: { content: "hello", documentId: "d", chunkIndex: 0 } }] })),
  describeIndexStats: vi.fn(async () => ({ dimension: 3 })),
  createIndex: vi.fn(async () => {}),
}))
vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: class {
    index() {
      return { upsert: pinecone.upsert, query: pinecone.query, describeIndexStats: pinecone.describeIndexStats }
    }
    createIndex = pinecone.createIndex
  },
}))

const weaviate = vi.hoisted(() => ({ withObjects: vi.fn(), connection: vi.fn() }))
vi.mock("weaviate-ts-client", () => {
  const batcher = {
    withObjects: (...objects: unknown[]) => {
      weaviate.withObjects(objects)
      return { do: async () => objects.map(() => ({ result: {} })) }
    },
  }
  return {
    default: {
      client: (params: unknown) => {
        weaviate.connection(params)
        return {
          schema: { getter: () => ({ do: async () => ({ classes: [{ class: "Document" }] }) }) },
          batch: { objectsBatcher: () => batcher },
        }
      },
    },
    ApiKey: class {
      constructor(public key: string) {}
    },
    generateUuid5: (id: string) => `uuid-for-${id}`,
  }
})

import { createVectorDatabase, parseWeaviateUrl } from "@/lib/vector-database"
import { VectorDatabaseClient } from "@/lib/vector-database-client"

const docs = (n: number, dim = 3): VectorDocument[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `d_${i}`,
    content: `chunk ${i}`,
    embedding: Array(dim).fill(0.1),
    // Arrives as a string after the JSON hop through /api/vector-db
    metadata: { source: "d.pdf", chunkIndex: i, documentId: "d", timestamp: "2026-10-08T00:00:00.000Z" as unknown as Date },
  }))

afterEach(() => vi.clearAllMocks())

describe("Pinecone adapter", () => {
  it("upserts { records } in batches of 100 with an ISO timestamp", async () => {
    const db = createVectorDatabase({ provider: "pinecone", apiKey: "k" })
    await db.addDocuments(docs(250))
    expect(pinecone.upsert).toHaveBeenCalledTimes(3)
    const first = pinecone.upsert.mock.calls[0][0]
    expect(first.records).toHaveLength(100)
    expect(first.records[0].metadata.timestamp).toBe("2026-10-08T00:00:00.000Z")
  })

  it("refuses vectors whose dimension does not match the index", async () => {
    const db = createVectorDatabase({ provider: "pinecone", apiKey: "k" })
    await expect(db.addDocuments(docs(1, 5))).rejects.toThrow(/dimension 3/)
  })

  it("translates documentIds into a metadata $in filter", async () => {
    const db = createVectorDatabase({ provider: "pinecone", apiKey: "k" })
    const hits = await db.search("", [0.1, 0.1, 0.1], { mode: "semantic", limit: 5, documentIds: ["d"] })
    expect(pinecone.query).toHaveBeenCalledWith(expect.objectContaining({ topK: 5, filter: { documentId: { $in: ["d"] } } }))
    expect(hits[0]).toMatchObject({ id: "d_0", score: 0.9, content: "hello" })
  })
})

describe("Weaviate adapter", () => {
  it("parses cluster URLs into scheme + host", () => {
    expect(parseWeaviateUrl("https://xyz.weaviate.cloud/")).toEqual({ scheme: "https", host: "xyz.weaviate.cloud" })
    expect(parseWeaviateUrl("http://10.0.0.5:8080")).toEqual({ scheme: "http", host: "10.0.0.5:8080" })
    expect(parseWeaviateUrl("localhost:8080")).toEqual({ scheme: "http", host: "localhost:8080" })
    expect(parseWeaviateUrl("my-cluster.weaviate.network")).toEqual({ scheme: "https", host: "my-cluster.weaviate.network" })
  })

  it("batch-inserts objects with deterministic UUIDs and our vectors", async () => {
    const db = createVectorDatabase({ provider: "weaviate", url: "https://xyz.weaviate.cloud", apiKey: "secret" })
    await db.addDocuments(docs(150))
    expect(weaviate.withObjects).toHaveBeenCalledTimes(2)
    const firstBatch = weaviate.withObjects.mock.calls[0][0] as Array<{ id: string; class: string; vector: number[] }>
    expect(firstBatch).toHaveLength(100)
    expect(firstBatch[0]).toMatchObject({ id: "uuid-for-d_0", class: "Document", vector: [0.1, 0.1, 0.1] })
    expect(weaviate.connection).toHaveBeenCalledWith(expect.objectContaining({ scheme: "https", host: "xyz.weaviate.cloud" }))
  })
})

describe("VectorDatabaseClient", () => {
  it("never calls the server for the local provider (the browser index is the store)", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const client = new VectorDatabaseClient({ provider: "local" })
    await client.initialize()
    await client.addDocuments(docs(3))
    expect(await client.search("q", [1], { mode: "semantic" })).toEqual([])
    expect(await client.testConnection()).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("maps remote hits back to (documentId, chunkIndex)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            results: [
              { id: "x", content: "c", score: 0.8, metadata: { documentId: "doc", chunkIndex: 4 } },
              { id: "y", content: "c", score: 0.7, metadata: { source: "no ids" } },
            ],
          }),
        ),
      ),
    )
    const client = new VectorDatabaseClient({ provider: "pinecone", apiKey: "k" })
    expect(await client.searchChunks([1, 2], 10, ["doc"])).toEqual([{ documentId: "doc", chunkIndex: 4, score: 0.8 }])
    vi.unstubAllGlobals()
  })
})

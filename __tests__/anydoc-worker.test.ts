import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AnydocWorkerRequest, AnydocWorkerResponse } from "@/lib/anydoc-convert"

// The main-thread fallback path uses the (mocked) wasm module directly.
const { toMarkdownBytes } = vi.hoisted(() => ({ toMarkdownBytes: vi.fn() }))

vi.mock("@firecrawl/anydoc-wasm", () => ({
  default: vi.fn(),
  formatFromBytes: () => undefined,
  formatFromExtension: (ext: string) => (ext === "csv" || ext === "xlsx" ? ext : undefined),
  toMarkdownBytes,
}))

const MAIN_THREAD_TEXT = "## Main\n\n| a | b |\n| --- | --- |\n| 1 | 2 |"
const WORKER_TEXT = "## Sheet One\n\n| x | y |\n| --- | --- |\n| 3 | 4 |"

type Behaviour = (worker: MockWorker, request: AnydocWorkerRequest) => void

/** Stand-in for a module Worker: requests are answered by the current `behaviour`. */
class MockWorker extends EventTarget {
  static instances: MockWorker[] = []
  static behaviour: Behaviour = () => {}
  static throwOnConstruct = false

  terminated = false
  requests: AnydocWorkerRequest[] = []

  constructor(
    public url: URL | string,
    public options?: WorkerOptions,
  ) {
    super()
    if (MockWorker.throwOnConstruct) throw new Error("SecurityError: workers disabled")
    MockWorker.instances.push(this)
  }

  postMessage(request: AnydocWorkerRequest): void {
    this.requests.push(request)
    queueMicrotask(() => MockWorker.behaviour(this, request))
  }

  terminate(): void {
    this.terminated = true
  }

  reply(response: AnydocWorkerResponse): void {
    this.dispatchEvent(new MessageEvent("message", { data: response }))
  }

  crash(): void {
    this.dispatchEvent(new ErrorEvent("error", { message: "boom" }))
  }
}

const succeed: Behaviour = (w, req) =>
  w.reply({ id: req.id, ok: true, text: WORKER_TEXT, format: req.ext === "tsv" ? "csv" : req.ext })

const bytesOf = (s: string) => new TextEncoder().encode(s)

async function loadClient() {
  vi.resetModules()
  return import("@/lib/anydoc-client")
}

beforeEach(() => {
  MockWorker.instances = []
  MockWorker.behaviour = succeed
  MockWorker.throwOnConstruct = false
  toMarkdownBytes.mockReset()
  toMarkdownBytes.mockReturnValue(MAIN_THREAD_TEXT)
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("anydoc worker client", () => {
  it("converts on the main thread when Worker is undefined", async () => {
    expect(typeof Worker).toBe("undefined")
    const { extractDocument } = await loadClient()

    const result = await extractDocument(bytesOf("a,b\n1,2"), { fileName: "t.csv" })

    expect(toMarkdownBytes).toHaveBeenCalledTimes(1)
    expect(result.text).toBe(MAIN_THREAD_TEXT)
    expect(result.chunkSections).toEqual(result.chunks.map(() => "Main"))
  })

  it("converts in a single reused module worker", async () => {
    vi.stubGlobal("Worker", MockWorker)
    const { extractDocument } = await loadClient()

    const [a, b] = await Promise.all([
      extractDocument(bytesOf("a,b\n1,2"), { fileName: "one.csv" }),
      extractDocument(bytesOf("PK.."), { fileName: "two.xlsx" }),
    ])

    expect(MockWorker.instances).toHaveLength(1)
    const [worker] = MockWorker.instances
    expect(String(worker.url)).toMatch(/anydoc\.worker\.ts/)
    expect(worker.options).toEqual({ type: "module" })
    expect(worker.requests.map((r) => r.ext)).toEqual(["csv", "xlsx"])
    expect(new Set(worker.requests.map((r) => r.id)).size).toBe(2)
    expect(toMarkdownBytes).not.toHaveBeenCalled()
    expect(a.text).toBe(WORKER_TEXT)
    expect(b.format).toBe("xlsx")
    expect(a.chunkSections).toEqual(a.chunks.map(() => "Sheet One"))
  })

  it("propagates a conversion error with its anydoc code, without falling back", async () => {
    vi.stubGlobal("Worker", MockWorker)
    MockWorker.behaviour = (w, req) =>
      w.reply({
        id: req.id,
        ok: false,
        stage: "convert",
        error: { name: "Error", message: "encrypted document: password required", code: "encrypted" },
      })
    const { extractDocument } = await loadClient()

    const error = await extractDocument(bytesOf("PK.."), { fileName: "locked.xlsx" }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error & { code?: string }).code).toBe("encrypted")
    expect((error as Error).message).toMatch(/password required/)
    expect(toMarkdownBytes).not.toHaveBeenCalled()
    expect(MockWorker.instances[0].terminated).toBe(false)
  })

  it("falls back to the main thread when the worker crashes, then respawns", async () => {
    vi.stubGlobal("Worker", MockWorker)
    MockWorker.behaviour = (w) => w.crash()
    const { extractDocument } = await loadClient()

    const [a, b] = await Promise.all([
      extractDocument(bytesOf("a,b"), { fileName: "a.csv" }),
      extractDocument(bytesOf("c,d"), { fileName: "b.csv" }),
    ])

    // Both in-flight requests were rejected by the crash and re-run on the main thread.
    expect(a.text).toBe(MAIN_THREAD_TEXT)
    expect(b.text).toBe(MAIN_THREAD_TEXT)
    expect(toMarkdownBytes).toHaveBeenCalledTimes(2)
    expect(MockWorker.instances[0].terminated).toBe(true)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/crashed.*main thread/))

    MockWorker.behaviour = succeed
    const c = await extractDocument(bytesOf("e,f"), { fileName: "c.csv" })
    expect(MockWorker.instances).toHaveLength(2)
    expect(c.text).toBe(WORKER_TEXT)
  })

  it("stops spawning workers after repeated crashes", async () => {
    vi.stubGlobal("Worker", MockWorker)
    MockWorker.behaviour = (w) => w.crash()
    const { extractDocument } = await loadClient()

    for (let i = 0; i < 5; i++) await extractDocument(bytesOf("a,b"), { fileName: "a.csv" })

    expect(MockWorker.instances).toHaveLength(3)
    expect(toMarkdownBytes).toHaveBeenCalledTimes(5)
  })

  it("falls back when the wasm fails to initialise inside the worker", async () => {
    vi.stubGlobal("Worker", MockWorker)
    MockWorker.behaviour = (w, req) =>
      w.reply({ id: req.id, ok: false, stage: "init", error: { name: "TypeError", message: "fetch failed" } })
    const { extractDocument } = await loadClient()

    const result = await extractDocument(bytesOf("a,b"), { fileName: "a.csv" })

    expect(result.text).toBe(MAIN_THREAD_TEXT)
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/fetch failed/))
  })

  it("falls back when the Worker constructor throws", async () => {
    vi.stubGlobal("Worker", MockWorker)
    MockWorker.throwOnConstruct = true
    const { extractDocument } = await loadClient()

    const result = await extractDocument(bytesOf("a,b"), { fileName: "a.csv" })

    expect(result.text).toBe(MAIN_THREAD_TEXT)
  })

  it("prefetch warms one worker that extraction then reuses", async () => {
    vi.stubGlobal("Worker", MockWorker)
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
      cb()
      return 0
    })
    const { extractDocument, prefetchAnydoc } = await loadClient()

    prefetchAnydoc()
    prefetchAnydoc()
    expect(MockWorker.instances).toHaveLength(1)

    await extractDocument(bytesOf("a,b"), { fileName: "a.csv" })
    expect(MockWorker.instances).toHaveLength(1)
    expect(toMarkdownBytes).not.toHaveBeenCalled()
  })
})

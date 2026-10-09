/**
 * Web Worker that runs anydoc's synchronous wasm conversion off the main
 * thread. Spawned by lib/anydoc-client.ts via
 * `new Worker(new URL("./anydoc.worker.ts", import.meta.url), { type: "module" })`,
 * which Turbopack recognises — it emits this file and the wasm it imports.
 *
 * The wasm download starts as soon as the worker boots, so creating the worker
 * (prefetchAnydoc) is what warms it.
 */
import {
  convertWithAnydoc,
  loadAnydoc,
  serializeError,
  type AnydocWorkerRequest,
  type AnydocWorkerResponse,
} from "./anydoc-convert"

// tsconfig's lib is "dom", not "webworker", so describe the bits of the
// worker global scope we use instead of trusting `self`'s Window typing.
interface WorkerScope {
  postMessage(message: AnydocWorkerResponse): void
  addEventListener(type: "message", listener: (event: MessageEvent<AnydocWorkerRequest>) => void): void
}
const scope = self as unknown as WorkerScope

// Start fetching/compiling immediately; a failure is reported per request.
loadAnydoc().catch(() => {})

scope.addEventListener("message", async (event) => {
  const { id, bytes, ext } = event.data
  let mod
  try {
    mod = await loadAnydoc()
  } catch (error) {
    scope.postMessage({ id, ok: false, stage: "init", error: serializeError(error) })
    return
  }
  try {
    const { text, format } = convertWithAnydoc(mod, bytes, ext)
    scope.postMessage({ id, ok: true, text, format })
  } catch (error) {
    scope.postMessage({ id, ok: false, stage: "convert", error: serializeError(error) })
  }
})

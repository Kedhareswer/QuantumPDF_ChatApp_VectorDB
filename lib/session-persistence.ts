/**
 * Persists the indexed documents (chunks + embeddings) and the chat history in
 * IndexedDB, so a page reload no longer throws the whole index away.
 *
 * localStorage is not an option: a few hundred chunks of 1536-float embeddings
 * is several MB, past its ~5MB quota. Embeddings are stored as Float32Array
 * (half the size of JS numbers, and precise enough for cosine similarity).
 *
 * All operations are best-effort: when IndexedDB is unavailable (SSR, private
 * mode, tests) they resolve to empty/no-op instead of throwing, so persistence
 * can never break uploading or chatting.
 */
import { logger } from "./logger"
import type { Document, Message } from "./store"

/** Minimal async key-value store; IndexedDB in the browser, a Map in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

const DB_NAME = "quantum-pdf"
const STORE_NAME = "session"
const DOC_PREFIX = "doc:"
const MESSAGES_KEY = "messages"
/** Older messages are dropped beyond this to keep the store bounded. */
const MAX_PERSISTED_MESSAGES = 200

interface StoredDocument extends Omit<Document, "embeddings"> {
  embeddings: Float32Array[]
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** IndexedDB-backed store, or null when IndexedDB is unavailable. */
export function createIndexedDBStore(): KeyValueStore | null {
  if (typeof indexedDB === "undefined") return null

  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error)
      }
    })
    return dbPromise
  }
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE_NAME, mode).objectStore(STORE_NAME)

  return {
    async get<T>(key: string) {
      return (await request((await store("readonly")).get(key))) as T | undefined
    },
    async set(key, value) {
      await request((await store("readwrite")).put(value, key))
    },
    async delete(key) {
      await request((await store("readwrite")).delete(key))
    },
    async keys() {
      return (await request((await store("readonly")).getAllKeys())).map(String)
    },
  }
}

/** In-memory store with the same semantics (structured-clone-free); for tests. */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, unknown>()
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined
    },
    async set(key, value) {
      map.set(key, value)
    },
    async delete(key) {
      map.delete(key)
    },
    async keys() {
      return [...map.keys()]
    },
  }
}

export class SessionPersistence {
  constructor(private readonly kv: KeyValueStore | null) {}

  private async safely<T>(what: string, fallback: T, fn: (kv: KeyValueStore) => Promise<T>): Promise<T> {
    if (!this.kv) return fallback
    try {
      return await fn(this.kv)
    } catch (error) {
      logger.warn(`Session persistence: ${what} failed:`, error)
      return fallback
    }
  }

  /** Accepts store documents and engine documents (whose chunks may be TextChunk objects). */
  saveDocument(doc: Omit<Document, "chunks"> & { chunks: ReadonlyArray<string | { content: string }> }): Promise<void> {
    return this.safely("saving a document", undefined, (kv) => {
      const stored: StoredDocument = {
        ...doc,
        chunks: doc.chunks.map((c) => (typeof c === "string" ? c : c.content)),
        embeddings: doc.embeddings.map((e) => Float32Array.from(e)),
      }
      return kv.set(DOC_PREFIX + doc.id, stored)
    })
  }

  deleteDocument(id: string): Promise<void> {
    return this.safely("deleting a document", undefined, (kv) => kv.delete(DOC_PREFIX + id))
  }

  /** Every persisted document, oldest upload first. */
  loadDocuments(): Promise<Document[]> {
    return this.safely("loading documents", [] as Document[], async (kv) => {
      const keys = (await kv.keys()).filter((k) => k.startsWith(DOC_PREFIX))
      const stored = await Promise.all(keys.map((k) => kv.get<StoredDocument>(k)))
      return stored
        .filter((d): d is StoredDocument => !!d && Array.isArray(d.chunks))
        .map((d) => ({
          ...d,
          uploadedAt: new Date(d.uploadedAt),
          embeddings: d.embeddings.map((e) => Array.from(e)),
        }))
        .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
    })
  }

  saveMessages(messages: Message[]): Promise<void> {
    return this.safely("saving messages", undefined, (kv) => kv.set(MESSAGES_KEY, messages.slice(-MAX_PERSISTED_MESSAGES)))
  }

  loadMessages(): Promise<Message[]> {
    return this.safely("loading messages", [] as Message[], async (kv) => {
      const messages = (await kv.get<Message[]>(MESSAGES_KEY)) ?? []
      return messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
    })
  }

  /** Forget everything (new session). */
  clear(): Promise<void> {
    return this.safely("clearing", undefined, async (kv) => {
      await Promise.all((await kv.keys()).map((k) => kv.delete(k)))
    })
  }
}

/**
 * Browser-compatible vector database client
 * Uses API routes to communicate with the server-side vector database
 */

import type { SearchOptions, SearchResult, VectorDBConfig, VectorDocument } from '@/lib/vector-database-types';

// Using the same config type as the server-side implementation
export type VectorDBClientConfig = VectorDBConfig;

/** A hit mapped back to the chunk it came from. */
export interface VectorChunkHit {
  documentId: string;
  chunkIndex: number;
  score: number;
}

/**
 * Client-side vector database implementation that uses API routes
 * to communicate with the server-side vector database.
 *
 * For the "local" provider the in-browser RAG index (persisted in IndexedDB)
 * *is* the vector store, so every operation is a no-op here: mirroring it into
 * a server process's memory only duplicated the data, and that copy was
 * dropped after five idle minutes anyway.
 */
export class VectorDatabaseClient {
  private config: VectorDBClientConfig;
  private isInitialized = false;

  constructor(config: VectorDBClientConfig) {
    this.config = config;
  }

  /** True when a remote store (Pinecone/Weaviate) backs this client. */
  get isRemote(): boolean {
    return this.config.provider !== "local";
  }

  async initialize(): Promise<void> {
    if (!this.isRemote) {
      this.isInitialized = true;
      return;
    }
    await this.callAPI("initialize", {});
    this.isInitialized = true;
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isRemote || documents.length === 0) return;
    if (!this.isInitialized) await this.initialize();
    await this.callAPI("addDocuments", { documents });
  }

  async search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isRemote) return [];
    if (!this.isInitialized) await this.initialize();
    const response = await this.callAPI<{ results?: SearchResult[] }>("search", { query, embedding, options });
    return Array.isArray(response.results) ? response.results : [];
  }

  /**
   * Dense nearest-neighbour search returning (documentId, chunkIndex) pairs,
   * the shape RAGEngine merges into its candidate set.
   */
  async searchChunks(embedding: number[], limit: number, documentIds?: string[]): Promise<VectorChunkHit[]> {
    const results = await this.search("", embedding, { mode: "semantic", limit, documentIds });
    const hits: VectorChunkHit[] = [];
    for (const result of results) {
      const metadata = (typeof result.metadata === "object" && result.metadata !== null ? result.metadata : {}) as Record<string, unknown>;
      const documentId = metadata.documentId;
      const chunkIndex = Number(metadata.chunkIndex);
      if (typeof documentId === "string" && Number.isInteger(chunkIndex)) {
        hits.push({ documentId, chunkIndex, score: result.score });
      }
    }
    return hits;
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isRemote) return;
    if (!this.isInitialized) await this.initialize();
    await this.callAPI("deleteDocument", { documentId });
  }

  async clear(): Promise<void> {
    if (!this.isRemote) return;
    if (!this.isInitialized) await this.initialize();
    await this.callAPI("clear", {});
  }

  async testConnection(): Promise<boolean> {
    if (!this.isRemote) return true;
    try {
      const response = await this.callAPI<{ connected?: boolean }>("testConnection", {});
      return response.connected === true;
    } catch (error) {
      console.error("Vector database connection test failed:", error);
      return false;
    }
  }

  private async callAPI<T = Record<string, unknown>>(action: string, data: unknown): Promise<T> {
    const response = await fetch("/api/vector-db", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        config: this.config,
        data,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

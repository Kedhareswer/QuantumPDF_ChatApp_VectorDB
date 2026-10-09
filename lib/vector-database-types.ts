/**
 * Shared types for vector database client and server
 */

export interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "local";
  apiKey?: string;
  environment?: string;
  indexName?: string;
  url?: string;
  collection?: string;
  dimension?: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    chunkIndex: number;
    documentId: string;
    timestamp: Date;
    [key: string]: unknown;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: unknown;
}

export interface SearchOptions {
  mode: "semantic" | "keyword" | "hybrid";
  /** Restrict results to these document ids (translated to each backend's filter syntax). */
  documentIds?: string[];
  /** Raw backend-specific filter (Pinecone metadata filter / Weaviate where). Prefer documentIds. */
  filters?: Record<string, unknown>;
  limit?: number;
  threshold?: number;
}

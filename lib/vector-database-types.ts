/**
 * Shared types for vector database client and server
 */

export interface VectorDBConfig {
  provider: "pinecone" | "weaviate" | "chroma" | "local";
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
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: any;
}

export interface SearchOptions {
  mode: "semantic" | "keyword" | "hybrid";
  filters?: Record<string, any>;
  limit?: number;
  threshold?: number;
}

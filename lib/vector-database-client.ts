/**
 * Browser-compatible vector database client
 * Uses API routes to communicate with the server-side vector database
 */

import type { SearchResult, VectorDBConfig, VectorDocument, SearchOptions } from '@/lib/vector-database-types';

// Using the same config type as the server-side implementation
export type VectorDBClientConfig = VectorDBConfig;

// Using imported VectorDocument type

// Using imported SearchOptions type

/**
 * Client-side vector database implementation that uses API routes
 * to communicate with the server-side vector database
 */
export class VectorDatabaseClient {
  private config: VectorDBClientConfig;
  private isInitialized = false;

  constructor(config: VectorDBClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      await this.callAPI("initialize", {});
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize vector database:", error);
      throw error;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.callAPI("addDocuments", { documents });
    } catch (error) {
      console.error("Failed to add documents to vector database:", error);
      throw error;
    }
  }

  async search(query: string, embedding: number[], options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.callAPI("search", { query, embedding, options });
      return response.results;
    } catch (error) {
      console.error("Failed to search vector database:", error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.callAPI("deleteDocument", { documentId });
    } catch (error) {
      console.error("Failed to delete document from vector database:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.callAPI("clear", {});
    } catch (error) {
      console.error("Failed to clear vector database:", error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI("testConnection", {});
      return response.connected;
    } catch (error) {
      console.error("Vector database connection test failed:", error);
      return false;
    }
  }

  private async callAPI(action: string, data: any): Promise<any> {
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
      const errorData = await response.json();
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return await response.json();
  }
}

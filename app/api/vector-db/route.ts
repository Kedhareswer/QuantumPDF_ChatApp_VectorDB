import { NextRequest, NextResponse } from "next/server";
import { createVectorDatabase, VectorDatabase } from "@/lib/vector-database";

// This file handles server-side vector database operations

// Cache for vector database instances to avoid recreation per request
// Key: hash of config, Value: { instance, lastUsed }
const vectorDBCache = new Map<string, { instance: VectorDatabase; lastUsed: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Generate a hash key from config for caching
 */
function getConfigHash(config: any): string {
  const key = JSON.stringify({
    provider: config.provider,
    apiKey: config.apiKey?.slice(-8) || '', // Only use last 8 chars of API key for privacy
    environment: config.environment,
    indexName: config.indexName,
    url: config.url,
    collection: config.collection,
    dimension: config.dimension,
  });
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `vdb_${config.provider}_${Math.abs(hash).toString(16)}`;
}

/**
 * Get or create vector database instance with caching
 */
async function getVectorDB(config: any): Promise<VectorDatabase> {
  const cacheKey = getConfigHash(config);
  const now = Date.now();
  
  // Check cache
  const cached = vectorDBCache.get(cacheKey);
  if (cached && (now - cached.lastUsed) < CACHE_TTL_MS) {
    cached.lastUsed = now;
    return cached.instance;
  }
  
  // Clean up expired entries periodically
  if (vectorDBCache.size > 10) {
    for (const [key, value] of vectorDBCache.entries()) {
      if ((now - value.lastUsed) > CACHE_TTL_MS) {
        vectorDBCache.delete(key);
      }
    }
  }
  
  // Create new instance
  const vectorDB = createVectorDatabase(config);
  await vectorDB.initialize();
  
  // Cache it
  vectorDBCache.set(cacheKey, { instance: vectorDB, lastUsed: now });
  
  return vectorDB;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, data } = body;
    
    // Get cached or create new vector database instance
    const vectorDB = await getVectorDB(config);
    
    let result;
    
    switch (action) {
      case "initialize":
        await vectorDB.initialize();
        result = { success: true };
        break;
        
      case "addDocuments":
        await vectorDB.addDocuments(data.documents);
        result = { success: true };
        break;
        
      case "search":
        const searchResults = await vectorDB.search(
          data.query, 
          data.embedding, 
          data.options
        );
        result = { success: true, results: searchResults };
        break;
        
      case "deleteDocument":
        await vectorDB.deleteDocument(data.documentId);
        result = { success: true };
        break;
        
      case "clear":
        await vectorDB.clear();
        result = { success: true };
        break;
        
      case "testConnection":
        const isConnected = await vectorDB.testConnection();
        result = { success: true, connected: isConnected };
        break;
        
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Vector DB API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

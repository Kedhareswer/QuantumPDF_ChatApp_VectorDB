import { NextRequest, NextResponse } from "next/server";
import { createVectorDatabase } from "@/lib/vector-database";

// This file handles server-side vector database operations

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, data } = body;
    
    // Create vector database instance
    const vectorDB = createVectorDatabase(config);
    await vectorDB.initialize();
    
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

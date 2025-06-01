import { type NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

export async function POST(request: NextRequest) {
  let embeddingModel: string = "sentence-transformers/all-MiniLM-L6-v2"; // Default model
  let clientToken: string | undefined;

  try {
    const body = await request.json();
    const { text, model, apiKey: userApiKey } = body; // Extract userApiKey from body

    // Determine the API key to use
    if (userApiKey && typeof userApiKey === 'string' && userApiKey.trim() !== '') {
      clientToken = userApiKey;
      console.log("Using Hugging Face API Key provided in request.");
    } else if (process.env.HUGGINGFACE_API_KEY) {
      clientToken = process.env.HUGGINGFACE_API_KEY;
      console.log("Using Hugging Face API Key from server environment.");
    } else {
      console.error("HUGGINGFACE_API_KEY not configured on server and not provided in request.");
      return NextResponse.json(
        { error: "Hugging Face API Key not configured on server and not provided in request." },
        { status: 500 }
      );
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Invalid text input" }, { status: 400 });
    }

    const client = new InferenceClient(clientToken); // Use the determined token
    embeddingModel = model || "sentence-transformers/all-MiniLM-L6-v2";

    console.log(`Generating embedding with model: ${embeddingModel}`);

    const response = await client.featureExtraction({
      model: embeddingModel,
      inputs: text.trim(),
    });

    let embedding: number[] = [];

    if (Array.isArray(response)) {
      if (typeof response[0] === 'number') {
        embedding = response as number[];
      } else if (Array.isArray(response[0]) && typeof response[0][0] === 'number') {
        embedding = response[0] as number[];
      } else {
        throw new Error("Unexpected embedding response format: array contains non-numeric elements or invalid structure");
      }
    } else if (typeof response === 'object' && response !== null && 'embedding' in response && Array.isArray((response as any).embedding)) {
      embedding = (response as any).embedding as number[];
    } else {
      throw new Error("Unexpected embedding response format: not an array or a known object structure");
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Generated embedding is empty or invalid");
    }
    if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
      throw new Error("Generated embedding contains invalid values");
    }

    console.log(`Successfully generated embedding with dimension: ${embedding.length}`);

    return NextResponse.json({
      success: true,
      embedding: embedding,
      model: embeddingModel,
      dimension: embedding.length,
    });

  } catch (error) {
    console.error(`Hugging Face embedding API error for model ${embeddingModel || 'Unknown Model'}:`, error);
    let errorMessage = "Failed to generate embedding";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

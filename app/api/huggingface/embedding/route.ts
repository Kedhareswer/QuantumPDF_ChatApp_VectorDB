import { type NextRequest, NextResponse } from "next/server"
import { InferenceClient } from "@huggingface/inference"

export async function POST(request: NextRequest) {
  let embeddingModel: string = "sentence-transformers/all-MiniLM-L6-v2"; // Default model
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY
    console.log("Hugging Face API Key found:", apiKey ? "Yes" : "No");

    if (!apiKey) {
      return NextResponse.json({ error: "HUGGINGFACE_API_KEY not configured on server" }, { status: 500 })
    }

    const body = await request.json()
    const { text, model } = body

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Invalid text input" }, { status: 400 })
    }

    const client = new InferenceClient(apiKey)
    embeddingModel = model || "sentence-transformers/all-MiniLM-L6-v2" // Assign specific model

    console.log(`Generating embedding with model: ${embeddingModel}`)

    const response = await client.featureExtraction({
      model: embeddingModel,
      inputs: text.trim(),
    })

    // Handle different response formats
    let embedding: number[] = []

    if (Array.isArray(response)) {
      // Check if response is like [0.1, 0.2, ...]
      if (typeof response[0] === 'number') {
        embedding = response as number[]
      }
      // Check if response is like [[0.1, 0.2, ...]]
      else if (Array.isArray(response[0]) && typeof response[0][0] === 'number') {
        embedding = response[0] as number[]
      } else {
        // Unexpected structure within the array
        throw new Error("Unexpected embedding response format: array contains non-numeric elements or invalid structure")
      }
    } else if (typeof response === 'object' && response !== null && 'embedding' in response && Array.isArray((response as any).embedding)) {
      // Response is like { embedding: [0.1, 0.2, ...] } - a hypothetical case for some APIs
      embedding = (response as any).embedding as number[]
    }
    else {
      throw new Error("Unexpected embedding response format: not an array or a known object structure")
    }

    // Validate embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Generated embedding is empty or invalid")
    }

    // Check if all values are numbers
    if (!embedding.every((val) => typeof val === "number" && !isNaN(val))) {
      throw new Error("Generated embedding contains invalid values")
    }

    console.log(`Successfully generated embedding with dimension: ${embedding.length}`)

    return NextResponse.json({
      success: true,
      embedding: embedding,
      model: embeddingModel,
      dimension: embedding.length,
    })
  } catch (error) {
    console.error(`Hugging Face embedding API error for model ${embeddingModel || 'Unknown Model'}:`, error)

    let errorMessage = "Failed to generate embedding"
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

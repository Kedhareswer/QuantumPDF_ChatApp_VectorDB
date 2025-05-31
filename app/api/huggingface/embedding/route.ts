import { type NextRequest, NextResponse } from "next/server"
import { HfInference } from "@huggingface/inference"

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

    const hf = new HfInference(apiKey)
    embeddingModel = model || "sentence-transformers/all-MiniLM-L6-v2" // Assign specific model

    console.log(`Generating embedding with model: ${embeddingModel}`)

    const response = await hf.featureExtraction({
      model: embeddingModel,
      inputs: text.trim(),
    })

    // Handle different response formats
    let embedding: number[] = []

    if (Array.isArray(response)) {
      if (Array.isArray(response[0])) {
        embedding = response[0] as number[]
      } else {
        embedding = response as number[]
      }
    } else {
      throw new Error("Unexpected embedding response format")
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

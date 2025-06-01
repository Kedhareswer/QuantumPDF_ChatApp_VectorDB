import { type NextRequest, NextResponse } from "next/server"
import { InferenceClient } from "@huggingface/inference"

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "HUGGINGFACE_API_KEY not configured" }, { status: 500 })
    }

    const client = new InferenceClient(apiKey)

    // Test with a simple embedding request
    const response = await client.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: "test connection",
    })

    return NextResponse.json({
      success: true,
      message: "Hugging Face API connected successfully",
      modelTested: "sentence-transformers/all-MiniLM-L6-v2",
    })
  } catch (error) {
    console.error("Hugging Face API test failed:", error)
    return NextResponse.json(
      {
        error: "Failed to connect to Hugging Face API",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

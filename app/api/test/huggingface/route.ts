import { InferenceClient } from "@huggingface/inference"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "HUGGINGFACE_API_KEY not configured" }, { status: 500 })
    }

    void InferenceClient

    // Test with a simple embedding request using a reliable model

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

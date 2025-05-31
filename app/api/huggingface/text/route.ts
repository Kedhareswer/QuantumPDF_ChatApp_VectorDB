import { type NextRequest, NextResponse } from "next/server"
import { HfInference } from "@huggingface/inference"

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "HUGGINGFACE_API_KEY not configured on server" }, { status: 500 })
    }

    const body = await request.json()
    const { prompt, context, model } = body

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Invalid prompt input" }, { status: 400 })
    }

    const hf = new HfInference(apiKey)
    const textModel = model || "HuggingFaceH4/zephyr-7b-beta"

    const fullPrompt = context
      ? `Context: ${context}\n\nQuestion: ${prompt}\n\nAnswer:`
      : `Question: ${prompt}\n\nAnswer:`

    console.log(`Generating text with model: ${textModel}`)

    const response = await hf.textGeneration({
      model: textModel,
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      },
    })

    const generatedText = response.generated_text?.trim()

    if (!generatedText || generatedText.length === 0) {
      throw new Error("Generated text is empty")
    }

    console.log(`Successfully generated text response`)

    return NextResponse.json({
      success: true,
      text: generatedText,
      model: textModel,
    })
  } catch (error) {
    console.error("Hugging Face text generation API error:", error)

    let errorMessage = "Failed to generate text"
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

import { NextResponse } from "next/server"
import { vectorStore } from "@/lib/vector-store"
import { generateResponse, type GeminiMessage } from "@/lib/gemini-api"

export async function POST(req: Request) {
  try {
    const { pdfId, type = "executive" } = await req.json()

    // Get the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    // Get all chunks for the specified PDF
    const pdfDocs = vectorStore.getDocumentsForPdf(pdfId)

    if (pdfDocs.length === 0) {
      return NextResponse.json({ error: "No content found for this PDF" }, { status: 404 })
    }

    // Combine all chunks into a single text
    // Sort by chunk index to maintain document order
    const sortedDocs = pdfDocs.sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex)
    const fullText = sortedDocs.map((doc) => doc.text).join(" ")

    // Prepare the prompt based on the summary type
    let prompt = ""

    switch (type) {
      case "executive":
        prompt = `Create an executive summary of the following document. Focus on key points, findings, and recommendations:`
        break
      case "bullets":
        prompt = `Create a bullet-point summary of the following document. List the most important points:`
        break
      case "tldr":
        prompt = `Create a TL;DR (Too Long; Didn't Read) summary of the following document. Be concise but comprehensive:`
        break
      default:
        prompt = `Summarize the following document:`
    }

    // Prepare messages for the Gemini API
    const messages: GeminiMessage[] = [
      {
        role: "user",
        parts: [
          {
            text: `${prompt}
            
            Document content:
            ${fullText}`,
          },
        ],
      },
    ]

    try {
      // Try to generate response using Gemini API
      const summary = await generateResponse(messages, apiKey)
      return NextResponse.json({ summary })
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError)

      // Create a simple fallback summary
      let fallbackSummary = ""

      // Extract the first few sentences from each chunk as a simple summary
      const sentences = fullText
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 0)
        .slice(0, 5)

      if (type === "bullets") {
        fallbackSummary = `Key points from the document (AI service unavailable - simplified summary):

${sentences.map((s) => `• ${s.trim()}`).join("\n")}

Note: This is a simplified summary as the AI service is currently unavailable.`
      } else {
        fallbackSummary = `Document Summary (AI service unavailable - simplified summary):

${sentences.map((s) => s.trim()).join(". ")}

Note: This is a simplified summary as the AI service is currently unavailable.`
      }

      // Return the fallback summary with a note about the API error
      return NextResponse.json({
        summary: fallbackSummary,
        error: `AI service unavailable: ${geminiError.message}`,
        usingFallback: true,
      })
    }
  } catch (error) {
    console.error("Error in summary route:", error)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import pdf from "pdf-parse"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("pdf") as File

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Use pdf-parse to extract text
    const data = await pdf(buffer)
    const extractedText = data.text

    // Create simple chunks
    const chunks = chunkText(extractedText)

    return NextResponse.json({
      success: true,
      text: extractedText,
      chunks,
      metadata: {
        title: file.name,
        pages: data.numpages,
        author: data.info.Author || "N/A",
        subject: data.info.Subject || "N/A",
        processingMethod: "Server",
        originalSize: file.size,
      },
    })
  } catch (error) {
    console.error("Server-side PDF extraction error:", error)
    return NextResponse.json(
      {
        error: "Server processing failed. Please try client-side processing or manual text input.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text || text.trim().length === 0) {
    return ["No content available"]
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const potentialChunk = currentChunk + (currentChunk ? ". " : "") + trimmedSentence

    if (potentialChunk.length <= chunkSize) {
      currentChunk = potentialChunk
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + ".")
      }
      currentChunk = trimmedSentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + ".")
  }

  return chunks.filter((chunk) => chunk.trim().length > 0)
}

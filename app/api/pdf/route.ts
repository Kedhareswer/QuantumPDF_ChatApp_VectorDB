import { NextResponse } from "next/server"
import { extractTextFromPdf, chunkText } from "@/lib/pdf-utils"
import { vectorStore } from "@/lib/vector-store"
import { generateId } from "@/lib/utils"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check if the file is a PDF
    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // Check file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds the 5MB limit (${Math.round(file.size / (1024 * 1024))}MB)`,
        },
        { status: 400 },
      )
    }

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text from the PDF with better error handling
    const text = await extractTextFromPdf(buffer)

    // If no text was extracted, return an error
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 })
    }

    // Generate a unique ID for the PDF
    const pdfId = generateId()

    // Chunk the text
    const chunks = chunkText(text, 500)

    // Prepare documents for vector store
    const documents = chunks.map((chunk, i) => ({
      id: `${pdfId}-chunk-${i}`,
      text: chunk,
      metadata: {
        pdfName: file.name,
        pdfId: pdfId,
        chunkIndex: i,
      },
    }))

    // Add documents to the vector store
    await vectorStore.addDocuments(documents)

    // Return success response with all required fields
    return NextResponse.json({
      success: true,
      id: pdfId,
      name: file.name,
      size: file.size,
      chunkCount: chunks.length
    })

  } catch (error: any) {
    console.error("Error processing PDF:", error)

    // Determine the error message
    let errorMessage = "An unexpected error occurred while processing the PDF."
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    // Return a JSON error response
    return NextResponse.json(
      { error: `Failed to process PDF: ${errorMessage}` },
      { status: 500 }, // Internal Server Error
    )
  }
}

import { NextResponse } from "next/server"
import { vectorStore } from "@/lib/vector-store"
import { generateResponse, generateLocalResponse, type GeminiMessage } from "@/lib/gemini-api"

interface Document {
  id: string
  text: string
  metadata: {
    pdfId: string
    pdfName: string
  }
}

export async function POST(req: Request) {
  try {
    const { query, pdfId, history } = await req.json()

    // Get the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
    }

    // Find relevant chunks based on the query
    let relevantDocs: Document[] = []

    if (pdfId === "all") {
      // Search across all documents
      relevantDocs = await vectorStore.findSimilar(query, 5)
    } else {
      // Search only in the specified PDF
      const pdfDocs = vectorStore.getDocumentsForPdf(pdfId)

      // If there are no documents for this PDF, allow the AI to respond with an empty context
      if (pdfDocs.length === 0) {
        // We'll let the AI handle greetings or general questions, even if the PDF is empty
        relevantDocs = []
      } else {
        // Find the most relevant chunks within this PDF
        const queryEmbedding = await vectorStore.findSimilar(query, 3)
        relevantDocs = queryEmbedding.filter((doc) => doc.metadata.pdfId === pdfId)
      }
    }

    // Prepare context from relevant documents
    const context = relevantDocs
      .map((doc) => {
        return `Content from "${doc.metadata.pdfName}":\n${doc.text}\n`
      })
      .join("\n---\n")

    // Prepare messages for the Gemini API
    const messages: GeminiMessage[] = [
      {
        role: "user",
        parts: [
          {
            text: `You are a helpful AI assistant that can help with both PDF content and general questions. 
            
            If the user's query is about the PDF content:
            - First check if the information is available in the provided context
            - If not found, suggest relevant external resources (websites, books, YouTube videos)
            - Never say "I don't know" or "Information not found"
            
            If the user greets you (like "Hi" or similar):
            - Respond with a friendly greeting
            - Offer to help with the PDF
            - Ask what they'd like to know about the document
            
            If the user asks about the PDF content:
            - Summarize the main topics
            - Point out key sections
            - Suggest specific pages to read
            
            Always try to be helpful and provide value, even if the exact information isn't in the PDF
            
            Context from PDF documents:
            ${context}
            
            User query: ${query}`,
          },
        ],
      },
    ]

    try {
      // Try to generate response using Gemini API
      const response = await generateResponse(messages, apiKey)

      // Return the response
      return NextResponse.json({
        response,
        sources: relevantDocs.map((doc) => ({
          pdfName: doc.metadata.pdfName,
          pdfId: doc.metadata.pdfId,
          snippet: doc.text.substring(0, 150) + "...",
        })),
      })
    } catch (geminiError: unknown) {
      // Enhanced error handling for Gemini API failures
      let errorMessage = "I'm having a bit of trouble with the AI service right now."
      if (geminiError instanceof Error && geminiError.message) {
        errorMessage += " " + geminiError.message
      }
      console.error("Gemini API error (will show user fallback):", errorMessage)

      // Only use fallback if Gemini is truly unavailable
      return NextResponse.json({
        response: "Sorry, I couldn't process your request at the moment. Please try again later or check your API key.",
        error: errorMessage,
        debug: geminiError,
        sources: [],
        usingFallback: true,
      })
    }
  } catch (error) {
    console.error("Error in chat route:", error)
    return NextResponse.json({ error: "Failed to process your request" }, { status: 500 })
  }
}

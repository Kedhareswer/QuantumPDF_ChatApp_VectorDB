import { type NextRequest, NextResponse } from "next/server"
import { extractPdf } from "@/lib/liteparse-client"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const formData = await request.formData()
    // Accept "file" (new) or "pdf" (legacy) field names.
    const file = formData.get("file") ?? formData.get("pdf")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No PDF file provided" }, { status: 400 })
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      return NextResponse.json({ success: false, error: "File must be a PDF" }, { status: 400 })
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File size exceeds 100MB limit" }, { status: 400 })
    }

    const enableOCR = formData.get("enableOCR") === "true"
    const bytes = new Uint8Array(await file.arrayBuffer())

    const extraction = await extractPdf(bytes, {
      enableOCR,
      fileName: file.name,
      capturePreviews: true,
    })

    if (!extraction.text) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No extractable text found. The PDF may be scanned or image-based — enable OCR and try again.",
          metadata: {
            pages: extraction.pages,
            processingMethod: extraction.processingMethod,
            processingTime: Date.now() - startTime,
            warnings: extraction.warnings,
          },
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      text: extraction.text,
      chunks: extraction.chunks,
      advancedChunks: extraction.advancedChunks,
      metadata: {
        pages: extraction.pages,
        successfulPages: extraction.pages,
        failedPages: 0,
        processingMethod: extraction.processingMethod,
        extractionQuality: extraction.extractionQuality,
        ocrUsed: extraction.ocrUsed,
        confidence: extraction.processingMethod === "liteparse" ? 95 : 70,
        warnings: extraction.warnings,
        fileSize: file.size,
        processingTime: Date.now() - startTime,
        previews: extraction.previews,
      },
    })
  } catch (error) {
    logger.error("PDF extract route error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Server processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

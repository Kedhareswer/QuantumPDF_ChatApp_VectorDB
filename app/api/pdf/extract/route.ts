import { type NextRequest, NextResponse } from "next/server"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

export const runtime = "nodejs"

function normalizePageText(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let pageText = ""
  for (const item of items) {
    const fragment = typeof item.str === "string" ? item.str : ""
    if (!fragment) continue
    pageText += fragment
    pageText += item.hasEOL ? "\n" : " "
  }
  return pageText.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim()
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const formData = await request.formData()
    const file = formData.get("pdf")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No PDF file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ success: false, error: "File must be a PDF" }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File size exceeds 50MB limit" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    const loadingTask = getDocument({
      data: uint8Array,
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
      verbosity: 0,
    })
    const pdf = await loadingTask.promise

    const pageTexts: string[] = []
    let failedPages = 0
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const normalized = normalizePageText(textContent.items as Array<{ str?: string; hasEOL?: boolean }>)
        if (normalized) {
          pageTexts.push(normalized)
        }
      } catch (pageError) {
        failedPages++
        console.warn(`Failed to extract page ${pageNum}:`, pageError)
      }
    }

    const extractedText = pageTexts.join("\n\n").trim()

    let info: Record<string, unknown> = {}
    let metadataRaw: unknown
    try {
      const metadata = await pdf.getMetadata()
      info = (metadata.info as Record<string, unknown>) || {}
      metadataRaw = metadata.metadata
    } catch {
      // Metadata extraction is optional
    }

    await pdf.destroy()

    if (!extractedText) {
      return NextResponse.json(
        {
          success: false,
          error: "No extractable text found. The PDF may be scanned/image-based.",
          metadata: {
            title: String(info.Title || file.name),
            author: String(info.Author || ""),
            subject: String(info.Subject || ""),
            creator: String(info.Creator || ""),
            producer: String(info.Producer || ""),
            pages: pdf.numPages,
            fileSize: file.size,
            processingMethod: "pdfjs-dist-server",
            extractionQuality: "none",
            successfulPages: Math.max(0, pdf.numPages - failedPages),
            failedPages,
            hasMetadata: !!metadataRaw,
          },
          processingTime: Date.now() - startTime,
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      metadata: {
        title: String(info.Title || file.name),
        author: String(info.Author || ""),
        subject: String(info.Subject || ""),
        creator: String(info.Creator || ""),
        producer: String(info.Producer || ""),
        creationDate: typeof info.CreationDate === "string" ? info.CreationDate : undefined,
        modificationDate: typeof info.ModDate === "string" ? info.ModDate : undefined,
        pages: pdf.numPages,
        fileSize: file.size,
        processingMethod: "pdfjs-dist-server",
        extractionQuality: extractedText.length > 500 ? "high" : "medium",
        successfulPages: Math.max(0, pdf.numPages - failedPages),
        failedPages,
        hasMetadata: !!metadataRaw,
      },
      processingTime: Date.now() - startTime,
    })
  } catch (error) {
    console.error("Server PDF processing error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Server processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

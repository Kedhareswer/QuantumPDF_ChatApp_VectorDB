import { type NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";
import Tesseract from "tesseract.js";
import { PDF2Pic } from "pdf2pic";
import fs from "fs/promises";
import path from "path";

const MIN_TEXT_LENGTH_FOR_OCR_FALLBACK = 100; // Characters
const TEMP_IMAGE_DIR = "/tmp/pdf_images";

// Ensure temporary directory exists
async function ensureTempDirExists() {
  try {
    await fs.mkdir(TEMP_IMAGE_DIR, { recursive: true });
  } catch (error) {
    console.error(`Failed to create temporary directory ${TEMP_IMAGE_DIR}:`, error);
    // Depending on policy, you might want to throw this error
    // if the directory is critical for operation.
  }
}
// Call it once at startup, or ensure it's checked/created per request if stateless.
// For Next.js serverless functions, it's better to do it per request or ensure the build process handles it.
// However, for simplicity in this context, we'll call it before processing.

export async function POST(request: NextRequest) {
  await ensureTempDirExists(); // Ensure temp dir is ready
  let ocrPerformed = false;
  let finalExtractedText = "";
  let finalMetadata: any = {};

  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only PDF is allowed." },
        { status: 400 }
      );
    }

    // Optional: Add file size check if needed
    if (file.size > 10 * 1024 * 1024) { // Example: 10MB limit
      return NextResponse.json(
        { success: false, error: "File size exceeds 10MB limit." },
        { status: 400 }
      );
    }

    console.log("Processing PDF:", file.name);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes); // Original buffer for pdf-parse and pdf2pic

    const data = await pdf(buffer);
    finalExtractedText = data.text;

    finalMetadata = {
      title: data.info?.Title || file.name,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator,
      producer: data.info?.Producer,
      creationDate: data.info?.CreationDate,
      modificationDate: data.info?.ModDate,
      pages: data.numpages,
      ocrPerformed: false,
    };

    // Check if OCR fallback is needed
    if (
      data.numpages > 0 &&
      (!finalExtractedText || finalExtractedText.trim().length < MIN_TEXT_LENGTH_FOR_OCR_FALLBACK)
    ) {
      console.log(`Initial text length ${finalExtractedText.trim().length}, initiating OCR for ${file.name}`);
      ocrPerformed = true;
      finalMetadata.ocrPerformed = true;
      finalMetadata.ocrEngine = "tesseract.js";
      let ocrTextAccumulated = "";
      const imagePaths: string[] = [];

      const pdf2picInstance = new PDF2Pic({
        density: 300,
        format: "png",
        savedir: TEMP_IMAGE_DIR,
        savename: `page_${path.parse(file.name).name}_${Date.now()}`, // Use path.parse for cleaner name
      });

      let worker: Tesseract.Worker | null = null;

      try {
        console.log("Converting PDF to images...");
        // pdf2pic can be tricky with buffers directly for bulk. Save to temp file first if issues arise.
        // For now, let's try with the buffer directly.
        const conversionOutput = await pdf2picInstance.convertBulk(buffer, -1);
        // convertBulk output: [{ page: 1, name: 'xx.1.png', path: '/path/to/xx.1.png', size: '123kb', height: YY, width: XX }, ...]

        if (!conversionOutput || conversionOutput.length === 0) {
          throw new Error("PDF to image conversion yielded no images.");
        }

        conversionOutput.forEach(img => imagePaths.push(img.path));
        console.log(`Converted ${imagePaths.length} pages to images.`);

        console.log("Initializing Tesseract worker...");
        worker = await Tesseract.createWorker('eng', 1, {
          // logger: m => console.log(m), // Optional: for detailed Tesseract logs
          cachePath: path.join(TEMP_IMAGE_DIR, 'tesseract_cache'), // Cache for language data
        });
        await fs.mkdir(path.join(TEMP_IMAGE_DIR, 'tesseract_cache'), { recursive: true });


        console.log("Performing OCR on images...");
        for (const imagePath of imagePaths) {
          if (!await fs.stat(imagePath).then(() => true).catch(() => false)) {
            console.warn(`Image file not found, skipping OCR: ${imagePath}`);
            continue;
          }
          const { data: { text: ocrTextPage } } = await worker.recognize(imagePath);
          ocrTextAccumulated += ocrTextPage + "\n";
        }
        await worker.terminate();
        worker = null; // Mark as terminated
        console.log("OCR complete.");

        if (ocrTextAccumulated.trim().length > finalExtractedText.trim().length) {
          console.log("OCR text is more substantial, using OCR text.");
          finalExtractedText = ocrTextAccumulated.trim();
        } else {
          console.log("pdf-parse text is more substantial or OCR yielded less, keeping pdf-parse text.");
          finalMetadata.ocrNote = "OCR performed but pdf-parse text was more substantial or OCR yielded less.";
        }
      } catch (ocrError) {
        console.error("Error during OCR processing:", ocrError);
        finalMetadata.ocrError = ocrError instanceof Error ? ocrError.message : "Unknown OCR error";
        if (worker) {
          await worker.terminate(); // Ensure worker is terminated on error
        }
        // Fallback to pdf-parse text if OCR fails critically
      } finally {
        // Cleanup temporary image files
        console.log("Cleaning up temporary image files...");
        for (const imagePath of imagePaths) {
          try {
            if (await fs.stat(imagePath).then(() => true).catch(() => false)) {
               await fs.unlink(imagePath);
            }
          } catch (cleanupError) {
            console.warn(`Failed to delete temporary image ${imagePath}:`, cleanupError);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      text: finalExtractedText,
      metadata: finalMetadata,
    });

  } catch (error) {
    console.error("Error processing PDF (main):", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to process PDF: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// The chunkText function can be removed or commented out if not needed for this endpoint.
/*
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
*/

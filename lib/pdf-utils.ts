import pdf from 'pdf-parse';

// Since pdf-parse might be causing issues, let's implement a simpler approach
// that doesn't rely on external PDF parsing libraries

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use pdf-parse to extract text from the PDF buffer
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error: any) { // Specify 'any' or a more specific error type if known
    console.error("Error extracting text from PDF:", error)
    // Ensure error.message is accessed safely
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`)
  }
}

// Function to chunk text into smaller pieces
export function chunkText(text: string, maxChunkSize = 500): string[] {
  // Remove excessive whitespace
  const cleanedText = text.replace(/\s+/g, " ").trim()

  // If text is empty after cleaning, return an empty array
  if (!cleanedText) {
    return []
  }

  // If text is shorter than max chunk size, return it as a single chunk
  if (cleanedText.length <= maxChunkSize) {
    return [cleanedText]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < cleanedText.length) {
    // Find a good breaking point (end of sentence) within the chunk size
    let endIndex = Math.min(startIndex + maxChunkSize, cleanedText.length)

    // Try to find the end of a sentence (., !, ?) within the last 100 characters of the chunk
    const searchStartIndex = Math.max(endIndex - 100, startIndex)
    const searchText = cleanedText.substring(searchStartIndex, endIndex)

    const lastSentenceEnd = Math.max(
      searchText.lastIndexOf("."),
      searchText.lastIndexOf("!"),
      searchText.lastIndexOf("?"),
    )

    // If we found a sentence end, adjust the endIndex
    if (lastSentenceEnd !== -1) {
      endIndex = searchStartIndex + lastSentenceEnd + 1
    }

    // Add the chunk to our array
    chunks.push(cleanedText.substring(startIndex, endIndex).trim())

    // Move to the next chunk
    startIndex = endIndex
  }

  return chunks
}

# End-to-End PDF Processing Testing Checklist

## 1. Test PDF Files Description

Before starting, prepare or source the following PDF files for testing.

1.  **`test_text_simple.pdf`**:
    *   **Description**: A 1-2 page PDF document containing clearly selectable and extractable text. No images or complex formatting.
    *   **Content Idea**: A short public domain story, an excerpt from a well-formatted article, or a simple text document saved as PDF.
    *   **Purpose**: Tests basic client-side text extraction and successful RAG ingestion.

2.  **`test_text_large.pdf`**:
    *   **Description**: A text-based PDF document, approximately 50-100 pages long.
    *   **Content Idea**: A public domain book (e.g., from Project Gutenberg, saved as PDF), a long technical manual.
    *   **Purpose**: Tests handling of larger files, chunking, and RAG performance on more extensive content.

3.  **`test_scanned_ocr.pdf`**:
    *   **Description**: A 1-2 page PDF that is purely an image of text (e.g., a scanned document). The text should be clear enough for OCR to be effective.
    *   **Content Idea**: Scan a page from a physical book or print an article and then scan it. Ensure resolution is decent (e.g., 300 DPI).
    *   **Purpose**: Tests the server-side OCR fallback mechanism (`tesseract.js` via Node.js, or the Python OCR service if integrated).

4.  **`test_corrupted.pdf`**:
    *   **Description**: A small file that is not a valid PDF structure, or a known corrupted/malformed PDF.
    *   **Content Idea**: Rename a `.txt` or `.jpg` file to `.pdf`. Alternatively, use an online tool to slightly corrupt a valid PDF.
    *   **Purpose**: Tests error handling of the application for invalid PDF files (both client-side and server-side).

5.  **`test_mixed_content.pdf`**:
    *   **Description**: A PDF (2-3 pages) containing a mix of selectable text and embedded images. The amount of selectable text should be sufficient to NOT trigger the OCR fallback.
    *   **Content Idea**: An article or report that includes diagrams, charts, or illustrative photos alongside text.
    *   **Purpose**: Tests the system's ability to prioritize `pdf-parse` text and avoid unnecessary OCR if enough text is already extracted.

6.  **`test_minimal_text_triggers_ocr.pdf`**:
    *   **Description**: A PDF (1-2 pages) that has a very small amount of actual selectable text (e.g., less than 100 characters as per current OCR trigger threshold) but also contains significant text embedded in images on the same pages.
    *   **Content Idea**: A document where perhaps only a title is selectable text, but the main body is an image.
    *   **Purpose**: Tests if the OCR fallback is correctly triggered when initial text extraction is insufficient, even if some text is present.

## 2. Setup Section

### 2.1. Running the Next.js Application
*   Clone the repository.
*   Install dependencies: `pnpm install`.
*   Run the development server: `pnpm dev`.
*   The application should be accessible at `http://localhost:3000` (or the configured port).

### 2.2. Required Environment Variables
Ensure the following environment variables are set in your `.env.local` file for the Next.js application:

*   `OPENAI_API_KEY`: Your OpenAI API key (for embeddings and chat, via `/api/openai/...` routes).
*   `ANTHROPIC_API_KEY`: (If Anthropic models are used and refactored to server-side).
*   `HUGGINGFACE_API_KEY`: (If Hugging Face models are used and refactored to server-side for inference).
*   `PYTHON_PDF_SERVICE_URL`: (If the Python FastAPI PDF extraction service is implemented and being used) e.g., `http://localhost:8000/extract/`.
*   *(Add any other provider-specific API keys or configuration variables that have been externalized).*

### 2.3. External Dependencies & Services
*   **Node.js OCR (`tesseract.js` on server):**
    *   If testing server-side OCR via the Next.js route (`/api/pdf/extract`), ensure that any system-level dependencies for `pdf2pic` (which uses `gm` or `imagemagick`) are installed on the machine running the Next.js server. This typically includes:
        *   **ImageMagick**: `sudo apt-get install imagemagick` (Debian/Ubuntu) or `brew install imagemagick` (macOS).
        *   **GraphicsMagick**: `sudo apt-get install graphicsmagick` (Debian/Ubuntu) or `brew install graphicsmagick` (macOS).
        *   `pdf2pic` might also need Ghostscript: `sudo apt-get install gsfonts ghostscript`.
    *   Tesseract language data for 'eng' should be available.
*   **Python FastAPI PDF Service:**
    *   If the Python service is part of the test scope, ensure it's running (e.g., via Docker or `uvicorn main:app --host 0.0.0.0 --port 8000` locally).
    *   The `PYTHON_PDF_SERVICE_URL` environment variable in the Next.js app must point to its location.

## 3. Manual E2E Test Scenarios

For each scenario, perform the steps and verify against the success criteria.

---

### Scenario 1: Simple Text PDF

*   **File to Upload:** `test_text_simple.pdf`
*   **Expected Processing Path:** Client-side (`RAGEngine.processDocument` using its internal `PDFParser` with `pdfjs-dist`).
*   **Steps:**
    1.  Navigate to the PDF upload UI in the application.
    2.  Select and upload `test_text_simple.pdf`.
    3.  Observe UI feedback: progress bar, processing stages ("Starting client-side processing...", "Client-side processing complete!").
    4.  Check browser console (Developer Tools > Console) for logs indicating client-side processing success. No errors related to server fallback should appear.
    5.  Check browser network tab (Developer Tools > Network) to ensure no calls were made to `/api/pdf/extract` for this file.
    6.  Verify the document appears in the Document Library. Check its metadata: `processingMethod` should indicate "client" or similar. `ocrPerformed` should be `false`.
    7.  Open the Chat Interface. Select this document (if selection is needed).
    8.  Ask 2-3 specific questions based on the content of `test_text_simple.pdf`.
    9.  Verify the RAG engine provides correct and relevant answers.
    10. Check if sources correctly point to `test_text_simple.pdf`.
*   **Success Criteria:**
    *   Document processed entirely on the client-side.
    *   Correct text extracted and indexed.
    *   RAG answers are accurate and sourced correctly.
    *   UI feedback is appropriate.

---

### Scenario 2: Large Text PDF

*   **File to Upload:** `test_text_large.pdf`
*   **Expected Processing Path:** Client-side (similar to simple text, but may take longer).
*   **Steps:**
    1.  Navigate to the PDF upload UI.
    2.  Upload `test_text_large.pdf`.
    3.  Observe UI feedback (should show sustained progress).
    4.  Check browser console for client-side processing logs.
    5.  Check browser network tab (no calls to `/api/pdf/extract`).
    6.  Verify document appears in Library with `processingMethod: "client"`, `ocrPerformed: false`.
    7.  Open Chat Interface. Ask 2-3 questions from different sections of the large PDF.
    8.  Verify RAG answers are correct.
    9.  Verify source attribution.
*   **Success Criteria:**
    *   Client-side processing handles large PDF successfully.
    *   Text is correctly extracted and chunked.
    *   RAG queries are functional and accurate for a large document.

---

### Scenario 3: Scanned PDF (OCR)

*   **File to Upload:** `test_scanned_ocr.pdf`
*   **Expected Processing Path:** Client-side fails (or extracts no text) -> Server-side fallback (`/api/pdf/extract`) -> Node.js `pdf-parse` (extracts minimal/no text) -> Node.js OCR (`tesseract.js`) triggered.
*   **Steps:**
    1.  Navigate to the PDF upload UI.
    2.  Upload `test_scanned_ocr.pdf`.
    3.  Observe UI: "Starting client-side processing..." -> "Client-side processing failed. Attempting server-side extraction..." -> "Starting server-side extraction..." -> "Server-side extraction complete. Processing text..." (or similar stages reflecting OCR).
    4.  Check browser console: Logs indicating client-side failure, then initiation of server-side fallback.
    5.  Check Next.js server console (terminal where `pnpm dev` is running): Logs indicating `/api/pdf/extract` was called. Logs showing `pdf-parse` extracted little text, then "initiating OCR". Logs from `tesseract.js` or `pdf2pic` if any.
    6.  Check browser network tab: A `POST` request to `/api/pdf/extract` should be visible. Inspect its response: `success: true`, extracted text (should be from OCR), and metadata like `ocrPerformed: true`, `ocrEngine: "tesseract.js"`.
    7.  Verify document appears in Library. Metadata should show `processingMethod: "server-fallback"` (or similar) and `ocrPerformed: true`.
    8.  Open Chat Interface. Ask 2-3 questions based on the scanned text.
    9.  Verify RAG answers are correct based on OCR'd content.
    10. Check source attribution.
*   **Success Criteria:**
    *   Client-side processing attempts and "fails" (extracts no useful text).
    *   Server-side fallback to `/api/pdf/extract` is triggered.
    *   Node.js server-side OCR (`tesseract.js`) is successfully performed.
    *   Text extracted via OCR is accurate.
    *   RAG answers are correct.
    *   Metadata correctly indicates OCR was used.

---

### Scenario 4: Corrupted PDF

*   **File to Upload:** `test_corrupted.pdf`
*   **Expected Processing Path:** Client-side fails -> Server-side fallback attempts -> Server-side fails.
*   **Steps:**
    1.  Navigate to the PDF upload UI.
    2.  Upload `test_corrupted.pdf`.
    3.  Observe UI: Should show processing attempt, then an error message (e.g., "Failed to process PDF", "Invalid PDF file").
    4.  Check browser console: Errors from client-side processing (`PDFParser`). Logs indicating server-side fallback attempt.
    5.  Check Next.js server console: `/api/pdf/extract` might be called. Errors from `pdf-parse` and potentially from `pdf2pic` or `tesseract.js` if it tries to process a corrupted file.
    6.  Check browser network tab: If `/api/pdf/extract` was called, its response should indicate failure (e.g., `success: false`, error message, status 400 or 500).
    7.  Document should NOT appear in the Document Library.
    8.  The application should remain stable.
*   **Success Criteria:**
    *   The application correctly identifies the file as invalid/corrupted.
    *   User-friendly error message is displayed.
    *   No document is added to the library.
    *   The application does not crash.

---

### Scenario 5: Mixed Content PDF (Sufficient Text)

*   **File to Upload:** `test_mixed_content.pdf`
*   **Expected Processing Path:** Client-side (if text is substantial) OR Server-side + `pdf-parse` (if client-side fails but server `pdf-parse` gets enough text). OCR should NOT run.
*   **Steps:**
    1.  Navigate to the PDF upload UI.
    2.  Upload `test_mixed_content.pdf`.
    3.  Observe UI: Should indicate successful processing, ideally client-side. If server-side, it should not mention OCR specifically if `pdf-parse` text is sufficient.
    4.  Check browser console: Logs for client-side processing. If it fell back to server, check server logs to confirm OCR was not attempted (based on text length from `pdf-parse`).
    5.  Check browser network tab: If server fallback, the response from `/api/pdf/extract` should have `ocrPerformed: false`.
    6.  Verify document in Library. Metadata should show `ocrPerformed: false`. `processingMethod` should be "client" or "server-fallback" (without OCR).
    7.  Open Chat Interface. Ask questions based on the selectable text portions.
    8.  Verify RAG answers are correct.
*   **Success Criteria:**
    *   Selectable text is extracted successfully.
    *   OCR is NOT performed.
    *   RAG works with the extracted text.
    *   Metadata `ocrPerformed` is `false`.

---

### Scenario 6: Minimal Selectable Text PDF (Triggers OCR)

*   **File to Upload:** `test_minimal_text_triggers_ocr.pdf`
*   **Expected Processing Path:** Client-side (extracts minimal text) -> Server-side fallback (`/api/pdf/extract`) -> Node.js `pdf-parse` (extracts minimal text) -> Node.js OCR (`tesseract.js`) triggered due to short text from `pdf-parse`.
*   **Steps:**
    1.  Navigate to the PDF upload UI.
    2.  Upload `test_minimal_text_triggers_ocr.pdf`.
    3.  Observe UI and console logs similar to Scenario 3 (Scanned PDF), expecting OCR to be triggered.
    4.  Check Next.js server console: Logs should show that `pdf-parse` extracted very little text (e.g., "<100 chars"), leading to the OCR process.
    5.  Check browser network tab: Response from `/api/pdf/extract` should show `ocrPerformed: true` and text from the image parts of the PDF.
    6.  Verify document in Library, metadata `ocrPerformed: true`.
    7.  Open Chat Interface. Ask questions based on the text that was likely in the image portions.
    8.  Verify RAG answers are correct.
*   **Success Criteria:**
    *   OCR fallback is correctly triggered because `pdf-parse` text is insufficient.
    *   Text from the image portions is extracted via OCR.
    *   RAG works with the OCR'd text.

---

## 4. General RAG Functionality Tests

*   **Multiple Documents Query:**
    1.  Upload `test_text_simple.pdf` and `test_scanned_ocr.pdf` (ensure both are processed successfully).
    2.  In the Chat Interface, ask a question that requires information from BOTH documents (if feasible, or a general question that might draw from either).
    3.  Alternatively, ask a question specific to `test_text_simple.pdf`, then another specific to `test_scanned_ocr.pdf` in the same session.
    4.  **Success Criteria:** RAG can access and use content from multiple indexed documents. Sources are correctly attributed.

*   **Document Removal:**
    1.  Upload `test_text_simple.pdf`. Verify it's searchable.
    2.  From the Document Library, remove/delete `test_text_simple.pdf`.
    3.  Wait for any backend processes to confirm removal (if applicable).
    4.  In the Chat Interface, ask a question that is ONLY answerable from `test_text_simple.pdf`.
    5.  **Success Criteria:** The RAG engine should indicate it cannot answer the question or provide an answer not based on the removed document. The document is no longer used as a source.

---

This checklist provides a comprehensive approach to testing the PDF processing pipeline. Adjust details based on the exact UI labels, logging messages, and metadata fields implemented.

import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data'; // npm install form-data
// Or, if using Node.js v18+ with built-in fetch that supports FormData with streams:
// import { FormData } from 'undici'; // or rely on global FormData

async function testApiExtract(filePath) {
  if (!filePath) {
    console.error('Usage: node api_extract_test.mjs <path_to_pdf_file>');
    process.exit(1);
  }

  const absoluteFilePath = path.resolve(filePath);
  const fileName = path.basename(absoluteFilePath);

  try {
    await fs.access(absoluteFilePath);
  } catch (error) {
    console.error(`Error: File not found at ${absoluteFilePath}`);
    process.exit(1);
  }

  const API_ENDPOINT = 'http://localhost:3000/api/pdf/extract';
  // const API_ENDPOINT = 'YOUR_DEPLOYED_APP_URL/api/pdf/extract'; // For deployed testing

  console.log(`Testing PDF extraction for: ${absoluteFilePath}`);
  console.log(`Targeting API endpoint: ${API_ENDPOINT}`);

  const fileBuffer = await fs.readFile(absoluteFilePath);

  // Create FormData object
  // Note: Node's built-in fetch in v18+ has better support for FormData with Blobs/Buffers.
  // For older Node versions or specific needs, 'form-data' library is more robust.
  // Let's assume Node 18+ for cleaner syntax with Blob.

  const formData = new FormData();
  // Create a Blob-like object for FormData compatibility if not using the 'form-data' lib
  // If using 'form-data' library:
  // formData.append('pdf', fileBuffer, { filename: fileName, contentType: 'application/pdf' });

  // If using native FormData (Node 18+ or undici's FormData):
  // Convert Buffer to Blob (or a Blob-like object if Blob is not directly available globally in older Node script contexts)
  // A simple way for modern Node:
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  formData.append('pdf', blob, fileName);


  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData,
      // Headers for 'form-data' are usually set automatically by the library or native fetch.
      // If using 'form-data' library and not native fetch, you might need:
      // headers: formData.getHeaders(),
    });

    console.log(`\nResponse Status: ${response.status}`);
    const responseData = await response.json();

    console.log('\nResponse Data:');
    console.log(JSON.stringify(responseData, null, 2));

    if (responseData.success) {
      console.log('\nTest: API call successful.');
      if (responseData.metadata?.ocrPerformed) {
        console.log('Test: OCR was performed according to metadata.');
      } else {
        console.log('Test: OCR was NOT performed (or metadata not present).');
      }
      if (responseData.text && responseData.text.length > 0) {
        console.log(`Test: Extracted text length: ${responseData.text.length}`);
      } else {
        console.warn('Test: Extracted text is empty or missing.');
      }
    } else {
      console.error('\nTest: API call failed.');
      console.error(`Error message: ${responseData.error}`);
    }

  } catch (error) {
    console.error('\nError during API call:', error);
  }
}

const filePathArg = process.argv[2];
testApiExtract(filePathArg);

/*
Instructions for use:

1.  Save this script as `api_extract_test.mjs`.
2.  Ensure your Next.js application is running and accessible at `http://localhost:3000`.
3.  This script uses native `fetch` and `FormData`/`Blob` available in Node.js v18+.
    If you are on an older Node version, you might need to install `node-fetch` and `form-data`:
    `npm install node-fetch form-data`
    Then, uncomment the `form-data` import and adjust FormData usage if necessary:
    `import fetch from 'node-fetch';`
    `import FormData from 'form-data';`
    And use: `formData.append('pdf', fileBuffer, { filename: fileName, contentType: 'application/pdf' });`
    And: `headers: formData.getHeaders()` in the fetch call.

4.  Prepare your test PDF files as described in `E2E_TESTING_CHECKLIST.md`.
    Examples: `test_text_simple.pdf`, `test_scanned_ocr.pdf`.

5.  Run the script from your terminal:
    `node api_extract_test.mjs path/to/your/test_pdf_file.pdf`
    Example:
    `node api_extract_test.mjs ./test_materials/test_scanned_ocr.pdf`

6.  What to look for in the output:
    *   **Response Status:** Should ideally be 200.
    *   **Response Data:** The JSON object returned by your `/api/pdf/extract` endpoint.
        *   `success`: `true` for successful extraction.
        *   `text`: The extracted text content. Check if it's what you expect for the given PDF.
        *   `metadata`:
            *   `ocrPerformed`: `true` if you expected OCR (e.g., for `test_scanned_ocr.pdf`), `false` otherwise.
            *   `pages`: Number of pages.
    *   **Script's Test Summary:** Basic checks printed by the script.

This script helps isolate testing of the server-side extraction logic without needing the full UI,
useful for debugging backend PDF processing, including OCR.
*/

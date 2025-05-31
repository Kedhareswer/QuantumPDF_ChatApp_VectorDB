import { NextResponse, NextRequest } from "next/server";
import { POST as extractPdfHandler } from "../../pdf/extract/route";
import fs from "fs/promises";
import path from "path";
import { FormData } from "formdata-node";
import { File } from "formdata-node"; // Use this for creating File objects in Node

// Helper function to create a NextRequest with FormData
async function createMockPdfRequest(file?: File, overrideContentType?: string): Promise<NextRequest> {
  const formData = new FormData();
  const requestHeaders = new Headers();

  if (file) {
    // formdata-node's File appends with its own content type.
    // If we need to simulate a browser sending a mismatched type,
    // we'd typically rely on the server interpreting the 'type' property of the File vs actual content.
    // For our handler, it checks `file.type`.
    // The `File` object itself will have a `type` property.
    // If `overrideContentType` is given, it's to simulate a scenario where the file object's type property is different
    // from "application/pdf".

    let fileToAppend = file;
    if (overrideContentType) {
        // Create a new file with the overridden type for the purpose of the test
        fileToAppend = new File([await file.arrayBuffer()], file.name, { type: overrideContentType });
    }
    formData.append("pdf", fileToAppend);

    // When FormData is used to create a Request body, 'Content-Type' header with 'multipart/form-data' and boundary is set automatically.
    // We don't need to set it manually for the main request if the body is FormData.
  } else {
    // If no file, FormData is empty. The handler should check `formData.get("pdf")`.
  }

  // Create a new Request object. The URL is a dummy one.
  // The body of the request will be the FormData.
  // NextRequest constructor takes a standard Request object or URL string.
  const request = new NextRequest('http://localhost/api/pdf/extract', {
    method: 'POST',
    body: formData, // This will set the correct Content-Type header with boundary
    // headers: requestHeaders, // Not needed if body is FormData
  });

  return request;
}


export async function GET() {
  const testResults = [];
  let samplePdfFileBuffer: Buffer;
  try {
    // Load the sample PDF buffer
    const pdfPath = path.join(process.cwd(), "app", "api", "test", "pdf", "sample.pdf");
    samplePdfFileBuffer = await fs.readFile(pdfPath);
  } catch (e) {
    console.error("Failed to load sample.pdf buffer:", e);
    return NextResponse.json(
      { error: "Test setup failed: Could not load sample.pdf buffer", details: (e as Error).message },
      { status: 500 }
    );
  }

  // Test case 1: Successful PDF extraction
  try {
    const samplePdfFile = new File([samplePdfFileBuffer], "sample.pdf", { type: "application/pdf" });
    const request = await createMockPdfRequest(samplePdfFile);
    const response = await extractPdfHandler(request);
    const data = await response.json();

    if (response.status === 200 && data.success && data.text && data.text.includes("Test PDF content.") && data.metadata.pages === 1) {
      testResults.push({ name: "Successful PDF Extraction", status: "passed" });
    } else {
      testResults.push({ name: "Successful PDF Extraction", status: "failed", responseStatus: response.status, responseBody: data });
    }
  } catch (error) {
    testResults.push({ name: "Successful PDF Extraction", status: "failed", error: (error as Error).message, stack: (error as Error).stack });
  }

  // Test case 2: No file provided
  try {
    const request = await createMockPdfRequest(); // No file
    const response = await extractPdfHandler(request);
    const data = await response.json();

    if (response.status === 400 && data.error === "No PDF file provided") {
      testResults.push({ name: "No File Provided", status: "passed" });
    } else {
      testResults.push({ name: "No File Provided", status: "failed", responseStatus: response.status, responseBody: data });
    }
  } catch (error) {
    testResults.push({ name: "No File Provided", status: "failed", error: (error as Error).message, stack: (error as Error).stack });
  }

  // Test case 3: Incorrect file type
  try {
    const nonPdfBuffer = Buffer.from("This is not a PDF content");
    // Create a File with a .txt extension and text/plain type
    const nonPdfFile = new File([nonPdfBuffer], "fake.txt", { type: "text/plain" });
    // Pass this nonPdfFile, our handler checks file.type which will be "text/plain"
    const request = await createMockPdfRequest(nonPdfFile);
    const response = await extractPdfHandler(request);
    const data = await response.json();

    if (response.status === 400 && data.error === "File must be a PDF") {
      testResults.push({ name: "Incorrect File Type", status: "passed" });
    } else {
      testResults.push({ name: "Incorrect File Type", status: "failed", responseStatus: response.status, responseBody: data });
    }
  } catch (error) {
    testResults.push({ name: "Incorrect File Type", status: "failed", error: (error as Error).message, stack: (error as Error).stack });
  }

  // Test case 4: File too large
  try {
    // Create a buffer that is 11MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const largeFile = new File([largeBuffer], "large.pdf", { type: "application/pdf" });
    // The File object's size will be derived from the buffer size.

    const request = await createMockPdfRequest(largeFile);
    const response = await extractPdfHandler(request);
    const data = await response.json();

    if (response.status === 400 && data.error === "File size exceeds 10MB limit") {
      testResults.push({ name: "File Too Large", status: "passed" });
    } else {
      testResults.push({ name: "File Too Large", status: "failed", responseStatus: response.status, responseBody: data });
    }
  } catch (error) {
    testResults.push({ name: "File Too Large", status: "failed", error: (error as Error).message, stack: (error as Error).stack });
  }


  return NextResponse.json({ testResults });
}

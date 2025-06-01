from fastapi import FastAPI, File, UploadFile, HTTPException
from PyPDF2 import PdfReader
import io

app = FastAPI()

@app.post("/extract/")
async def extract_pdf_text(pdf_file: UploadFile = File(...)):
    if not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")

    try:
        pdf_content = await pdf_file.read()
        pdf_stream = io.BytesIO(pdf_content)

        reader = PdfReader(pdf_stream)
        num_pages = len(reader.pages)
        extracted_text = ""

        for page_num in range(num_pages):
            page = reader.pages[page_num]
            extracted_text += page.extract_text() or "" # Add empty string if None

        metadata = reader.metadata
        title = metadata.title if metadata and metadata.title else None
        author = metadata.author if metadata and metadata.author else None

        # Basic check if text extraction was poor (e.g., for scanned PDFs)
        ocr_performed = False # Placeholder for future OCR implementation
        # if len(extracted_text.strip()) < 100 and num_pages > 0: # Arbitrary threshold
            # This is where OCR would be triggered if implemented
            # For now, we just note that PyPDF2 might have struggled
            # ocr_performed = True # If OCR was attempted
            # extracted_text_ocr = await perform_ocr(pdf_content) # Hypothetical OCR function
            # if extracted_text_ocr and len(extracted_text_ocr) > len(extracted_text):
            #    extracted_text = extracted_text_ocr
            # else:
            #    ocr_performed = False # OCR didn't yield better results
            # pass

        return {
            "filename": pdf_file.filename,
            "text": extracted_text,
            "num_pages": num_pages,
            "metadata": {
                "title": title,
                "author": author,
                # PyPDF2 metadata object can have more fields, but these are common
                "creator": metadata.creator if metadata and metadata.creator else None,
                "producer": metadata.producer if metadata and metadata.producer else None,
                "creation_date": str(metadata.creation_date) if metadata and metadata.creation_date else None,
                "modification_date": str(metadata.modification_date) if metadata and metadata.modification_date else None,
            },
            "ocr_performed": ocr_performed
        }

    except HTTPException as e:
        raise e # Re-raise HTTPExceptions
    except Exception as e:
        # Log the error server-side for debugging
        print(f"Error processing PDF {pdf_file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # This is for local development. The Dockerfile will use a different command.
    uvicorn.run(app, host="0.0.0.0", port=8000)

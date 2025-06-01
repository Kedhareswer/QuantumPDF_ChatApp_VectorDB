FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# (Optional: If using pytesseract and pdf2image with poppler)
# RUN apt-get update && apt-get install -y tesseract-ocr poppler-utils

COPY . .

# Expose the port FastAPI will run on (e.g., 8000)
EXPOSE 8000

# Command to run the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

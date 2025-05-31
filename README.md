# QuantumPDF ChatApp

**QuantumPDF ChatApp** is an AI-powered web application that enables users to interact with the contents of PDF documents using advanced language models. It supports both local and cloud-based LLMs and provides features for efficient document processing, semantic search, and conversational querying.

---

## Features

- **PDF Text Extraction & Chunking:** Extracts, segments, and prepares text from PDFs for AI-based analysis.
- **Semantic & Keyword Search:** Uses FAISS for vector-based semantic search and supports hybrid keyword/semantic queries.
- **Multiple Model Support:** Compatible with local Hugging Face models and cloud APIs (OpenAI, Google Gemini, Anthropic Claude, AIML, Groq).
- **Interactive Web Interface:** Real-time chat with documents, document management, source citations, and both dark and light modes.
- **Configurable & Extensible:** Easily add new models, configure via environment variables, and extend embedding/database backends.
- **Experiment Tracking:** Optional Weights & Biases integration for model and experiment tracking.
- **Robust Error Handling:** User-friendly error messages and operational feedback.
- **Responsive Design:** Usable on desktops and tablets.

---

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+ (for frontend)
- pip

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
   cd QuantumPDF_ChatApp
   ```
2. Set up Python environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Start the backend API:
   ```bash
   python app.py
   ```
4. In a new terminal, start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Access the app at: [http://localhost:3000](http://localhost:3000)

---

## Usage

1. Upload a PDF.
2. Select a supported language model.
3. Enter an API key if required.
4. Start chatting and querying the PDF’s content.

---

## Configuration

- **Environment Variables:** Store API keys and configuration in `.env`.
- **Model Chunking:** Adjustable chunk size and overlap settings in code.
- **Embeddings:** Default is `sentence-transformers/all-MiniLM-L6-v2`, configurable.
- **Database:** Uses FAISS; other vector databases (e.g., Pinecone, Weaviate) can be integrated.

---

## Performance

- **Recommended RAM:** 8GB+; 16GB+ for local LLMs.
- **GPU:** Use CUDA-enabled PyTorch for faster performance.
- **Tips:** Use larger embedding models for accuracy, enable caching for speed.

---

## Troubleshooting

- **PDF Errors:** Ensure the PDF has extractable text and is not excessively large.
- **Model Issues:** Check RAM and internet connectivity.
- **API Issues:** Verify API keys and check for rate limits.
- **Logs:** Review application output for error details.

---

## Extending

- To add models: Update `app.py` and frontend model selection.
- To use custom embeddings: Replace the default embedding model.
- To use persistent vector databases: Replace FAISS as needed.

---

## Architecture

```
Frontend (HTML/CSS/JS/TypeScript)
        ↓
Flask API Server (Python)
        ↓
PDF Processing (PyMuPDF)
        ↓
Text Chunking
        ↓
Embedding Generation (Sentence Transformers)
        ↓
Vector Storage (FAISS)
        ↓
Similarity Search
        ↓
LLM Generation (Hugging Face/OpenAI/Gemini/AIML)
        ↓
Response with Sources
```

---

## License

GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

---

## Community & Support

- [GitHub Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions)
- [Issues](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
---

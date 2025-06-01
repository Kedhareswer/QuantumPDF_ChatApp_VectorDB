# 🌌 QuantumPDF ChatApp

<p align="center">
  <img src="public/placeholder-logo.svg" width="150" alt="QuantumPDF ChatApp Logo">
</p>

[![GitHub Stars](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/fork)
[![License](https://img.shields.io/github/license/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/commits/main)
[![Issues](https://img.shields.io/github/issues/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
[![Contributors](https://img.shields.io/github/contributors/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/graphs/contributors)

---

**QuantumPDF ChatApp** is an intelligent web application that transforms how you interact with PDF documents. Leveraging advanced Large Language Models (`LLMs`), it lets you “chat” with your PDFs—ask questions and get insightful, cited answers directly from your documents.

Whether you’re handling dense research papers, technical manuals, or long reports, QuantumPDF ChatApp turns static documents into dynamic conversational partners.

> ⭐️ *If you find QuantumPDF ChatApp helpful, [star it on GitHub!](https://github.com/Kedhareswer/QuantumPDF_ChatApp)*

---

## ✅ Features

- **Intelligent PDF Processing**
  - 📝 *Advanced Text Extraction* — Powered by PyMuPDF (Fitz) for high-fidelity text extraction.
  - 🪓 *Smart Text Chunking* — Splits text into overlapping chunks for optimal LLM context.

- **Powerful Search & Retrieval**
  - 🔍 *Semantic Search* — FAISS vector similarity search using Sentence Transformers.
  - 📚 *Multi-Document Querying* — Upload and chat with multiple PDFs in a single session.

- **Flexible LLM Integration**
  - 🖥️ *Local Models* — Run Hugging Face models (e.g., `DialoGPT`, `Zephyr`, `Mistral`) on your hardware.
  - ☁️ *Cloud APIs* — Integrate with OpenAI, Google Gemini, or AIML API for access to top cloud LLMs.

- **Engaging User Experience**
  - 💬 *Interactive Chat Interface* — Next.js + React frontend for natural conversations.
  - 📝 *Source Citations* — See exactly which parts of your PDFs answer your questions.
  - 🗂️ *Document Management* — Upload, view, or remove PDFs per session.
  - 🕰️ *Conversation History* — Context-aware responses by remembering previous turns.
  - 🌗 *Dark & Light Modes* — Choose your favorite visual theme.

- **Robust & Developer-Friendly**
  - 🗄️ *Persistent Storage* — SQLite-backed storage for document metadata and text.
  - 🧠 *Session Management* — Organizes uploads and chats by session.
  - ⚙️ *Configurable & Extensible* — Easily add new models, change embedding models, or swap out vector DBs.
  - 🩺 *Health Check Endpoint* — `/health` API for monitoring.
  - 🖥️ *Responsive Design* — Optimized for desktop and tablet.

- **Experimentation & Observability (Optional)**
  - 📊 *Weights & Biases Integration* — Track experiments and model performance (`WandB`).
  - 📝 *Comprehensive Logging* — For debugging and monitoring.

---

## ⚙️ How It Works

QuantumPDF ChatApp uses a **Retrieval Augmented Generation (`RAG`)** pipeline:

```mermaid
flowchart TD
    A1[User (Next.js Frontend)] --> A2[Flask API (Python Backend)]
    B --> C1[PDF Upload & Processing]
    C1 -->|Text Extraction (PyMuPDF)| C2
    C2[Text Chunking] --> C3[Store in SQLite]
    B --> D1[Embedding & Indexing]
    D1 -->|Sentence Transformers| D2[FAISS Indexes]
    B --> E1[User Query]
    E1 -->|Embed Query| E2[FAISS Similarity Search]
    E2 -->|Retrieve Chunks & History| F1[LLM Answer Generation]
    F1 -->|Prompt LLM (Local/Cloud)| F2[Response Generation]
    F2 --> G[Display Results & Cited Sources (Frontend)]
```

**Step-by-step:**

1.  **User Starts Session:** Access the web UI, a new session starts.
2.  **Document Upload & Processing:** User uploads PDF(s). The Flask backend then extracts text using PyMuPDF, splits it into manageable chunks, and stores these chunks in an SQLite database.
3.  **Embedding & Indexing:** These text chunks are converted into numerical representations (embeddings) using Sentence Transformers. These embeddings are then indexed using FAISS for efficient similarity searching.
4.  **Query & Retrieval:** When the user asks a question, the query is also embedded. The system then searches the FAISS index to find the most relevant text chunks from the documents based on semantic similarity.
5.  **Answer Generation:** The retrieved chunks, along with the conversation history, are provided as context to the selected `LLM` (which can be a local model or a cloud-based API like `OpenAI` or `Gemini`). The `LLM` then generates a coherent answer.
6.  **Display:** The Next.js frontend displays the generated answer to the user, often highlighting or referencing the specific PDF chunks that were used as sources for the answer.

---

## 📦 Installation

### **Prerequisites**
✅ *Make sure you have these installed before proceeding.*
- Python ≥ 3.8
- Node.js ≥ 16 *(for Next.js frontend)*
- `pip`, `Git`

### **Setup**

```bash
# 1. Clone the repository
git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
cd QuantumPDF_ChatApp

# 2. Configure Environment Variables (API Keys)
`cp .env.example .env`
# Edit your `.env` file with your API keys:
# OPENAI_API_KEY=...
# GEMINI_API_KEY=...
# AIML_API_KEY=...
🔑 *Remember to create and populate your `.env` file with necessary API keys.*

# 3. Python Backend Setup
`python -m venv venv`
`source venv/bin/activate`  # On Windows: `.\venv\Scripts\activate`
`pip install -r requirements.txt`

# 4. Next.js Frontend Setup
`npm install`        # or: `pnpm install`

# 5. Run the App
# In one terminal (backend):
`python app.py`
# In another terminal (frontend):
`npm run dev`        # or: `pnpm run dev`

# 6. Open `http://localhost:3000` in your browser.
```

---

## ▶️ Using QuantumPDF ChatApp

1. **Open the Web Interface:**  
   Go to `http://localhost:3000`.

2. **Upload PDFs:**  
   Use the "Upload PDF" button or drag-and-drop files into the designated area.

3. **Select LLM Model:**  
   - Choose your preferred Large Language Model from the available options (local or cloud-based like `OpenAI`, `Gemini`, etc.).
   - Ensure API keys are correctly configured in your `.env` file or entered in the UI if prompted.

4. **Chat:**  
   Type your questions about the content of the uploaded PDFs in the chat input field.

5. **Review Answers & Sources:**  
   Answers include citations to the PDF chunks used.

6. **Manage Documents:**  
   Add/remove PDFs, clear chat history as needed.

**Example Questions:**
- *“What is the main finding of [paper.pdf]?”*
- *“Summarize section 2 of [manual.pdf].”*
- *“Compare methodologies in [A.pdf] and [B.pdf].”*

---

## 🛠️ Configuration

- **Environment Variables:**  
  Set API keys for cloud `LLMs` and integrations in your `.env` file.
  ```env
  OPENAI_API_KEY=your_openai_key
  GEMINI_API_KEY=your_gemini_key
  AIML_API_KEY=your_aiml_key
  WANDB_API_KEY=your_wandb_key
  ```
  🔑 *Remember to create and populate your `.env` file with necessary API keys if you haven't done so during installation.*

- **Model Selection:**  
  - Models can be added or changed within `app.py`. This includes adjustments to the `/models` API endpoint and modifications within the `MultiDocumentRAG` class.
  - The default embedding model is `sentence-transformers/all-MiniLM-L6-v2`.

- **Text Chunking (Backend, `app.py`):**
  - Default settings: `chunk_size` is approximately 500 tokens, with an `overlap` of about 50 tokens.
  - These values can be adjusted in the `chunk_text` method in `app.py` to customize text processing behavior.

- **Conversation Memory:**  
  - The `ConversationMemory` class in `app.py` is configured with `max_history=10`, meaning it retains the last 10 turns of conversation (user and assistant messages).

- **Storage:**  
  - **FAISS:** Used for in-memory storage of embeddings. These are rebuilt upon application restart or when the session changes.
  - **SQLite:** Provides persistent storage for document metadata and text chunks on a per-session basis in the `documents.db` file.

- **Extending to Other Databases:**  
  - To use alternative vector databases like `Pinecone`, `Weaviate`, etc., code modifications will be required to replace the FAISS implementation.

---

## 💨 Performance

- **RAM:** A minimum of 8GB is required, but 16GB+ is recommended, especially when running local `LLMs`.
- **GPU:** For significantly faster processing, especially with local models, a CUDA-enabled GPU with PyTorch is beneficial.
- 💡 *Tip: Using larger embedding models can improve accuracy, but may require more resources. Enabling caching (if available) can also speed up responses on subsequent identical queries.*

---

## 🆘 Troubleshooting

- **PDF Errors:**
    - Ensure your PDF files are not excessively large.
    - Verify that the PDFs contain selectable/extractable text and are not image-only scans.
- **Model Issues:**
    - Check your system's RAM availability, especially if using local `LLMs`.
    - Ensure a stable internet connection if using cloud-based `LLM` APIs.
- **API Issues:**
    - Double-check that your API keys in the `.env` file are correct and have the necessary permissions.
    - Be mindful of API rate limits for your chosen `LLM` provider.
- **Logs:**
    - Always check the terminal output from both the Flask backend (`app.py`) and the Next.js frontend console for detailed error messages.
  
⚠️ *Important: If you encounter persistent issues, consider opening an issue on the [GitHub repository](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues) with detailed logs and steps to reproduce the problem.*

---

## ➕ Extending

- **Add New Models:** Update `app.py` (specifically the `/models` endpoint and `MultiDocumentRAG` class) and the frontend model selection UI to include new `LLMs`.
- **Custom Embeddings:** The default embedding model (`sentence-transformers/all-MiniLM-L6-v2`) can be swapped out by modifying the relevant sections in `app.py`.
- **Persistent Vector DB:** Replace the in-memory FAISS index with a persistent vector database solution (e.g., `Pinecone`, `Weaviate`, `ChromaDB`) by updating the data storage and retrieval logic.

---

## 📜 License

[GNU GPL v3.0](LICENSE)

---

## 🤝 Community & Support

- [GitHub Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions)
- [Issues](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)

---

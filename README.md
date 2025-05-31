```markdown
# 🌌 QuantumPDF ChatApp

[![GitHub Stars](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/fork)
[![License](https://img.shields.io/github/license/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/commits/main)
[![Issues](https://img.shields.io/github/issues/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
[![Contributors](https://img.shields.io/github/contributors/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/graphs/contributors)

---

**QuantumPDF ChatApp** is an intelligent web application that transforms how you interact with PDF documents. Leveraging advanced Large Language Models (LLMs), it lets you “chat” with your PDFs—ask questions and get insightful, cited answers directly from your documents.

Whether you’re handling dense research papers, technical manuals, or long reports, QuantumPDF ChatApp turns static documents into dynamic conversational partners.

> ⭐️ *If you find QuantumPDF ChatApp helpful, [star it on GitHub!](https://github.com/Kedhareswer/QuantumPDF_ChatApp)*

---

## ✨ Features

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
  - 📊 *Weights & Biases Integration* — Track experiments and model performance.
  - 📝 *Comprehensive Logging* — For debugging and monitoring.

---

## 🛠️ How It Works

QuantumPDF ChatApp uses a **Retrieval Augmented Generation (RAG)** pipeline:

```mermaid
flowchart TD
    A[User (Next.js Frontend)] --> B[Flask API (Python Backend)]
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

1. **User Starts Session:** Access the web UI, a new session starts.
2. **Document Upload & Processing:** Upload PDFs → Flask backend extracts text (PyMuPDF), chunks it, and stores in SQLite.
3. **Embedding & Indexing:** Text chunks are embedded (Sentence Transformers) and indexed (FAISS).
4. **Query & Retrieval:** Ask a question → Query is embedded → Matches are found in FAISS.
5. **Answer Generation:** LLM (local/cloud) gets context from matches + chat history, generates a response.
6. **Display:** Frontend shows the answer and highlights which PDF chunks were used.

---

## 🚀 Installation

### **Prerequisites**
- Python ≥ 3.8
- Node.js ≥ 16 *(for Next.js frontend)*
- pip, Git

### **Setup**

```bash
# 1. Clone the repository
git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
cd QuantumPDF_ChatApp

# 2. Configure Environment Variables (API Keys)
cp .env.example .env
# Edit `.env` with your API keys:
# OPENAI_API_KEY=...
# GEMINI_API_KEY=...
# AIML_API_KEY=...

# 3. Python Backend Setup
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt

# 4. Next.js Frontend Setup
npm install        # or: pnpm install

# 5. Run the App
# In one terminal (backend):
python app.py
# In another terminal (frontend):
npm run dev        # or: pnpm run dev

# 6. Open http://localhost:3000 in your browser.
```

---

## 💡 Using QuantumPDF ChatApp

1. **Open the Web Interface:**  
   Go to `http://localhost:3000`.

2. **Upload PDFs:**  
   Use "Upload PDF" or drag-and-drop.

3. **Select LLM Model:**  
   - Choose from local (if set up) or cloud (OpenAI, Gemini, etc.) models.
   - Enter API keys if needed (via `.env` or UI).

4. **Chat:**  
   Type questions about your uploaded PDFs in the chat box.

5. **Review Answers & Sources:**  
   Answers include citations to the PDF chunks used.

6. **Manage Documents:**  
   Add/remove PDFs, clear chat history as needed.

**Example Questions:**
- *“What is the main finding of [paper.pdf]?”*
- *“Summarize section 2 of [manual.pdf].”*
- *“Compare methodologies in [A.pdf] and [B.pdf].”*

---

## ⚙️ Configuration

- **Environment Variables:**  
  Set API keys for cloud LLMs and integrations in `.env`.
  ```env
  OPENAI_API_KEY=your_openai_key
  GEMINI_API_KEY=your_gemini_key
  AIML_API_KEY=your_aiml_key
  WANDB_API_KEY=your_wandb_key
  ```

- **Model Selection:**  
  - Add/change available models in `app.py` (`/models` endpoint and `MultiDocumentRAG` class).
  - The default embedding model is `sentence-transformers/all-MiniLM-L6-v2`.

- **Text Chunking (Backend, `app.py`):**
  - Default: `chunk_size ≈ 500`, `overlap ≈ 50`.
  - Adjust in `chunk_text` method for custom behavior.

- **Conversation Memory:**  
  - `max_history=10` (user+assistant turns) in `ConversationMemory` (`app.py`).

- **Storage:**  
  - **FAISS:** In-memory for embeddings, rebuilt on restart/session change.
  - **SQLite:** Persistent metadata and chunks per session in `documents.db`.

- **Extending to Other Databases:**  
  - Swap FAISS for Pinecone, Weaviate, etc. with code changes.

---

## ⚡ Performance

- **RAM:** 8GB+ (16GB+ recommended for local LLMs)
- **GPU:** CUDA-enabled PyTorch for speed
- **Tips:** Use larger embedding models for better accuracy. Enable caching for faster responses.

---

## 🐞 Troubleshooting

- **PDF Errors:** Ensure PDFs are not too large and have extractable text.
- **Model Issues:** Check system RAM and internet connection.
- **API Issues:** Verify API keys and rate limits.
- **Logs:** Check terminal output for error details.

---

## 🧩 Extending

- **Add New Models:** Update `app.py` and frontend model choices.
- **Custom Embeddings:** Swap out the default embedding model.
- **Persistent Vector DB:** Replace FAISS with your preferred solution.

---

## 📝 License

[GNU GPL v3.0](LICENSE)

---

## 💬 Community & Support

- [GitHub Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions)
- [Issues](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)

---

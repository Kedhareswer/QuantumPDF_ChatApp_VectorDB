# QuantumPDF Quick Start Guide

> **Get up and running in 5 minutes**
> **Last Updated: June 2026 | Version 3.1.0**

---

## 🚀 Quick Setup

### Prerequisites

- Node.js 18+ 
- npm 9+
- API key for at least one AI provider

### 1. Clone & Install

```bash
git clone <repository-url>
cd QuantumPDF_ChatApp_VectorDB
npm install
```

### 2. Configure API Keys

Create `.env.local`:

```env
# Choose at least one AI provider
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GROQ_API_KEY=gsk_...
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📄 Basic Usage

### Upload Documents

1. Click **"Upload Documents"** or drag & drop files
2. Supported formats: PDF, DOCX, XLSX, CSV
3. Wait for processing (progress shown)
4. Document appears in library

### Chat with Documents

1. Type your question in the chat input
2. Press Enter or click Send
3. AI analyzes your documents and responds
4. Sources shown with each response

### Enhanced UI Features

1. **Source Cards**: View sources with similarity scores below each message
2. **Inline Citations**: Compact superscript references with a single "Sources" line under each answer
3. **Document Filtering**: Use filter chips above input to search specific documents
4. **Chunk Visualization**: Expand "View Retrieved Chunks" to see retrieval details
5. **Query History**: Click History button in header to access previous queries
6. **Export**: Use Export menu to save conversations as Markdown or PDF

---

## ⚙️ Configuration

### AI Provider Setup

1. Click the **Settings** icon (⚙️)
2. Select **"AI Provider"** tab
3. Choose provider from dropdown
4. Enter API key
5. Select model
6. Click **"Save"**

### Vector Database Setup (Optional)

For cloud vector storage:

1. Go to Settings → **"Vector Database"** tab
2. Select provider (Pinecone/Weaviate)
3. Enter credentials
4. Click **"Connect"**

---

## 🔑 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | Insert a newline in the chat input |

---

## 📊 Feature Overview

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-format Docs | ✅ | PDF, DOCX, XLSX, CSV |
| 19 AI Providers | ✅ | OpenAI, Anthropic, Groq, etc. |
| 3-Phase RAG | ✅ | Context, Critique, Refine |
| Enhanced UI/UX | ✅ | Source Cards, Citations, Filtering, etc. |
| Image Captioning | ✅ | AI-powered image analysis |
| Table Extraction | ✅ | Detect and parse tables |
| Extractive Summaries | ✅ | Built-in extractive fallback summarizer (no in-browser models) |
| PWA | ✅ | Install as desktop/mobile app |

---

## 🛠 Troubleshooting

### "API Key Invalid"

- Double-check key is correct
- Ensure no extra spaces
- Verify key has proper permissions

### "Document Processing Failed"

- Check file is not corrupted
- Verify file size < 50MB
- Try re-uploading

### "No Response from AI"

- Check internet connection
- Verify API key is valid
- Check provider status page

### "Offline Mode Issues"

- Ensure service worker is registered
- Try clearing cache and reloading
- Check browser supports PWA

---

## 📚 Learn More

| Resource | Description |
|----------|-------------|
| [README](../README.md) | Full project overview |
| [Architecture](ARCHITECTURE_FLOWS.md) | System diagrams |
| [RAG Guide](RAG_ARCHITECTURE.md) | RAG implementation details |
| [Implementation](IMPLEMENTATION_GUIDE.md) | Code reference |
| [Optimization](OPTIMIZATION_GUIDE.md) | Performance tips |

---

## 🎯 Next Steps

1. **Upload your first document** - Try a PDF with mixed content
2. **Ask questions** - Test different query types
3. **Explore UI features** - Try source cards, filtering, and chunk visualization
4. **Install as PWA** - Click install button in browser

---

**Happy analyzing!** 🚀

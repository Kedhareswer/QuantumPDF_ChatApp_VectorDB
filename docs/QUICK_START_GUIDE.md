# QuantumPDF Quick Start Guide

> **Get up and running in 5 minutes**
> **Last updated: August 2026**

---

## 🚀 Quick Setup

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- npm 9+
- API key for at least one AI provider

### 1. Clone & Install

```bash
git clone <repository-url>
cd QuantumPDF_ChatApp_VectorDB
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A short tour points you at
the three things you need on first run.

### 3. Configure an API Key

The fastest path is in-app: open **Settings** (the gear tab in the left sidebar),
pick a provider, paste its key, and hit **Test Connection**. Keys are stored in
your browser, so nothing needs to be on disk.

If you would rather set them server-side, create `.env.local`:

```env
# Choose at least one AI provider
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GROQ_API_KEY=gsk_...
```

---

## 📄 Basic Usage

### Upload Documents

1. Click **"Upload Documents"** or drag & drop files
2. Supported formats: PDF; Word (DOC/DOCX/DOCM/ODT/RTF); PowerPoint (PPT/PPTX/PPS/ODP); Excel (XLS/XLSX/XLSM/XLSB/ODS); EPUB; CSV/TSV
3. Wait for processing (progress shown)
4. Document appears in library

### Chat with Documents

1. Type your question in the chat input
2. Press Enter or click Send
3. AI analyzes your documents and responds
4. Sources shown with each response

### Enhanced UI Features

1. **Inline Citations**: Compact superscript references with a single "Sources" line under each answer
2. **Document Filtering**: Use filter chips above input to search specific documents
3. **Chunk Visualization**: Expand "View Retrieved Chunks" to see retrieval details
4. **Query History**: Click History button in the chat header to access previous queries
5. **Export**: Use the quick-actions menu to save conversations as JSON, Markdown, TXT or PDF

---

## ⚙️ Configuration

### AI Provider Setup

1. Click the **Settings** icon (⚙️)
2. Select **"AI Provider"** tab
3. Choose provider from dropdown
4. Enter API key
5. Select model
6. Click **"Test Connection"** — settings save automatically as you type

### Vector Database Setup (Optional)

For cloud vector storage:

1. Go to Settings → **"Vector DB"** tab
2. Select provider (Local Storage, Pinecone or Weaviate)
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
| Multi-format Docs | ✅ | PDF + Word/PowerPoint/Excel/OpenDocument/RTF/EPUB/CSV/TSV |
| 19 AI Providers | ✅ | OpenAI, Anthropic, Groq, etc. |
| 3-Phase RAG | ✅ | Context, Critique, Refine |
| Enhanced UI/UX | ✅ | Inline citations, filtering, chunk visualization, history, export |
| Image Extraction | ✅ | Embedded images pulled from PDFs and .docx (captioning not wired up) |
| Table Extraction | ✅ | Detect and parse tables |
| PDF OCR | ✅ | Optional, via liteparse — toggle "Enable OCR fallback" on upload |
| PWA | ✅ | Install as desktop/mobile app |

---

## 🛠 Troubleshooting

### "API Key Invalid"

- Double-check key is correct
- Ensure no extra spaces
- Verify key has proper permissions

### "Document Processing Failed"

- Check file is not corrupted
- Verify file size is under the limit (100 MB for PDF, 50 MB for everything else)
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
3. **Explore UI features** - Try filtering, chunk visualization and query history
4. **Install as PWA** - Click install button in browser

---

**Happy analyzing!** 🚀

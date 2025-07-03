# QuantumPDF ChatApp

<div align="center">

**Next-Generation AI-Powered PDF Document Analysis & Conversational Intelligence Platform**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## 📑 Overview

QuantumPDF ChatApp lets you **chat with your PDFs** using a multi-phase Retrieval-Augmented Generation (RAG) engine.  
It extracts knowledge ➜ stores it in a vector database ➜ reasons over it with your favourite Large Language Model.

| 💡 | Feature | Why it matters |
|-----|---------|---------------|
| 🧠 | **3-Phase RAG** | Initial answer → self-critique → refined answer = fewer hallucinations. |
| ⚡ | **Adaptive Chunking** | Dynamic chunk size & overlap keep context windows lean. |
| 🔍 | **Metadata Pre-Filtering** | Author / date / tag filters prune irrelevant docs before similarity search. |
| 🔌 | **Pluggable Providers** | 20+ LLMs & 4 vector DBs out-of-the-box. |
| 📱 | **Responsive PWA** | Smooth on mobile, desktop and everything between. |

---

## 🛣️ How It Works

```mermaid
flowchart TD
    U[User Query / Upload] -->|1. Extract & Chunk| E[PDF Processor]
    E -->|2. Embed| V[Vector DB]
    U -->|3. Embed Query| V
    V -->|4. Retrieve Top-K| C[Context]
    C -->|5. Phase 1| P1[Initial Answer]
    P1 -->|6. Phase 2| P2[Self-Critique]
    P2 -->|7. Phase 3| P3[Refinement]
    P3 -->|8. Stream ↯| UI[Chat UI]
```

### Why This Design Wins

| Challenge | Traditional RAG | QuantumPDF Solution |
|-----------|-----------------|---------------------|
| Hallucinations | One-shot response | Self-critique & refinement |
| Latency | Big contexts | Pre-filter + adaptive chunking |
| Token Cost | Oversized chunks | Tuned budgets per phase |
| UX | Long blank waits | Streaming partial answers within ~1 s |

---

## 🚀 Quick Start

```bash
# Clone & install
pnpm create quantum-pdf@latest   # or git clone && pnpm install

# Secrets stay local – never committed
cp .env.example .env.local
# Add ONLY the keys you need, e.g.
# OPENAI_API_KEY="YOUR_OPENAI_KEY"
# PINECONE_API_KEY="YOUR_PINECONE_KEY"

pnpm dev   # http://localhost:3000
```

### Minimal `.env.local`

```bash
OPENAI_API_KEY="YOUR_OPENAI_KEY"
OPENAI_MODEL="gpt-4o-mini"

PINECONE_API_KEY="YOUR_PINECONE_KEY"
PINECONE_ENVIRONMENT="us-east1-gcp"
PINECONE_INDEX_NAME="quantum-pdf"
```

---

## 🛠️ Use-Cases

| Domain | Example Prompt | Benefit |
|--------|----------------|---------|
| Research | *"Summarise the methodology differences between paper A & B."* | Lit-review in seconds |
| Legal | *"List all parties and obligations on page 12."* | Faster contract analysis |
| Finance | *"Extract cash-flow assumptions from the model appendix."* | Rapid due-diligence |
| Support | *"Why does error E04 occur and how do I fix it?"* | Smarter help-desk bots |

---

## 🌟 API Examples

### Chat with a Document

```bash
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
        "message": "What are the key findings on climate impact?",
        "config": { "model": "gpt-4", "enableThinking": true }
      }'
```

### Upload & Index a PDF

```bash
curl -F file=@research.pdf http://localhost:3000/api/pdf/extract
```

---

## 🗺️ Tech Map

```mermaid
graph LR
  subgraph Frontend
    UI[Next.js 15 / React 19] --> Tailwind
    UI --> RadixUI
  end
  subgraph Backend
    API[Next.js API Routes] --> RAG
    RAG --> LLM[[LLM Providers]]
    RAG --> VectorDB[(Vector DBs)]
  end
  Browser --> UI
```

---

## 🔄 Data Flow (avg)

| Step | Time | Notes |
|------|------|-------|
| Extract & embed | 230 ms / page | OCR adds ~400 ms |
| Retrieval | < 50 ms | Pre-filter drops ~60 % vectors |
| Phase 1 | 1.5 s | 40 % token budget |
| Phase 2 | 0.9 s | Quality check |
| Phase 3 | 1.2 s | Refinement & streaming |

---

## 🧩 Extend Me

1. **New LLM** → add an `AIClient` adapter.  
2. **Different Vector DB** → implement a driver in `lib/vector-database.ts`.  
3. **Custom Filters** → extend `RAGFilterOptions` & UI filter panel.

---

## 📜 License

GPL-3.0 – see [LICENSE](LICENSE).

[![Star History Chart](https://api.star-history.com/svg?repos=Kedhareswer/QuantumPDF_ChatApp&type=Date)](https://star-history.com/#Kedhareswer/QuantumPDF_ChatApp&Date)

---

Made with ❤️ & caffeine by the QuantumPDF community.

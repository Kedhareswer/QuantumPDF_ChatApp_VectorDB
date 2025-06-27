<div align="center">

# 🌌 QuantumPDF ChatApp

[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![License](https://img.shields.io/github/license/Kedhareswer/QuantumPDF_ChatApp?style=for-the-badge)](LICENSE)
[![Issues](https://img.shields.io/github/issues/Kedhareswer/QuantumPDF_ChatApp?style=for-the-badge)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
[![Stars](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=for-the-badge)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)

*Revolutionary AI-powered PDF document analysis with 18+ LLM providers and RAG technology*

[🚀 Features](#-features) • [🛠 Installation](#-installation) • [⚙️ Configuration](#️-configuration) • [📖 Documentation](#-documentation) • [🤝 Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [🚀 Features](#-features)
- [🏗 Architecture](#-architecture)
- [🛠 Technology Stack](#-technology-stack)
- [🔧 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🎮 Usage Guide](#-usage-guide)
- [🤖 AI Providers](#-ai-providers)
- [🗄️ Vector Databases](#️-vector-databases)
- [📊 Performance](#-performance)
- [🆘 Troubleshooting](#-troubleshooting)
- [🔧 API Reference](#-api-reference)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Overview

**QuantumPDF ChatApp** is a cutting-edge, production-ready web application that transforms static PDF documents into intelligent, conversational knowledge bases. Built with modern technologies and powered by advanced AI, it enables natural language interactions with your documents through state-of-the-art RAG (Retrieval-Augmented Generation) technology.

### ✨ Key Highlights

| 🎯 **Core Value** | 📝 **Description** |
|-------------------|--------------------|
| **🧠 AI-First Design** | Built from the ground up with AI at its core, supporting 18+ LLM providers |
| **🔒 Privacy-Focused** | Client-side processing options with local vector storage capabilities |
| **⚡ Production-Ready** | Enterprise-grade architecture with comprehensive error handling |
| **🎨 Modern UI/UX** | Beautiful, accessible interface with dark/light mode support |
| **🔗 API-First** | RESTful APIs for seamless integration with existing workflows |

---

## 🚀 Features

### 📄 Document Processing

```mermaid
flowchart LR
    A[PDF Upload] --> B[Text Extraction]
    B --> C[Smart Chunking]
    C --> D[OCR Processing]
    D --> E[Metadata Extraction]
    E --> F[Ready for Chat]
    
    style A fill:#e1f5fe
    style F fill:#e8f5e8
```

| **Feature** | **Technology** | **Description** |
|-------------|----------------|-----------------|
| 📄 **Advanced PDF Processing** | PDF.js + Custom Parser | Supports text-based and image-based PDFs with intelligent text extraction |
| 🔍 **OCR Integration** | Tesseract.js | Real-time optical character recognition for scanned documents |
| ✂️ **Smart Chunking** | Advanced Algorithms | Intelligent text segmentation preserving context and meaning |
| 📊 **Metadata Extraction** | Custom Engine | Automatic extraction of titles, authors, creation dates, and more |
| 🔄 **Batch Processing** | Multi-file Support | Process multiple PDFs simultaneously with progress tracking |

### 🤖 AI & Machine Learning

| **Capability** | **Implementation** | **Benefits** |
|----------------|-------------------|--------------|
| 🎯 **18+ AI Providers** | Unified API Interface | Choose from OpenAI, Anthropic, Google AI, and 15+ more providers |
| 🧮 **Vector Embeddings** | Multiple Models | Support for OpenAI, Hugging Face, and custom embedding models |
| 🔍 **Semantic Search** | RAG Engine | Find relevant content using meaning, not just keywords |
| 💭 **Thinking Sections** | Collapsible UI | Transparent AI reasoning with expandable thought processes |
| 📈 **Context Awareness** | Advanced Prompting | Maintains conversation context for coherent interactions |

### 🎨 User Experience

| **Feature** | **Description** | **Technology** |
|-------------|-----------------|----------------|
| 💬 **Interactive Chat** | Real-time conversations with your documents | WebSocket + Server-Sent Events |
| 📝 **Source Citations** | Automatic citation generation with page references | Custom Citation Engine |
| 🌙 **Dark/Light Mode** | System-aware theme switching | Tailwind CSS + Next-themes |
| 📱 **Responsive Design** | Works perfectly on desktop, tablet, and mobile | Responsive Grid System |
| ⚡ **Real-time Updates** | Live processing status and progress indicators | React State Management |

---

## 🏗 Architecture

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React UI Components]
        State[Zustand State Management]
        Theme[Theme Provider]
    end
    
    subgraph "API Layer"
        API[Next.js API Routes]
        Auth[Authentication]
        Rate[Rate Limiting]
    end
    
    subgraph "AI Processing Layer"
        LLM[LLM Providers]
        Embed[Embedding Generation]
        RAG[RAG Engine]
    end
    
    subgraph "Document Processing"
        PDF[PDF Parser]
        OCR[OCR Processor]
        Chunk[Text Chunker]
    end
    
    subgraph "Data Layer"
        Vector[Vector Database]
        Store[Document Store]
        Cache[Response Cache]
    end
    
    UI --> API
    State --> UI
    Theme --> UI
    API --> LLM
    API --> RAG
    RAG --> Embed
    RAG --> Vector
    PDF --> Chunk
    OCR --> Chunk
    Chunk --> Embed
    
    style UI fill:#e3f2fd
    style API fill:#f3e5f5
    style LLM fill:#e8f5e8
    style Vector fill:#fff3e0
```

### Component Architecture

```mermaid
classDiagram
    class ChatInterface {
        +messages: Message[]
        +sendMessage()
        +clearChat()
        +renderThinking()
    }
    
    class DocumentLibrary {
        +documents: Document[]
        +uploadDocument()
        +removeDocument()
        +exportDocument()
    }
    
    class RAGEngine {
        +processDocument()
        +generateEmbedding()
        +query()
        +findRelevantChunks()
    }
    
    class AIClient {
        +generateText()
        +generateEmbedding()
        +testConnection()
        +18 Providers
    }
    
    class VectorDatabase {
        +addDocuments()
        +search()
        +delete()
        +4 Providers
    }
    
    ChatInterface --> RAGEngine
    DocumentLibrary --> RAGEngine
    RAGEngine --> AIClient
    RAGEngine --> VectorDatabase
```

---

## 🛠 Technology Stack

### Frontend Technologies

| **Category** | **Technology** | **Version** | **Purpose** |
|--------------|----------------|-------------|-------------|
| **Framework** | ![Next.js](https://img.shields.io/badge/Next.js-15.2.4-000000?style=flat-square&logo=next.js) | 15.2.4 | Full-stack React framework with SSR |
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript) | 5.0+ | Type-safe development |
| **UI Library** | ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react) | 19.0 | Component-based UI development |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-38B2AC?style=flat-square&logo=tailwind-css) | 3.4.17 | Utility-first CSS framework |
| **Components** | ![Radix UI](https://img.shields.io/badge/Radix_UI-Latest-000000?style=flat-square) | Latest | Accessible component primitives |
| **State** | ![Zustand](https://img.shields.io/badge/Zustand-Latest-FF6B6B?style=flat-square) | Latest | Lightweight state management |

### Core Dependencies

```json
{
  "production": {
    "next": "15.2.4",
    "react": "^19",
    "typescript": "^5",
    "zustand": "latest",
    "pdfjs-dist": "latest",
    "tesseract.js": "^5.0.5",
    "lucide-react": "^0.454.0"
  },
  "development": {
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5",
    "@types/node": "^22",
    "@types/react": "^19"
  }
}
```

### Architecture Patterns

| **Pattern** | **Implementation** | **Benefits** |
|-------------|-------------------|--------------|
| **Component Composition** | Radix UI + Custom Components | Reusable, accessible, maintainable |
| **State Management** | Zustand with Persistence | Simple, performant, type-safe |
| **API Design** | RESTful + Server Actions | Clean separation, better DX |
| **Error Boundaries** | React Error Boundaries | Graceful error handling |
| **Code Splitting** | Next.js Dynamic Imports | Optimal bundle sizes |

---

## 🔧 Installation

### Prerequisites

| **Requirement** | **Minimum** | **Recommended** | **Notes** |
|-----------------|-------------|-----------------|-----------|
| ![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js) | 18.0 | 20 LTS | For Next.js and package management |
| ![RAM](https://img.shields.io/badge/RAM-4GB-FF6B6B?style=flat-square) | 4GB | 8GB+ | For smooth development experience |
| ![Storage](https://img.shields.io/badge/Storage-2GB-4CAF50?style=flat-square) | 2GB | 5GB+ | For dependencies and models |
| ![Browser](https://img.shields.io/badge/Browser-Modern-2196F3?style=flat-square) | Chrome 90+ | Latest | For WebAssembly support |

### Quick Start

#### 1. Clone Repository
```bash
git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
cd QuantumPDF_ChatApp
```

#### 2. Install Dependencies
```bash
# Using npm (recommended)
npm install

# Or using yarn
yarn install

# Or using pnpm
pnpm install
```

#### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your API keys
nano .env.local
```

#### 4. Start Development Server
```bash
npm run dev
```

#### 5. Open Application
Navigate to [http://localhost:3000](http://localhost:3000) 🎉

### Production Deployment

#### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

#### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## ⚙️ Configuration

### Environment Variables

| **Variable** | **Required** | **Description** | **Example** |
|--------------|--------------|-----------------|-------------|
| `OPENAI_API_KEY` | Optional | OpenAI API key for GPT models | `sk-...` |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for Claude models | `ant-...` |
| `GOOGLE_AI_API_KEY` | Optional | Google AI API key for Gemini models | `AI...` |
| `HUGGINGFACE_API_KEY` | Optional | Hugging Face API key | `hf_...` |
| `WANDB_API_KEY` | Optional | Weights & Biases for experiment tracking | `...` |
| `NODE_ENV` | Auto | Environment mode | `development` |

### Application Configuration

```typescript
// Configuration schema
interface AppConfig {
  ai: {
    provider: AIProvider;
    model: string;
    apiKey: string;
    baseUrl?: string;
    temperature?: number;
  };
  vectorDb: {
    provider: 'pinecone' | 'weaviate' | 'chroma' | 'local';
    config: VectorDBConfig;
  };
  document: {
    maxFileSize: number;
    allowedTypes: string[];
    chunkSize: number;
    chunkOverlap: number;
  };
}
```

### Provider-Specific Settings

| **Provider** | **Models Available** | **Special Configuration** |
|--------------|---------------------|---------------------------|
| **OpenAI** | GPT-4, GPT-3.5-turbo, text-embedding-3-* | API key required |
| **Anthropic** | Claude-3.5-sonnet, Claude-3-haiku | API key + proper headers |
| **Google AI** | Gemini-1.5-pro, Gemini-1.5-flash | API key + project ID |
| **Groq** | Llama-3.1, Mixtral | API key for fast inference |
| **Local** | Ollama models | Local installation required |

---

## 🎮 Usage Guide

### Basic Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as API Layer
    participant RAG as RAG Engine
    participant AI as AI Provider

    U->>UI: Upload PDF
    UI->>API: POST /api/pdf/upload
    API->>RAG: Process document
    RAG->>RAG: Extract & chunk text
    RAG->>AI: Generate embeddings
    AI-->>RAG: Return embeddings
    RAG-->>API: Document ready
    API-->>UI: Upload success
    UI-->>U: Show document in library

    U->>UI: Ask question
    UI->>API: POST /api/chat
    API->>RAG: Query with question
    RAG->>RAG: Find relevant chunks
    RAG->>AI: Generate response
    AI-->>RAG: Return answer
    RAG-->>API: Response with sources
    API-->>UI: Stream response
    UI-->>U: Display answer + citations
```

### Feature Usage

#### Document Management
```typescript
// Upload documents
const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/pdf/upload', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};

// Query documents
const queryDocuments = async (question: string) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question })
  });
  
  return response.json();
};
```

#### Advanced Features
- **Bulk Export**: Export all documents as JSON or Markdown
- **Search within Documents**: Semantic search across your document library
- **Citation Tracking**: Automatic source attribution for all responses
- **Conversation History**: Persistent chat history with context

---

## 🤖 AI Providers

### Supported Providers (18+)

| **Provider** | **Status** | **Models** | **Features** | **Setup** |
|--------------|------------|------------|--------------|-----------|
| ![OpenAI](https://img.shields.io/badge/OpenAI-✅-00A67E?style=flat-square) | Production | GPT-4, GPT-3.5, Embeddings | Text + Embeddings | API Key |
| ![Anthropic](https://img.shields.io/badge/Anthropic-✅-D2691E?style=flat-square) | Production | Claude-3.5-Sonnet, Claude-3-Haiku | Advanced reasoning | API Key |
| ![Google AI](https://img.shields.io/badge/Google_AI-✅-4285F4?style=flat-square) | Production | Gemini-1.5-Pro, Gemini-1.5-Flash | Multimodal capabilities | API Key |
| ![Groq](https://img.shields.io/badge/Groq-✅-F55036?style=flat-square) | Production | Llama-3.1, Mixtral-8x7B | Ultra-fast inference | API Key |
| ![Fireworks AI](https://img.shields.io/badge/Fireworks-✅-FF4500?style=flat-square) | Production | Llama-2, CodeLlama | Open source models | API Key |
| ![Cerebras](https://img.shields.io/badge/Cerebras-✅-00B4D8?style=flat-square) | Production | Llama-3.1 | High-performance inference | API Key |
| ![OpenRouter](https://img.shields.io/badge/OpenRouter-✅-8A2BE2?style=flat-square) | Production | 100+ Models | Model aggregation | API Key |
| ![AI/ML API](https://img.shields.io/badge/AIML_API-✅-FF6B6B?style=flat-square) | Production | Multiple providers | Cost-effective access | API Key |
| ![Hugging Face](https://img.shields.io/badge/Hugging_Face-✅-FFD700?style=flat-square) | Production | Open source models | Free tier available | API Key |
| ![DeepInfra](https://img.shields.io/badge/DeepInfra-✅-4CAF50?style=flat-square) | Production | Llama, Mistral, etc. | Affordable inference | API Key |
| ![Replicate](https://img.shields.io/badge/Replicate-✅-000000?style=flat-square) | Production | Community models | Easy deployment | API Key |
| ![Anyscale](https://img.shields.io/badge/Anyscale-✅-FF5722?style=flat-square) | Production | Ray-powered models | Scalable inference | API Key |
| ![DeepSeek](https://img.shields.io/badge/DeepSeek-✅-2196F3?style=flat-square) | Production | DeepSeek-Coder, Chat | Specialized models | API Key |
| ![Vertex AI](https://img.shields.io/badge/Vertex_AI-✅-4285F4?style=flat-square) | Production | Google Cloud models | Enterprise features | GCP Setup |
| ![Mistral](https://img.shields.io/badge/Mistral-✅-FF7F00?style=flat-square) | Production | Mistral-7B, Mixtral | European AI | API Key |
| ![Perplexity](https://img.shields.io/badge/Perplexity-✅-1E88E5?style=flat-square) | Production | Search-augmented LLMs | Real-time data | API Key |
| ![xAI (Grok)](https://img.shields.io/badge/xAI-✅-000000?style=flat-square) | Production | Grok models | Elon Musk's AI | API Key |
| ![Alibaba Cloud](https://img.shields.io/badge/Alibaba-✅-FF6A00?style=flat-square) | Production | Qwen models | Chinese market focus | API Key |
| ![MiniMax](https://img.shields.io/badge/MiniMax-✅-E91E63?style=flat-square) | Production | Chinese LLMs | Local compliance | API Key |

### Provider Comparison

```mermaid
quadrantChart
    title AI Provider Performance Matrix
    x-axis Low Cost --> High Cost
    y-axis Low Performance --> High Performance
    
    quadrant-1 Premium Performance
    quadrant-2 Best Value
    quadrant-3 Budget Options
    quadrant-4 Enterprise Solutions
    
    OpenAI: [0.8, 0.9]
    Anthropic: [0.85, 0.95]
    Google AI: [0.7, 0.85]
    Groq: [0.6, 0.8]
    Fireworks: [0.4, 0.7]
    HuggingFace: [0.2, 0.6]
    OpenRouter: [0.5, 0.75]
    Cerebras: [0.65, 0.82]
```

---

## 🗄️ Vector Databases

### Supported Vector Stores

| **Provider** | **Type** | **Best For** | **Setup Complexity** | **Performance** |
|--------------|----------|--------------|----------------------|-----------------|
| ![Pinecone](https://img.shields.io/badge/Pinecone-✅-00D4AA?style=flat-square) | Cloud | Production apps | Medium | ⭐⭐⭐⭐⭐ |
| ![Weaviate](https://img.shields.io/badge/Weaviate-✅-FF6B6B?style=flat-square) | Cloud/Self-hosted | Enterprise | High | ⭐⭐⭐⭐⭐ |
| ![Chroma](https://img.shields.io/badge/Chroma-✅-4CAF50?style=flat-square) | Self-hosted | Development | Low | ⭐⭐⭐⭐ |
| ![Local](https://img.shields.io/badge/Local-✅-9E9E9E?style=flat-square) | Browser | Privacy-first | None | ⭐⭐⭐ |

### Vector Database Configuration

```typescript
interface VectorDBConfig {
  pinecone?: {
    apiKey: string;
    environment: string;
    indexName: string;
  };
  weaviate?: {
    url: string;
    apiKey?: string;
    className: string;
  };
  chroma?: {
    url: string;
    collectionName: string;
  };
  local?: {
    maxDocuments: number;
    persistToStorage: boolean;
  };
}
```

---

## 📊 Performance

### Benchmarks

| **Metric** | **Measurement** | **Target** | **Status** |
|------------|-----------------|------------|------------|
| **Document Processing** | 1MB PDF | < 5 seconds | ✅ |
| **Query Response Time** | Simple query | < 2 seconds | ✅ |
| **Embedding Generation** | 1000 tokens | < 1 second | ✅ |
| **UI Responsiveness** | First load | < 3 seconds | ✅ |
| **Memory Usage** | Runtime | < 500MB | ✅ |

### Performance Optimization

```typescript
// Optimization techniques implemented
const optimizations = {
  "Client-side": [
    "Code splitting with Next.js",
    "Component lazy loading",
    "Image optimization",
    "Service worker caching"
  ],
  "Server-side": [
    "API route optimization",
    "Response compression",
    "Database query optimization",
    "Edge caching"
  ],
  "AI Processing": [
    "Embedding caching",
    "Batch processing",
    "Model selection optimization",
    "Context length management"
  ]
};
```

---

## 🆘 Troubleshooting

### Common Issues

| **Issue** | **Symptoms** | **Solution** | **Prevention** |
|-----------|--------------|--------------|----------------|
| **PDF Upload Fails** | Error during upload | Check file size < 50MB, valid PDF format | Use text-based PDFs when possible |
| **AI Provider Errors** | 401/403 responses | Verify API keys, check quotas | Monitor usage limits |
| **Slow Performance** | Long response times | Check internet connection, try smaller chunks | Optimize chunk sizes |
| **OCR Not Working** | Scanned PDFs not processed | Ensure Tesseract.js loaded properly | Check browser compatibility |
| **Memory Issues** | Browser crashes | Clear cache, reduce concurrent operations | Close unused tabs |

### Debug Mode

Enable detailed logging:

```typescript
// In your .env.local
DEBUG=true
VERBOSE_LOGGING=true

// Or programmatically
localStorage.setItem('quantum-pdf-debug', 'true');
```

### Support Channels

| **Channel** | **Response Time** | **Best For** |
|-------------|-------------------|--------------|
| [GitHub Issues](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues) | 24-48 hours | Bug reports, feature requests |
| [Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions) | Community | General questions, ideas |
| [Wiki](https://github.com/Kedhareswer/QuantumPDF_ChatApp/wiki) | Immediate | Documentation, guides |

---

## 🔧 API Reference

### Core Endpoints

| **Endpoint** | **Method** | **Description** | **Parameters** |
|--------------|------------|-----------------|----------------|
| `/api/pdf/extract` | POST | Extract text from PDF | `file: File` |
| `/api/chat` | POST | Query documents | `message: string, history?: Message[]` |
| `/api/vector-db` | POST | Add to vector database | `documents: Document[]` |
| `/api/huggingface/embedding` | POST | Generate embeddings | `texts: string[]` |
| `/api/test/ai` | GET | Test AI provider | `provider: string` |
| `/api/ping` | GET/POST | Health check | None |

### Request/Response Examples

#### Chat API
```typescript
// Request
POST /api/chat
{
  "message": "What are the main findings in the research papers?",
  "history": [
    {"role": "user", "content": "Previous question"},
    {"role": "assistant", "content": "Previous response"}
  ]
}

// Response
{
  "response": "Based on the research papers, the main findings are...",
  "sources": [
    "Document 1 (page 5)",
    "Document 2 (page 12)"
  ],
  "metadata": {
    "responseTime": 1.2,
    "tokensUsed": 450,
    "relevanceScore": 0.89
  }
}
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/QuantumPDF_ChatApp.git
cd QuantumPDF_ChatApp

# 2. Install dependencies
npm install

# 3. Create feature branch
git checkout -b feature/your-feature-name

# 4. Start development
npm run dev
```

### Contribution Guidelines

| **Type** | **Description** | **Process** |
|----------|-----------------|-------------|
| 🐛 **Bug Fixes** | Fix existing issues | Issue → Branch → PR → Review |
| ✨ **Features** | Add new functionality | Discussion → Design → Implementation |
| 📚 **Documentation** | Improve docs | Direct PR for small changes |
| 🎨 **UI/UX** | Design improvements | Screenshots required in PR |
| ⚡ **Performance** | Optimization work | Benchmarks required |

### Code Standards

```typescript
// TypeScript configuration
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true
}

// ESLint + Prettier for consistent formatting
// Conventional commits for clear history
// Component testing with Jest + Testing Library
```

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**.

### License Summary

| **Permissions** | **Conditions** | **Limitations** |
|-----------------|----------------|-----------------|
| ✅ Commercial use | 📋 License and copyright notice | ❌ Liability |
| ✅ Modification | 📋 State changes | ❌ Warranty |
| ✅ Distribution | 📋 Disclose source | |
| ✅ Patent use | 📋 Same license | |
| ✅ Private use | | |

---

<div align="center">

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Kedhareswer/QuantumPDF_ChatApp&type=Date)](https://star-history.com/#Kedhareswer/QuantumPDF_ChatApp&Date)

---

### 🙏 Acknowledgments

Built with ❤️ by [Kedhareswer](https://github.com/Kedhareswer)

**Special Thanks:**
- OpenAI, Anthropic, Google AI for providing excellent LLM APIs
- Vercel for Next.js and deployment platform  
- The open-source community for amazing tools and libraries

---

[![Made with TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by Next.js](https://img.shields.io/badge/Powered%20by-Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Built with Tailwind CSS](https://img.shields.io/badge/Built%20with-Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>
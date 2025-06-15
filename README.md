<div align="center">

# 🌌 QuantumPDF ChatApp

<p align="center">
  <img src="public/placeholder-logo.svg" width="160" alt="QuantumPDF ChatApp Logo">
</p>

[![GitHub Stars](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/fork)
[![License](https://img.shields.io/github/license/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/commits/main)
[![Open Issues](https://img.shields.io/github/issues/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
[![Contributors](https://img.shields.io/github/contributors/Kedhareswer/QuantumPDF_ChatApp?style=flat-square)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/graphs/contributors)

*Transform your PDFs into interactive knowledge bases with AI-powered conversations*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

## 📑 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [Configuration](#%EF%B8%8F-configuration)
- [Performance Optimization](#-performance-optimization)
- [Troubleshooting](#-troubleshooting)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

## 🎯 Overview

QuantumPDF ChatApp is an intelligent, open-source web application that revolutionizes PDF document interaction through advanced Large Language Models (LLMs). It transforms static PDF documents into dynamic, conversational knowledge bases that you can query naturally.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| 🤖 AI-Powered Analysis | Interactive conversations with your PDFs using state-of-the-art LLMs |
| 🔍 Smart Search | Advanced semantic search capabilities across multiple documents |
| 🔐 Privacy-First | Option for local model deployment, keeping your documents secure |
| 📊 Citation Support | Automated source tracking and citation for all responses |
| ⚡ Real-time Processing | Quick document processing and response generation |

## ✨ Features

### Core Capabilities

| Feature Category | Components | Description |
|-----------------|------------|-------------|
| **Document Processing** | • Text Extraction<br>• Smart Chunking<br>• OCR Support<br>• Metadata Extraction | Advanced PDF processing using PyMuPDF with intelligent text chunking and OCR capabilities |
| **Search & Retrieval** | • Semantic Search<br>• Vector Similarity<br>• Multi-document Support | FAISS-powered vector search with Sentence Transformers for accurate content retrieval |
| **LLM Integration** | • Local Models<br>• Cloud APIs<br>• Custom Models | Flexible integration with various LLM providers and local model support |
| **User Experience** | • Interactive Chat<br>• Source Citations<br>• Dark/Light Mode | Modern Next.js frontend with responsive design and customizable themes |

## 🏗 System Architecture

```mermaid
flowchart TD
    subgraph Client[Client Side]
        UI[User Interface]
        Browser[Web Browser]
    end

    subgraph Server[Server Side]
        API[API Gateway]
        
        subgraph "Document Processing"
            DP1[PDF Upload & Validation]
            DP2[Text Extraction]
            DP3[Chunking & Indexing]
        end
        
        subgraph "AI Processing"
            AI1[Embedding Generation]
            AI2[Vector Store]
            AI3[LLM Integration]
        end
        
        subgraph "Query Processing"
            QP1[Query Understanding]
            QP2[Context Retrieval]
            QP3[Response Generation]
        end
        
        DB[(Database)]
    end
    
    UI -->|HTTP/HTTPS| API
    API --> DP1
    DP1 --> DP2 --> DP3
    DP3 --> AI1 --> AI2
    API --> QP1
    QP1 --> QP2 --> AI2
    QP2 --> QP3 --> AI3
    AI3 --> API
    DP3 --> DB
    QP2 --> DB
```

### Architecture Components

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | Next.js, React, TypeScript | Interactive user interface with responsive design |
| **API Gateway** | Next.js API Routes | Handles client requests and responses |
| **Document Processing** | PyMuPDF, Unstructured | Extracts and processes text from PDFs |
| **Vector Database** | FAISS, Chroma | Stores document embeddings for semantic search |
| **LLM Integration** | LangChain, OpenAI/Gemini | Processes queries and generates responses |
| **Caching** | Redis | Improves response times for frequent queries |

## 🛠 Technology Stack

### Core Technologies

| Layer | Technologies | Version | Purpose |
|-------|-------------|---------|----------|
| **Frontend** | ![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-13.4.0-000000?style=flat-square&logo=next.js&logoColor=white) ![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat-square&logo=react&logoColor=black) | v18+ | Interactive UI with server-side rendering |
| **Backend** | ![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-0.95.0-009688?style=flat-square&logo=fastapi&logoColor=white) | 3.9+ | High-performance API and business logic |
| **Vector Database** | ![FAISS](https://img.shields.io/badge/FAISS-1.7.3-FF6B6B?style=flat-square) ![Chroma](https://img.shields.io/badge/Chroma-0.4.0-4CAF50?style=flat-square) | Latest | Efficient similarity search and storage |
| **AI/ML** | ![PyTorch](https://img.shields.io/badge/PyTorch-2.0.0-EE4C2C?style=flat-square&logo=pytorch&logoColor=white) ![Transformers](https://img.shields.io/badge/Transformers-4.28.0-FFD700?style=flat-square) | Latest | Model inference and embeddings |
| **Deployment** | ![Docker](https://img.shields.io/badge/Docker-24.0-2496ED?style=flat-square&logo=docker&logoColor=white) ![Kubernetes](https://img.shields.io/badge/Kubernetes-1.26-326CE5?style=flat-square&logo=kubernetes&logoColor=white) | - | Containerization and orchestration |

### Key Dependencies

```yaml
# Core Backend
langchain: ^0.0.200  # LLM orchestration
pymupdf: ^1.22.0     # PDF processing
sentence-transformers: ^2.2.2  # Embeddings
faiss-cpu: ^1.7.4    # Vector similarity search

# Frontend
next: 13.4.0
react: 18.2.0
typescript: 4.9.5
@radix-ui/react-dialog: ^1.0.4

# Development
pytest: ^7.3.1
black: ^23.3.0
mypy: ^1.3.0
```

## 📦 Installation

### Prerequisites

| Requirement | Version | Description | Recommended |
|------------|---------|-------------|-------------|
| Python | ≥ 3.9 | Backend services | 3.10+ |
| Node.js | ≥ 18 | Frontend development | 18 LTS |
| RAM | ≥ 8GB | 16GB+ recommended for local LLMs | 32GB |
| Storage | 10GB+ | For models and dependencies | SSD recommended |
| GPU (Optional) | CUDA 11.8 | For accelerated processing | NVIDIA RTX 30xx+ |

### Quick Start Guide

1. **Clone and setup repository**
   ```bash
   # Clone with submodules
   git clone --recurse-submodules https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
   cd QuantumPDF_ChatApp
   ```

2. **Setup Python environment**
   ```bash
   # Create and activate virtual environment
   python -m venv .venv
   # Windows
   .\.venv\Scripts\activate
   # Unix/macOS
   source .venv/bin/activate
   
   # Install Python dependencies
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Setup Node.js environment**
   ```bash
   # Install Node.js dependencies
   npm install
   
   # Copy environment variables
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Start the application**
   ```bash
   # Terminal 1: Start backend
   uvicorn app.main:app --reload
   
   # Terminal 2: Start frontend
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

### Docker Setup (Alternative)

```bash
# Build and start containers
docker-compose up --build

# View logs
docker-compose logs -f
```

## 🎮 Usage Guide

### Basic Operations

| Operation | Command/Action | Description |
|-----------|---------------|-------------|
| Start Application | `http://localhost:3000` | Access the web interface |
| Upload Documents | Drag & Drop / Click Upload | Support for single/multiple PDFs |
| Query Documents | Type in chat interface | Natural language questions |
| View Sources | Click on citations | See source context |

### Advanced Features

| Feature | Configuration | Use Case |
|---------|--------------|-----------|
| Custom Models | Edit `app.py` | Integration of specialized LLMs |
| Batch Processing | Upload multiple PDFs | Compare across documents |
| Export Results | Download button | Save conversations and citations |

## ⚙️ Configuration

### Environment Variables

```env
# API Keys
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
AIML_API_KEY=your_aiml_key

# Optional Configuration
WANDB_API_KEY=your_wandb_key
MAX_TOKENS=500
CHUNK_OVERLAP=50
```

### Model Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Chunk Size | 500 tokens | Text segment size for processing |
| Overlap | 50 tokens | Overlap between chunks |
| Memory Size | 10 turns | Conversation history length |
| Embedding Model | all-MiniLM-L6-v2 | Default embedding model |

## ⚡ Performance Optimization

### Hardware Recommendations

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8GB | 16GB+ |
| CPU | 4 cores | 8+ cores |
| GPU | Optional | CUDA-enabled |
| Storage | 10GB | 20GB+ SSD |

### Optimization Tips

- Enable GPU acceleration for local models
- Implement caching for frequent queries
- Optimize chunk sizes based on document type
- Use batch processing for multiple documents

## 🆘 Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| PDF Upload Fails | File size/format | Check size limits, file format |
| Slow Processing | Resource constraints | Adjust chunk size, enable GPU |
| API Errors | Invalid keys/limits | Verify API keys, check quotas |
| Memory Issues | Large documents | Adjust batch size, clear cache |

## 🤝 Contributing

We welcome contributions! Please check our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code of Conduct
- Pull Request Process
- Development Setup
- Coding Standards

## 📄 License

This project is licensed under the [GNU GPL v3.0](LICENSE).

## 💬 Support

- [GitHub Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions)
- [Issue Tracker](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
- [Documentation](https://github.com/Kedhareswer/QuantumPDF_ChatApp/wiki)

---

<div align="center">

Made with ❤️ by Kedhareswer

[![Star History](https://img.shields.io/badge/dynamic/json?color=blue&label=Stars&query=stargazers_count&url=https://api.github.com/repos/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)

</div>
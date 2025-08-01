<div align="center">

# [![QuantumPDF ChatApp](https://img.shields.io/badge/QuantumPDF-ChatApp-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3TDEyIDJ6Ii8+PC9zdmc+)](https://github.com/Kedhareswer/QuantumPDF_ChatApp)

</div>

<div align="center">

**AI-Powered PDF Document Analysis & Chat Platform**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [How It Works](#-how-it-works)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Use Cases](#-use-cases)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Example Prompts](#-example-prompts)
- [Performance](#-performance)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

QuantumPDF ChatApp enables intelligent conversations with PDF documents. Built with Next.js 15 and React 19, it uses Retrieval-Augmented Generation (RAG) to provide accurate, context-aware responses from your documents.

### What Makes It Different

- **Multi-phase RAG processing** for improved accuracy
- **20+ AI provider support** for flexibility
- **Client-side PDF processing** for privacy
- **Adaptive chunk sizing** for optimal performance
- **Document pre-filtering** for targeted searches
- **Real-time quality metrics** for transparency

---

## How to use this
### Step-1: Setup api keys
![Step 1](/public/Step-1.gif)

### Step-2: Connect to Local(slow) or other Vector Databases
![Step 2](/public/Step-2.gif)

### Step-3: Upload PDF Files 1 or 10(max tested)
![Step 3](/public/Step-3.gif)

### Step-4: Ask your questions
![Step 4](/public/Step-4.gif)


## 🔧 How It Works

### Core Processing Flow

```mermaid
graph LR
    A[PDF Upload] --> B[Text Extraction]
    B --> C[Adaptive Chunking]
    C --> D[Embedding Generation]
    D --> E[Vector Storage]
    
    F[User Question] --> G[Query Analysis]
    G --> H[Document Filtering]
    H --> I[Similarity Search]
    I --> J[Context Retrieval]
    J --> K[AI Response Generation]
    K --> L[Quality Validation]
    L --> M[Final Answer]
```

### PDF Chunking & Vector Processing

```mermaid
graph TD
    A[PDF Document] --> B[Text Extraction]
    B --> C[Adaptive Chunking]
    C --> D["Chunk 1<br/>300-1200 tokens"]
    C --> E["Chunk 2<br/>10% overlap"]
    C --> F["Chunk 3<br/>Semantic boundaries"]
    C --> G["Chunk N<br/>..."]
    
    D --> H[Generate Embedding]
    E --> I[Generate Embedding]
    F --> J[Generate Embedding]
    G --> K[Generate Embedding]
    
    H --> L["Vector 1<br/>0.1, 0.3, -0.2, ..."]
    I --> M["Vector 2<br/>0.4, -0.1, 0.8, ..."]
    J --> N["Vector 3<br/>0.2, 0.7, -0.5, ..."]
    K --> O["Vector N<br/>..."]
    
    L --> P[Vector Database]
    M --> P
    N --> P
    O --> P
    
    P --> Q[Similarity Search]
    Q --> R[Retrieved Chunks]
    R --> S[AI Response Generation]
```

### Document Storage & Retrieval

```mermaid
graph LR
    subgraph "Document Processing"
        A[PDF Page 1] --> A1["Chunk 1<br/>Size: 800 tokens<br/>Overlap: 80 tokens"]
        A --> A2["Chunk 2<br/>Size: 800 tokens<br/>Overlap: 80 tokens"]
        B[PDF Page 2] --> B1["Chunk 3<br/>Size: 600 tokens<br/>Overlap: 60 tokens"]
        B --> B2["Chunk 4<br/>Size: 900 tokens<br/>Overlap: 90 tokens"]
    end
    
    subgraph "Vector Database Storage"
        VDB[(Vector Database)]
        A1 --> V1["Vector ID: doc1_chunk1<br/>Embedding: 1536 dims<br/>Metadata: page=1, start=0"]
        A2 --> V2["Vector ID: doc1_chunk2<br/>Embedding: 1536 dims<br/>Metadata: page=1, start=720"]
        B1 --> V3["Vector ID: doc1_chunk3<br/>Embedding: 1536 dims<br/>Metadata: page=2, start=0"]
        B2 --> V4["Vector ID: doc1_chunk4<br/>Embedding: 1536 dims<br/>Metadata: page=2, start=540"]
        
        V1 --> VDB
        V2 --> VDB
        V3 --> VDB
        V4 --> VDB
    end
    
    subgraph "Query Processing"
        Q[User Query] --> QE[Query Embedding]
        QE --> VDB
        VDB --> SR["Similarity Results<br/>Chunk 3: 0.95<br/>Chunk 1: 0.87<br/>Chunk 4: 0.82"]
        SR --> RC[Retrieved Chunks]
        RC --> AI[AI Response]
    end
```

### Chunk Placement & Vector Space

```mermaid
graph TD
    subgraph "Chunk Placement Strategy"
        A[Original Text] --> B[Sentence Boundary Detection]
        B --> C[Adaptive Sizing]
        C --> D["Small Doc: 300-600 tokens<br/>Medium Doc: 600-900 tokens<br/>Large Doc: 900-1200 tokens"]
        D --> E[Overlap Calculation]
        E --> F["10% overlap<br/>Maintains context<br/>Prevents information loss"]
    end
    
    subgraph "Vector Space Representation"
        G[High-Dimensional Space] --> H[Cluster 1: Technical Terms]
        G --> I[Cluster 2: Concepts]
        G --> J[Cluster 3: Procedures]
        
        H --> H1["Vector A<br/>Distance: 0.1"]
        H --> H2["Vector B<br/>Distance: 0.15"]
        I --> I1["Vector C<br/>Distance: 0.3"]
        J --> J1["Vector D<br/>Distance: 0.8"]
    end
    
    subgraph "Similarity Search Process"
        K[Query Vector] --> L[Cosine Similarity]
        L --> M["Score > 0.7: Highly Relevant<br/>Score 0.5-0.7: Moderately Relevant<br/>Score < 0.5: Less Relevant"]
        M --> N[Top-K Selection]
        N --> O[Context Assembly]
    end
    
    F --> G
    O --> P[Final Response]
```

### Technical Components

1. **PDF Processing**
   - Uses PDF.js for text extraction
   - Supports OCR via Tesseract.js for scanned documents
   - Preserves document structure and metadata

2. **Intelligent Chunking**
   - Dynamically adjusts chunk size based on document length
   - Maintains semantic boundaries
   - Optimizes for model context windows

3. **Vector Search**
   - Generates embeddings using configured AI provider
   - Stores in vector database (Pinecone, ChromaDB, etc.)
   - Performs cosine similarity search

4. **RAG Engine**
   - Retrieves relevant document chunks
   - Applies pre-filters (author, date, tags)
   - Generates contextual responses

---

## 📊 **Chunking & Vector Processing Details**

### **Adaptive Chunking Strategy**

The system uses intelligent chunking that adapts to document characteristics:

| Document Size | Chunk Size | Overlap | Reasoning |
|---------------|------------|---------|-----------|
| **Small** (< 10 pages) | 300-600 tokens | 10% | Preserve context in short docs |
| **Medium** (10-50 pages) | 600-900 tokens | 10% | Balance context and processing |
| **Large** (50+ pages) | 900-1200 tokens | 10% | Maximize context window usage |

### **Vector Database Storage**

Each chunk is stored with rich metadata:

```json
{
  "id": "doc1_chunk1",
  "vector": [0.1, 0.3, -0.2, ...], // 1536 dimensions
  "metadata": {
    "document_id": "doc1",
    "page": 1,
    "start_char": 0,
    "end_char": 800,
    "chunk_index": 0,
    "title": "Document Title",
    "author": "Author Name",
    "upload_date": "2024-01-01"
  },
  "content": "Original text content..."
}
```

### **Similarity Search Process**

1. **Query Embedding**: User question → vector representation
2. **Cosine Similarity**: Compare query vector with all chunk vectors
3. **Scoring**: Calculate relevance scores (0.0 to 1.0)
4. **Filtering**: Apply metadata filters (author, date, tags)
5. **Ranking**: Sort by similarity score + metadata relevance
6. **Selection**: Choose top-K most relevant chunks

### **Context Assembly**

Retrieved chunks are assembled with consideration for:
- **Proximity**: Chunks from same document section
- **Diversity**: Avoid redundant information
- **Token Limits**: Fit within model context window
- **Relevance**: Maintain quality threshold

---

## ✨ Key Features

### Document Processing

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Client-side Processing** | PDFs processed in browser | Privacy & speed |
| **Adaptive Chunking** | Dynamic chunk sizing | Better context preservation |
| **Metadata Extraction** | Author, date, title extraction | Enhanced filtering |
| **OCR Support** | Process scanned documents | Broader compatibility |

### AI Capabilities

| Provider | Models | Use Case |
|----------|--------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | General purpose, high quality |
| **Anthropic** | Claude 3 | Long context, analysis |
| **Google AI** | Gemini Pro | Multimodal capabilities |
| **Groq** | Llama 3, Mixtral | Fast inference |
| **Local Models** | Via Ollama | Privacy-focused |

### Search & Retrieval

- **Semantic Search**: Find content by meaning
- **Keyword Search**: Exact text matching
- **Hybrid Search**: Best of both approaches
- **Pre-filtering**: Filter by author, date, tags, documents
- **Similarity Threshold**: Adjustable relevance scoring

---

## 🏗️ Architecture

### Entity Relationship

```mermaid
erDiagram
    User {
        string id
        string name
        string email
        datetime created_at
    }
    Document {
        string id
        string title
        string author
        datetime upload_date
        string file_path
        string metadata
    }
    Chunk {
        string id
        string content
        int token_count
        vector embedding
        string document_id
    }
    Chat {
        string id
        string user_id
        datetime timestamp
        string context
    }
    Message {
        string id
        string chat_id
        string content
        string role
        datetime timestamp
    }

    User ||--o{ Document : uploads
    Document ||--o{ Chunk : contains
    User ||--o{ Chat : participates
    Chat ||--o{ Message : contains
    Message }o--|| Chunk : references
```

### User Interaction Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Web Interface
    participant API as API Routes
    participant PDF as PDF Processor
    participant VDB as Vector Database
    participant AI as AI Service

    User->>UI: Upload PDF
    UI->>PDF: Process Document
    PDF-->>UI: Extracted Text
    UI->>API: Send Text Chunks
    API->>AI: Generate Embeddings
    AI-->>API: Embeddings
    API->>VDB: Store Vectors

    Note over User,VDB: Document Processing Complete

    User->>UI: Ask Question
    UI->>API: Send Query
    API->>AI: Generate Query Embedding
    AI-->>API: Query Vector
    API->>VDB: Search Similar Chunks
    VDB-->>API: Relevant Contexts
    API->>AI: Generate Response
    AI-->>API: Final Answer
    API-->>UI: Display Response
    UI-->>User: Show Answer
```

### System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   API Routes    │     │   AI Services   │
│                 │     │                 │     │                 │
│ • React 19      │────▶│ • PDF Extract   │────▶│ • OpenAI        │
│ • Next.js 15    │     │ • Chat Handler  │     │ • Anthropic     │
│ • Tailwind CSS  │     │ • Vector DB     │     │ • Google AI     │
│ • Radix UI      │     │ • Search        │     │ • 20+ Providers │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Vector Database      │
                    │                         │
                    │ • Pinecone              │
                    │ • ChromaDB              │
                    │ • Weaviate              │
                    │ • Local Storage         │
                    └─────────────────────────┘
```

### Data Flow

1. **Document Upload** → PDF.js extraction → Adaptive chunking
2. **Embedding Generation** → AI provider → Vector storage
3. **User Query** → Embedding → Similarity search
4. **Context Retrieval** → Filtered chunks → AI generation
5. **Response** → Quality metrics → User interface

---

## 💡 Use Cases

### Academic Research
- **Challenge**: Analyzing multiple research papers
- **Solution**: Upload PDFs, ask comparative questions
- **Example**: "Compare the methodologies used in these papers"

### Legal Document Review
- **Challenge**: Finding specific clauses in contracts
- **Solution**: Semantic search with keyword precision
- **Example**: "Find all termination clauses with 30-day notice"

### Technical Documentation
- **Challenge**: Quick answers from extensive docs
- **Solution**: Natural language queries
- **Example**: "How do I configure authentication?"

### Business Reports
- **Challenge**: Extracting insights from reports
- **Solution**: Analytical questions with data extraction
- **Example**: "What were the Q3 revenue trends?"

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- PNPM package manager
- AI provider API key (at least one)

### Installation

```bash
# Clone repository
git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
cd QuantumPDF_ChatApp

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
pnpm dev
```

### First Steps

1. **Configure AI Provider**: Settings → AI Configuration
2. **Upload PDF**: Documents → Upload Document
3. **Start Chatting**: Ask questions about your documents

---

## ⚙️ Configuration

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **AI Provider** | LLM for chat responses | Required |
| **Embedding Model** | Model for vector generation | Provider default |
| **Vector Database** | Storage for embeddings | Local storage |
| **Chunk Size** | Text segment size | Adaptive (300-1200) |
| **Overlap** | Chunk overlap percentage | 10% |

---

## 📝 Example Prompts

### Information Extraction
```
"What are the key findings in this research paper?"
"List all the requirements mentioned in section 3"
"Extract the financial data from the annual report"
```

### Analysis & Comparison
```
"Compare the approaches described in chapters 2 and 5"
"What are the pros and cons of the proposed solution?"
"How does this contract differ from the standard template?"
```

### Specific Searches
```
"Find all mentions of 'machine learning' with their context"
"What does the document say about data privacy?"
"Show me the conclusion section"
```

### Complex Queries
```
"Summarize the methodology and results, focusing on statistical significance"
"What are the legal implications of clause 7.3 combined with section 12?"
"Based on the financial statements, calculate the year-over-year growth"
```

---

## ⚡ Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| PDF Processing (1MB) | ~12s | Client-side |
| Embedding Generation | ~4.5s | Depends on provider |
| Vector Search | <100ms | 1000 chunks |
| Chat Response | 2-5s | Varies by complexity |

### Optimization Features

- **Adaptive Chunking**: Reduces API calls by 30-40%
- **Pre-filtering**: Speeds up search by limiting scope
- **Client-side Processing**: No upload delays
- **Response Caching**: Faster repeated queries

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- Additional AI provider integrations
- Performance optimizations
- UI/UX improvements
- Documentation and examples
- Bug fixes and testing

---

## 📄 License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Kedhareswer/QuantumPDF_ChatApp&type=Date)](https://star-history.com/#Kedhareswer/QuantumPDF_ChatApp&Date)

---

<div align="center">

If you find this project helpful, please consider giving it a ⭐

</div>

# QuantumPDF Architecture & Flow Diagrams

> **Comprehensive visual guide to system architecture, data flows, and component interactions**
> **Last Updated: November 2025 | Version 3.0.0**

## Table of Contents
- [System Overview](#system-overview)
- [Core Architecture](#core-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Component Interactions](#component-interactions)
- [Processing Pipelines](#processing-pipelines)
- [Domain Agents System](#domain-agents-system)
- [Multimodal Processing](#multimodal-processing)
- [State Management](#state-management)

---

## System Overview

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI Components]
        STATE[Zustand State Store]
        PWA[PWA Service Worker]
        AGENT_UI[Agent Selector UI]
    end

    subgraph "Processing Layer"
        PDF[PDF Parser<br/>PDF.js + Tesseract]
        RAG[RAG Engine<br/>3-Phase Processing]
        CHUNK[Advanced Chunking<br/>Semantic Aware]
        MULTI[Multimodal Extraction<br/>Images/Tables/Equations]
    end

    subgraph "AI Layer"
        AI[AI Client<br/>19+ Providers]
        EMB[Embedding Generation<br/>with Fallback]
        TEXT[Text Generation<br/>Streaming Support]
        AGENTS[Domain Agents<br/>Specialized Analysis]
        LOCAL[Local Models<br/>Transformers.js]
    end

    subgraph "Storage Layer"
        VDB[(Vector Database<br/>Pinecone/Weaviate/<br/>Local In-Memory)]
        CACHE[Browser Cache<br/>IndexedDB]
    end

    UI -->|User Actions| STATE
    AGENT_UI -->|Agent Selection| AGENTS
    STATE -->|Document Upload| PDF
    PDF -->|Extracted Text| CHUNK
    PDF -->|Multimodal Data| MULTI
    CHUNK -->|Text Chunks| RAG
    RAG -->|Generate Embeddings| AI
    AI -->|Embeddings| VDB
    UI -->|Query| RAG
    RAG -->|Search| VDB
    VDB -->|Retrieved Chunks| RAG
    RAG -->|Run Agent| AGENTS
    AGENTS -->|Specialized Analysis| AI
    RAG -->|Generate Response| AI
    AI -->|Answer| UI
    PWA -->|Offline Support| CACHE
    STATE -->|Persist Config| CACHE
    LOCAL -->|Summarization| AGENTS

    style UI fill:#e1f5ff
    style RAG fill:#fff4e1
    style AI fill:#f3e1ff
    style VDB fill:#e1ffe1
    style AGENTS fill:#ffe1e8
    style MULTI fill:#e1f0ff
```

### Technology Stack

```mermaid
graph LR
    subgraph "Frontend"
        NEXT[Next.js 15.2.4]
        REACT[React 19]
        TS[TypeScript 5]
        TAIL[TailwindCSS 3.4]
    end

    subgraph "State & Data"
        ZUS[Zustand]
        IDB[IndexedDB]
        LOCAL[LocalStorage]
    end

    subgraph "Document Processing"
        PDFJS[PDF.js]
        TESS[Tesseract.js]
        MAMMOTH[Mammoth.js]
        SHEETJS[SheetJS/Papa Parse]
    end

    subgraph "AI Providers"
        OAI[OpenAI]
        ANT[Anthropic]
        GROQ[Groq]
        HF[HuggingFace]
        MORE[+15 More]
    end

    subgraph "Local AI"
        TRANS[Transformers.js]
        MATHPIX[Mathpix OCR]
    end

    subgraph "Vector DBs"
        PINE[Pinecone]
        WEAV[Weaviate]
        MEM[Local In-Memory]
    end

    NEXT --> REACT
    REACT --> TS
    TS --> TAIL
    ZUS --> IDB
    ZUS --> LOCAL
    PDFJS --> TESS

    style NEXT fill:#000,color:#fff
    style REACT fill:#61dafb
    style TS fill:#3178c6,color:#fff
    style TRANS fill:#ff6f61
    style MATHPIX fill:#6b5b95
```

---

## Core Architecture

### RAG Engine Architecture

```mermaid
graph TD
    subgraph "RAG Engine Core"
        INIT[Initialize with AI Config]
        DOC[Document Management]
        EMB[Embedding Manager]
        QUERY[Query Processor]
        AGENT_MGR[Agent Manager]
    end

    subgraph "3-Phase Query Processing"
        P1[Phase 1: Context Analysis<br/>- Generate query embedding<br/>- Retrieve relevant chunks<br/>- Apply diversity algorithm<br/>- Generate initial response]
        P2[Phase 2: Self-Critique<br/>- Validate accuracy<br/>- Check completeness<br/>- Identify improvements]
        P3[Phase 3: Refinement<br/>- Apply improvements<br/>- Clean artifacts<br/>- Calculate quality metrics]
    end

    subgraph "Domain Agents"
        ANALOGY[Analogy Maker Agent<br/>Simple explanations]
        COMPLY[Compliance Checker<br/>Legal/policy analysis]
        KEYTERMS[Key Terms Extractor<br/>Vocabulary & definitions]
        SUMMARY[Summary Agent<br/>Local model summarization]
    end

    subgraph "Supporting Systems"
        DIV[Diversity Algorithm<br/>- Multi-document fairness<br/>- Semantic importance<br/>- Source distribution]
        TOKEN[Token Budget Manager<br/>- Adaptive allocation<br/>- Context optimization]
        QUALITY[Quality Metrics<br/>- Accuracy score<br/>- Completeness score<br/>- Clarity score<br/>- Confidence score]
    end

    INIT --> DOC
    DOC --> EMB
    EMB --> QUERY
    QUERY --> P1
    P1 --> P2
    P2 --> P3
    P1 -.-> DIV
    P1 -.-> TOKEN
    P3 -.-> QUALITY
    QUERY --> AGENT_MGR
    AGENT_MGR --> ANALOGY
    AGENT_MGR --> COMPLY
    AGENT_MGR --> KEYTERMS
    AGENT_MGR --> SUMMARY

    style P1 fill:#e3f2fd
    style P2 fill:#fff3e0
    style P3 fill:#f3e5f5
    style QUALITY fill:#e8f5e9
    style ANALOGY fill:#fce4ec
    style COMPLY fill:#e8eaf6
    style KEYTERMS fill:#e0f7fa
    style SUMMARY fill:#f3e5f5
```

### Multi-Provider AI Client Architecture

```mermaid
graph TB
    subgraph "AI Client Interface"
        CONFIG[Configuration<br/>Provider + Model + API Key]
        GEN[Generate Embeddings]
        CHAT[Generate Text]
        STREAM[Stream Text]
        TEST[Test Connection]
    end

    subgraph "Provider Implementations"
        OAI[OpenAI API]
        ANT[Anthropic API]
        GROQ[Groq API]
        AIML[AIML API]
        FW[Fireworks API]
        DI[DeepInfra API]
        OTHERS[+13 More Providers]
    end

    subgraph "Local Models"
        TFJS[Transformers.js<br/>Xenova/distilbart-cnn-6-6]
        CAPTION[Image Captioning<br/>Xenova/vit-gpt2-image-captioning]
        TEXTGEN[Text Generation<br/>Xenova/distilgpt2]
    end

    subgraph "Fallback System"
        RETRY[Retry Logic]
        HASHEMB[Hash-Based<br/>Embedding<br/>1536-dim]
        NOSTREAM[Non-Streaming<br/>Fallback]
    end

    CONFIG --> GEN
    CONFIG --> CHAT
    CONFIG --> STREAM
    CONFIG --> TEST

    GEN -->|Route by Provider| OAI
    GEN -->|Route by Provider| ANT
    GEN -->|Route by Provider| GROQ
    GEN -->|Route by Provider| AIML
    GEN -->|Route by Provider| FW
    GEN -->|Route by Provider| DI
    GEN -->|Route by Provider| OTHERS

    GEN -.->|On Failure| HASHEMB
    STREAM -.->|On Failure| NOSTREAM
    CHAT -->|Local Option| TFJS

    style CONFIG fill:#fff9c4
    style HASHEMB fill:#ffebee
    style NOSTREAM fill:#ffebee
    style TFJS fill:#e8f5e9
    style CAPTION fill:#e8f5e9
```

---

## Data Flow Diagrams

### Document Upload & Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant PDF as Enhanced PDF Processor
    participant MULTI as Multimodal Extractor
    participant CHUNK as Chunking Engine
    participant AI as AI Client
    participant VDB as Vector Database
    participant STORE as Zustand Store

    User->>UI: Upload PDF File
    UI->>PDF: Process Document

    activate PDF
    PDF->>PDF: Load with PDF.js
    PDF->>PDF: Extract Text per Page
    PDF->>PDF: Extract Metadata
    PDF->>MULTI: Extract Multimodal Content
    
    activate MULTI
    MULTI->>MULTI: Extract Images
    MULTI->>MULTI: Extract Tables
    MULTI->>MULTI: Extract Equations (Mathpix)
    MULTI->>MULTI: Generate Image Captions
    MULTI-->>PDF: Multimodal Data
    deactivate MULTI
    
    PDF-->>UI: ProcessedDocument {text, images, tables, equations}
    deactivate PDF

    UI->>CHUNK: Chunk Text
    activate CHUNK
    CHUNK->>CHUNK: Calculate Adaptive Parameters
    CHUNK->>CHUNK: Detect Code Blocks & Tables
    CHUNK->>CHUNK: Split at Boundaries
    CHUNK->>CHUNK: Apply Overlap
    CHUNK-->>UI: Text Chunks[] with Metadata
    deactivate CHUNK

    UI->>AI: Generate Embeddings
    activate AI
    loop For Each Chunk
        AI->>AI: Call Provider API
        AI->>AI: Fallback if Needed
    end
    AI-->>UI: Embeddings[][]
    deactivate AI

    UI->>STORE: Add Document
    UI->>VDB: Store Vectors
    activate VDB
    VDB->>VDB: Index Vectors
    VDB-->>UI: Success
    deactivate VDB

    UI-->>User: Document Ready
```

### Query Processing Flow (3-Phase RAG with Agents)

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant AGENT_SEL as Agent Selector
    participant RAG as RAG Engine
    participant AGENT as Domain Agent
    participant AI as AI Client
    participant VDB as Vector Database

    User->>UI: Ask Question
    User->>AGENT_SEL: Select Agent (Optional)
    UI->>RAG: query(question, options, selectedAgent)

    activate RAG

    Note over RAG: PHASE 1: Context Analysis
    RAG->>AI: Generate Query Embedding
    AI-->>RAG: Query Vector

    RAG->>VDB: Search Similar Chunks
    activate VDB
    VDB->>VDB: Cosine Similarity
    VDB->>VDB: Apply Filters
    VDB-->>RAG: Relevant Chunks
    deactivate VDB

    RAG->>RAG: Apply Diversity Algorithm
    RAG->>RAG: Optimize for Token Budget
    RAG->>AI: Generate Initial Response
    AI-->>RAG: Initial Answer

    alt Agent Selected
        Note over RAG,AGENT: Run Domain Agent
        RAG->>AGENT: Process with Agent
        AGENT->>AI: Agent-Specific Analysis
        AI-->>AGENT: Agent Response
        AGENT-->>RAG: Enhanced Analysis
    end

    alt Complexity: Normal or Complex
        Note over RAG: PHASE 2: Self-Critique
        RAG->>AI: Critique Response
        AI-->>RAG: Identified Issues
    end

    Note over RAG: PHASE 3: Refinement
    alt Has Critique
        RAG->>AI: Generate Refined Response
        AI-->>RAG: Refined Answer
    end

    RAG->>RAG: Clean Artifacts
    RAG->>RAG: Calculate Quality Metrics
    RAG-->>UI: EnhancedQueryResponse + Agent Output
    deactivate RAG

    UI-->>User: Display Answer with Sources & Agent Analysis
```

---

## Domain Agents System

### Agent Architecture

```mermaid
graph TB
    subgraph "Agent Manager"
        MGR[Agent Manager<br/>Orchestration & Selection]
    end

    subgraph "Available Agents"
        A1[Analogy Maker Agent<br/>- Simplifies complex concepts<br/>- Uses everyday analogies<br/>- For educational contexts]
        A2[Compliance Checker Agent<br/>- Legal document analysis<br/>- Policy gap detection<br/>- Risk identification]
        A3[Key Terms Extractor<br/>- Vocabulary extraction<br/>- Definition generation<br/>- Domain terminology]
        A4[Summary Agent<br/>- Concise summaries<br/>- Uses local models<br/>- Token-efficient]
    end

    subgraph "Agent Processing"
        INPUT[Retrieved Context + Query]
        PROMPT[Agent-Specific Prompt]
        PROCESS[AI Processing]
        OUTPUT[Specialized Analysis]
    end

    subgraph "Integration Points"
        UI[Agent Selector UI]
        RAG[RAG Engine Query]
        STORE[State Management]
    end

    UI -->|User Selection| MGR
    MGR --> A1
    MGR --> A2
    MGR --> A3
    MGR --> A4
    
    INPUT --> PROMPT
    PROMPT --> PROCESS
    PROCESS --> OUTPUT
    
    RAG -->|Context| INPUT
    OUTPUT -->|Results| RAG

    style A1 fill:#fce4ec
    style A2 fill:#e8eaf6
    style A3 fill:#e0f7fa
    style A4 fill:#f3e5f5
    style MGR fill:#fff9c4
```

### Agent Selection Flow

```mermaid
sequenceDiagram
    participant User
    participant AgentSelector as Agent Selector UI
    participant Store as Zustand Store
    participant RAG as RAG Engine
    participant Agent as Selected Agent
    participant AI as AI Client

    User->>AgentSelector: Select Agent Type
    AgentSelector->>Store: Update selectedAgent
    AgentSelector->>Store: Update agentSettings

    User->>RAG: Submit Query
    RAG->>Store: Get selectedAgent
    
    alt Agent Selected
        RAG->>Agent: Initialize Agent
        Agent->>Agent: Build Specialized Prompt
        Agent->>AI: Generate Analysis
        AI-->>Agent: Agent Response
        Agent-->>RAG: Structured Analysis
        RAG->>RAG: Merge with RAG Response
    end
    
    RAG-->>User: Combined Response
```

---

## Multimodal Processing

### Multimodal Extraction Pipeline

```mermaid
graph TD
    START[PDF Document] --> PARSE[PDF.js Parsing]
    
    PARSE --> TEXT[Text Extraction]
    PARSE --> IMG[Image Extraction]
    PARSE --> TBL[Table Detection]
    PARSE --> EQ[Equation Detection]
    
    subgraph "Text Processing"
        TEXT --> CHUNK[Semantic Chunking]
        CHUNK --> EMB[Embedding Generation]
    end
    
    subgraph "Image Processing"
        IMG --> EXTRACT_IMG[Extract Embedded Images]
        EXTRACT_IMG --> CAPTION[Image Captioning<br/>Xenova/vit-gpt2-image-captioning]
        CAPTION --> IMG_META[Image Metadata]
    end
    
    subgraph "Table Processing"
        TBL --> DETECT_TBL[Detect Table Patterns]
        DETECT_TBL --> PARSE_TBL[Parse Table Structure]
        PARSE_TBL --> TBL_META[Table Metadata]
    end
    
    subgraph "Equation Processing"
        EQ --> REGEX[Regex Detection]
        EQ --> MATHPIX[Mathpix OCR<br/>Professional Math OCR]
        REGEX --> LATEX[LaTeX Output]
        MATHPIX --> LATEX
        LATEX --> MATHML[MathML + ASCII]
        MATHML --> RENDER[KaTeX Rendering]
    end
    
    EMB --> VDB[(Vector Storage)]
    IMG_META --> DOC[Document Record]
    TBL_META --> DOC
    RENDER --> DOC
    
    style CAPTION fill:#e8f5e9
    style MATHPIX fill:#e3f2fd
    style VDB fill:#e1ffe1
```

### Mathpix Integration Flow

```mermaid
sequenceDiagram
    participant PDF as PDF Processor
    participant EQ as Equation Extractor
    participant MATHPIX as Mathpix Service
    participant EVAL as Math Evaluator

    PDF->>EQ: Extract Equations
    
    alt Mathpix Enabled
        EQ->>EQ: Render Pages as Images
        loop For Each Page
            EQ->>MATHPIX: Send Page Image
            MATHPIX->>MATHPIX: OCR Processing
            MATHPIX-->>EQ: LaTeX + MathML + Text
        end
    else Regex Fallback
        EQ->>EQ: Regex Pattern Detection
        EQ->>EQ: Extract LaTeX Patterns
    end
    
    EQ->>EVAL: Parse Expressions
    EVAL->>EVAL: math.js Evaluation
    EVAL-->>EQ: Simplified Results
    
    EQ-->>PDF: ExtractedEquation[]
```

---

## Processing Pipelines

### Adaptive Chunking Pipeline

```mermaid
graph TD
    START[Extracted Text] --> LENGTH{Text Length?}

    LENGTH -->|> 20K chars| LARGE[Large Doc<br/>Chunk Size: 1000<br/>Overlap: 100]
    LENGTH -->|10K - 20K| MEDIUM[Medium Doc<br/>Chunk Size: 800<br/>Overlap: 80]
    LENGTH -->|5K - 10K| SMALL[Small Doc<br/>Chunk Size: 600<br/>Overlap: 60]
    LENGTH -->|< 5K| TINY[Tiny Doc<br/>Chunk Size: 400<br/>Overlap: 40]

    LARGE --> DETECT
    MEDIUM --> DETECT
    SMALL --> DETECT
    TINY --> DETECT

    DETECT[Detect Special Content]
    DETECT --> CODE{Code Block?}
    DETECT --> TABLE{Table?}
    DETECT --> IMG_CAP{Image Caption?}
    
    CODE -->|Yes| ATOMIC_CODE[Preserve as Atomic Unit]
    TABLE -->|Yes| ATOMIC_TBL[Preserve as Atomic Unit]
    IMG_CAP -->|Yes| ATOMIC_IMG[Preserve as Atomic Unit]
    
    CODE -->|No| BOUNDARY
    TABLE -->|No| BOUNDARY
    IMG_CAP -->|No| BOUNDARY

    BOUNDARY[Find Sentence Boundaries]
    ATOMIC_CODE --> BOUNDARY
    ATOMIC_TBL --> BOUNDARY
    ATOMIC_IMG --> BOUNDARY
    
    BOUNDARY --> PRESERVE[Preserve Page Markers]
    PRESERVE --> OVERLAP[Apply Overlap]
    OVERLAP --> VALIDATE[Validate Chunks]

    VALIDATE --> META[Add Chunk Metadata<br/>- Index<br/>- Start/End Position<br/>- Type (paragraph/code/table/image)<br/>- Semantic Importance]
    META --> OUTPUT[Text Chunks Array]

    style START fill:#e1f5ff
    style OUTPUT fill:#e8f5e9
    style LARGE fill:#ffebee
    style MEDIUM fill:#fff9c4
    style SMALL fill:#e0f2f1
    style TINY fill:#f3e5f5
    style ATOMIC_CODE fill:#e8eaf6
    style ATOMIC_TBL fill:#e8eaf6
```

### Multi-Format Document Processing

```mermaid
graph TD
    subgraph "File Input"
        PDF[PDF Files]
        XLSX[Excel Files<br/>XLSX/XLS]
        CSV[CSV/TSV Files]
        DOCX[Word Files<br/>DOCX/DOC]
    end
    
    subgraph "Processors"
        PDF_PROC[Enhanced PDF Processor<br/>PDF.js + Tesseract.js]
        SHEET_PROC[Spreadsheet Processor<br/>SheetJS + PapaParse]
        DOCX_PROC[DOCX Processor<br/>Mammoth.js]
    end
    
    subgraph "Output"
        TEXT_OUT[Extracted Text]
        META_OUT[Document Metadata]
        STRUCT_OUT[Structured Data]
    end
    
    PDF --> PDF_PROC
    XLSX --> SHEET_PROC
    CSV --> SHEET_PROC
    DOCX --> DOCX_PROC
    
    PDF_PROC --> TEXT_OUT
    PDF_PROC --> META_OUT
    PDF_PROC --> STRUCT_OUT
    
    SHEET_PROC --> TEXT_OUT
    SHEET_PROC --> META_OUT
    SHEET_PROC --> STRUCT_OUT
    
    DOCX_PROC --> TEXT_OUT
    DOCX_PROC --> META_OUT
    
    TEXT_OUT --> CHUNK[Chunking Engine]
    CHUNK --> EMB[Embedding Generation]
    
    style PDF fill:#e3f2fd
    style XLSX fill:#e8f5e9
    style CSV fill:#fff3e0
    style DOCX fill:#fce4ec
```

---

## State Management

### Application State Structure

```typescript
interface AppState {
  // Session State (Not Persisted)
  messages: Message[]           // Chat history
  documents: Document[]         // Uploaded documents
  isProcessing: boolean        // Processing state
  modelStatus: ModelStatus     // AI model status
  errors: ErrorMessage[]       // Error messages

  // Persisted State
  aiConfig: AIConfig           // AI provider configuration
  vectorDBConfig: VectorDBConfig // Vector DB configuration
  wandbConfig: WandbConfig     // W&B configuration (optional)
  mathpixConfig: MathpixConfig // Mathpix API configuration

  // Agent State
  selectedAgent: AgentType | 'none'  // Current agent selection
  agentSettings: {              // Per-agent settings
    [key in AgentType]?: {
      enabled: boolean
      useLocalModels?: boolean
    }
  }

  // UI State (Persisted)
  activeTab: TabType          // Current active tab
  sidebarOpen: boolean        // Sidebar visibility (mobile)
  sidebarCollapsed: boolean   // Sidebar collapsed state

  // Actions
  addMessage: (message: Message) => void
  updateMessage: (id: string, partial: Partial<Message>) => void
  clearMessages: () => void
  addDocument: (document: Document) => void
  removeDocument: (id: string) => void
  clearDocuments: () => void
  setAIConfig: (config: AIConfig) => void
  setVectorDBConfig: (config: VectorDBConfig) => void
  setMathpixConfig: (config: MathpixConfig) => void
  setSelectedAgent: (agent: AgentType | 'none') => void
  // ... more actions
}
```

### State Management Flow

```mermaid
graph LR
    subgraph "Zustand Store"
        STATE[Global State]
        PERSIST[Persist Middleware]
        LOCAL[(LocalStorage)]
    end

    subgraph "State Slices"
        MSGS[Messages<br/>Session Only]
        DOCS[Documents<br/>Session Only]
        AI[AI Config<br/>Persisted]
        VDB[Vector DB Config<br/>Persisted]
        MATHPIX[Mathpix Config<br/>Persisted]
        AGENTS[Agent Settings<br/>Persisted]
        UI[UI Preferences<br/>Persisted]
    end

    subgraph "Components"
        CHAT[ChatInterface]
        LIB[DocumentLibrary]
        CFG[Configuration]
        APP[App Layout]
        AGENT_UI[AgentSelector]
    end

    STATE --> MSGS
    STATE --> DOCS
    STATE --> AI
    STATE --> VDB
    STATE --> MATHPIX
    STATE --> AGENTS
    STATE --> UI

    AI --> PERSIST
    VDB --> PERSIST
    MATHPIX --> PERSIST
    AGENTS --> PERSIST
    UI --> PERSIST
    PERSIST --> LOCAL

    CHAT -->|useAppStore| MSGS
    LIB -->|useAppStore| DOCS
    CFG -->|useAppStore| AI
    CFG -->|useAppStore| VDB
    CFG -->|useAppStore| MATHPIX
    APP -->|useAppStore| UI
    AGENT_UI -->|useAppStore| AGENTS

    style STATE fill:#fff9c4
    style PERSIST fill:#e8f5e9
    style LOCAL fill:#f3e5f5
    style MATHPIX fill:#e3f2fd
    style AGENTS fill:#fce4ec
```

---

## Component Interactions

### React Component Hierarchy

```mermaid
graph TB
    subgraph "App Root"
        LAYOUT[app/layout.tsx<br/>Root Layout + PWA Meta]
        PAGE[app/page.tsx<br/>Server Component]
    end

    subgraph "Client Layout"
        CLIENT[ClientLayout<br/>Main Container]
        SIDEBAR[Sidebar<br/>Collapsible Navigation]
        MAIN[Main Content Area]
    end

    subgraph "Core Features"
        CHAT[ChatInterface<br/>Message Display + Input]
        AGENT_SEL[AgentSelector<br/>RAG Agent Selection]
        DOCS[DocumentLibrary<br/>Document Management]
        UPLOAD[UnifiedPDFProcessor<br/>Multi-Format Upload]
        CONFIG[UnifiedConfiguration<br/>AI, VectorDB & Mathpix Settings]
        STATUS[SystemStatus<br/>Health Monitoring]
    end

    subgraph "UI Components"
        MSG[MessageItem<br/>Individual Message]
        QUICK[QuickActions<br/>Suggested Questions]
        THINKING[ThinkingBubble<br/>Processing Indicator]
        ERRORS[ErrorHandler<br/>Error Display]
    end

    LAYOUT --> PAGE
    PAGE --> CLIENT
    CLIENT --> SIDEBAR
    CLIENT --> MAIN

    SIDEBAR --> DOCS
    SIDEBAR --> CONFIG
    SIDEBAR --> STATUS

    MAIN --> CHAT
    CHAT --> AGENT_SEL
    CHAT --> MSG
    CHAT --> QUICK
    CHAT --> THINKING

    CLIENT --> UPLOAD
    CLIENT --> ERRORS

    style CLIENT fill:#e3f2fd
    style CHAT fill:#f3e5f5
    style UPLOAD fill:#fff3e0
    style AGENT_SEL fill:#fce4ec
    style CONFIG fill:#e8f5e9
```

---

## Performance & Optimization

### Caching Strategy

```mermaid
graph TB
    subgraph "Browser Cache Layers"
        PWA[Service Worker Cache<br/>Static Assets]
        IDB[IndexedDB<br/>Documents + Embeddings]
        LOCAL[LocalStorage<br/>Configuration]
        MEM[Memory Cache<br/>Active Session]
    end

    subgraph "Optimization Features"
        EMBED_CACHE[Embedding Cache<br/>80-90% API reduction]
        QUERY_CACHE[Query Cache<br/>10-100x faster]
        RATE_LIMIT[Rate Limiter<br/>Token Bucket]
        CIRCUIT[Circuit Breaker<br/>Graceful degradation]
    end

    subgraph "Cache Strategies"
        STATIC[Static Assets<br/>Cache First]
        API[API Calls<br/>Network First]
        HTML[HTML Pages<br/>Stale While Revalidate]
    end

    STATIC --> PWA
    API --> MEM
    HTML --> PWA
    
    EMBED_CACHE --> MEM
    QUERY_CACHE --> MEM

    style PWA fill:#e3f2fd
    style IDB fill:#f3e5f5
    style LOCAL fill:#fff9c4
    style MEM fill:#e8f5e9
    style EMBED_CACHE fill:#e1f5ff
    style QUERY_CACHE fill:#e1f5ff
```

---

## Security & Privacy

### Data Privacy Flow

```mermaid
graph TB
    subgraph "Client-Side Processing"
        UPLOAD[User Uploads Document]
        PARSE[Parse in Browser]
        EMBED[Generate Embeddings]
        STORE[Store Locally]
    end

    subgraph "API Calls"
        AI_API[AI Provider API<br/>Text Only]
        VDB_API[Vector DB API<br/>Optional]
        MATHPIX_API[Mathpix API<br/>Equation Images Only]
    end

    subgraph "No Server Storage"
        NO_SERVER[❌ No Server Storage]
        NO_LOGS[❌ No Server Logs]
        NO_PERSIST[❌ No Server Persistence]
    end

    UPLOAD --> PARSE
    PARSE --> EMBED

    EMBED -.->|Only Text| AI_API
    EMBED --> STORE

    STORE -.->|Optional| VDB_API
    PARSE -.->|Equation Images| MATHPIX_API

    AI_API -.->|No Data Retention| NO_SERVER
    VDB_API -.->|User Controlled| NO_SERVER
    MATHPIX_API -.->|Processing Only| NO_SERVER

    style UPLOAD fill:#e8f5e9
    style PARSE fill:#e8f5e9
    style EMBED fill:#e8f5e9
    style STORE fill:#e8f5e9
    style NO_SERVER fill:#ffebee
    style NO_LOGS fill:#ffebee
    style NO_PERSIST fill:#ffebee
```

---

## Summary

This document provides comprehensive visual representations of:

1. **System Architecture** - Overall structure with agents and multimodal support
2. **Core Components** - RAG engine, AI client, domain agents
3. **Data Flows** - Document processing, query handling with agents
4. **Domain Agents** - Specialized analysis capabilities
5. **Multimodal Processing** - Images, tables, equations with Mathpix
6. **Processing Pipelines** - PDF extraction, chunking, multi-format support
7. **State Management** - Zustand store with agent settings
8. **Performance** - Caching strategies and optimizations
9. **Security** - Privacy-focused architecture

These diagrams serve as a visual guide to understanding the complex interactions within the QuantumPDF ChatApp system.

---

**Last Updated**: November 2025
**Version**: 3.0.0
**New Features**: Domain Agents, Mathpix Integration, Multimodal Processing, Agent UI

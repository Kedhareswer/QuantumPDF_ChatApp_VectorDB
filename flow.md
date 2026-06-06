# QuantumPDF Chat App - System Architecture

```mermaid
---
id: c5c1e6a6-1e69-4e2a-b471-360fc59330cf
---
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'primaryBorderColor': '#1976d2', 'lineColor': '#424242', 'secondaryColor': '#fff8e1', 'tertiaryColor': '#f3e5f5'}}}%%

flowchart TB
    %% ===== ORCHESTRATION LAYER =====
    subgraph ORCH["<b>Orchestration</b><br/>(RAGEngine + AppStore)"]
        direction TB
    end

    %% ===== USER ENTRY =====
    USER((("👤 User")))
    USER -->|"Query"| CACHE_IN

    %% ===== CACHE LAYER =====
    subgraph CACHE_LAYER["Cache Layer"]
        CACHE_IN{{"🗄️ Query Cache<br/><i>Check cached responses</i>"}}
        EMB_CACHE[("💾 Embedding Cache<br/><i>TTL: 30min, Max: 1000</i>")]
    end
    
    CACHE_IN -.->|"Cache Hit"| FINAL_RESP
    CACHE_IN -->|"Cache Miss"| CONTEXT

    %% ===== CONTEXT CONSTRUCTION =====
    subgraph CONTEXT_BOX["Context Construction"]
        direction TB
        CONTEXT["🔧 Context Construction<br/><i>RAG, query rewriting,<br/>synonym expansion</i>"]
        QUERY_ENH["📝 Query Enhancement<br/><i>Acronym expansion,<br/>spell check, synonyms</i>"]
        CONTEXT --> QUERY_ENH
    end

    QUERY_ENH --> INPUT_GUARD

    %% ===== INPUT GUARDRAILS =====
    subgraph INPUT_BOX["Input Guardrails"]
        INPUT_GUARD["🛡️ Input Guardrails<br/><i>PII redaction, injection detection,<br/>rate limiting, validation</i>"]
    end

    %% ===== DATA LAYER =====
    subgraph DATA_LAYER["Databases"]
        direction TB
        VECTORDB[("🔮 Vector Database<br/><i>Pinecone / Weaviate / Local</i>")]
        DOCS[("📄 Documents<br/><i>In-memory store</i>")]
        CHAT_HIST[("💬 Chat History")]
    end

    %% ===== READ/WRITE ACTIONS =====
    subgraph ACTIONS["Actions"]
        direction TB
        
        subgraph READ_ACT["Read-only Actions"]
            VEC_SEARCH["🔍 Vector Search<br/><i>Semantic + Hybrid</i>"]
            MULTI_QUERY["🔄 Multi-Query RRF<br/><i>Reciprocal Rank Fusion</i>"]
            WEB_SEARCH["🌐 Web Search<br/><i>arXiv, PubMed, etc.</i>"]
        end
        
        subgraph WRITE_ACT["Write Actions"]
            ADD_DOC["📥 Add Documents"]
            DEL_DOC["🗑️ Delete Documents"]
            CLEAR_DB["🧹 Clear Database"]
        end
    end

    INPUT_GUARD --> VEC_SEARCH
    INPUT_GUARD --> MULTI_QUERY
    VEC_SEARCH <--> VECTORDB
    VEC_SEARCH <--> DOCS
    MULTI_QUERY <--> VECTORDB
    WEB_SEARCH --> VEC_SEARCH

    %% ===== MODEL GATEWAY =====
    subgraph MODEL_GW["Model Gateway<br/>(AIClient)"]
        direction TB
        ROUTING["🔀 Routing<br/><i>Provider selection</i>"]
        GENERATION["⚡ Generation<br/><i>Text generation</i>"]
        EMBEDDING["🧬 Embedding<br/><i>Vector generation</i>"]
        SCORING["📊 Scoring<br/><i>Similarity calculation</i>"]
        
        ROUTING --> GENERATION
        ROUTING --> EMBEDDING
        GENERATION --> SCORING
    end

    VEC_SEARCH --> EMBEDDING
    EMBEDDING <--> EMB_CACHE
    MULTI_QUERY --> GENERATION

    %% ===== OUTPUT GUARDRAILS =====
    subgraph OUTPUT_BOX["Output Guardrails"]
        OUTPUT_GUARD["🛡️ Output Guardrails<br/><i>Safety/verification,<br/>hallucination detection,<br/>structured outputs</i>"]
    end

    GENERATION --> OUTPUT_GUARD

    %% ===== FINAL RESPONSE =====
    FINAL_RESP["📤 Final Response"]
    OUTPUT_GUARD --> FINAL_RESP
    FINAL_RESP -->|"Response"| USER

    %% ===== LOGGING & MONITORING =====
    subgraph LOGGING["Logging, Monitoring, and Analytics"]
        direction LR
        TELEMETRY["📈 Telemetry"]
        EVAL_STORE["📋 Evaluations<br/><i>Quality metrics</i>"]
        RATE_LIMIT["⏱️ Rate Limiting"]
    end

    ORCH -.-> TELEMETRY
    MODEL_GW -.-> TELEMETRY
    VECTORDB -.-> TELEMETRY
    OUTPUT_GUARD -.-> EVAL_STORE
    INPUT_GUARD -.-> RATE_LIMIT

    %% ===== DOCUMENT INGESTION PATH =====
    USER -->|"PDF Upload"| PDF_PROC
    subgraph INGEST["Document Ingestion"]
        PDF_PROC["📄 PDF Extraction<br/><i>Server-side liteparse<br/>(text + OCR + previews)</i>"]
        CHUNKING["✂️ Chunking<br/><i>Adaptive sizing</i>"]
        EMB_GEN["🧬 Embedding Gen"]
        PDF_PROC --> CHUNKING --> EMB_GEN
    end
    EMB_GEN --> ADD_DOC
    ADD_DOC --> VECTORDB
    ADD_DOC --> DOCS

    %% ===== STYLING =====
    classDef userNode fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#1b5e20
    classDef cacheNode fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef guardNode fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef dataNode fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef actionNode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef modelNode fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef logNode fill:#fafafa,stroke:#616161,stroke-width:1px,stroke-dasharray: 5 5
    classDef responseNode fill:#c8e6c9,stroke:#388e3c,stroke-width:2px

    class USER userNode
    class CACHE_IN,EMB_CACHE cacheNode
    class INPUT_GUARD,OUTPUT_GUARD guardNode
    class VECTORDB,DOCS,CHAT_HIST dataNode
    class VEC_SEARCH,MULTI_QUERY,WEB_SEARCH,ADD_DOC,DEL_DOC,CLEAR_DB actionNode
    class ROUTING,GENERATION,EMBEDDING,SCORING modelNode
    class TELEMETRY,EVAL_STORE,RATE_LIMIT logNode
    class FINAL_RESP responseNode
```

---

## ✅ NEWLY IMPLEMENTED Components (Dec 2024)

| Component | Location | Description |
|-----------|----------|-------------|
| **Query Response Cache** | `lib/query-processor.ts` | Full query→response caching with 30min TTL, LRU eviction, document-aware invalidation |
| **LLM Query Rewriting** | `lib/query-processor.ts` | AI-powered query reformulation for better retrieval |
| **HyDE** | `lib/query-processor.ts` | Hypothetical Document Embeddings - generates ideal answer for semantic search |
| **Step-back Prompting** | `lib/query-processor.ts` | Generates broader questions for complex queries to get foundational context |
| **Query Classification** | `lib/query-processor.ts` | Classifies queries (factual, analytical, comparative, etc.) for optimal processing |
| **Cache Invalidation** | `lib/rag-engine.ts` | Automatic cache invalidation when documents are added/removed |

---

## ⚠️ REMAINING Gaps

| Component | Status | Notes |
|-----------|--------|-------|
| **Write Actions** | ⚠️ Limited | Only document add/delete, no external writes (emails, etc.) |
| **Model Routing** | ⚠️ Basic | Provider switching exists, no cost/latency-based intelligent routing |
| **Streaming Cache** | ❌ Missing | Cached responses don't support streaming |

---

## ✅ PREVIOUSLY IMPLEMENTED Components

| Component | Location | Description |
|-----------|----------|-------------|
| **Embedding Cache** | `lib/ai-client.ts:59-137` | LRU cache with 30min TTL, max 1000 entries |
| **Input Guardrails** | `lib/guardrails.ts:33-86` | Query validation, injection detection, PII check |
| **Output Guardrails** | `lib/guardrails.ts:205-273` | Toxicity scoring, hallucination detection |
| **Rate Limiting** | `lib/guardrails.ts:276-346` | Per-session rate limiting |
| **Query Enhancement** | `api/search/unified/route.ts:449-534` | Acronym expansion, synonyms, spell check |
| **Multi-Query RRF** | `lib/rag-engine.ts` | Reciprocal Rank Fusion for retrieval |
| **Evaluation Metrics** | `lib/guardrails.ts:348-619` | Retrieval & generation quality metrics |
| **Telemetry** | `lib/telemetry.ts` | Document tracking, query logging |

---

## Key Components

1. **User Interface**
   - Chat Interface: Handles user interactions and displays responses
   - Document Library: Manages uploaded PDFs and documents
   - Configuration Panel: For system settings and preferences

2. **API Layer**
   - Search Handler: Processes search queries and returns results
   - Vector DB Handler: Manages vector database operations
   - PDF Extraction (`/api/pdf/extract`): Server-side text, OCR, and page-preview extraction via `@llamaindex/liteparse` (native Rust + PDFium), with a PDF.js text fallback

3. **Core Services**
   - RAG Engine: Orchestrates the retrieval-augmented generation process
   - AI Client: Interfaces with language models for text generation
   - Vector DB Client: Handles vector storage and retrieval
   - Document Store: Manages document metadata and content

4. **External Services**
   - Vector Database: Pinecone/Weaviate for similarity search
   - AI Models: HuggingFace/OpenAI for embeddings and text generation
   - Local Storage: For document persistence

## Data Flow

1. **Document Ingestion**
   - User uploads PDF → `lib/pdf-document-processor.ts` POSTs the file to the server-side liteparse route (`/api/pdf/extract`) for text/OCR/previews, then runs the client-side PDF.js extractors for embedded images, tables, and equations → Text is chunked → Chunks are embedded → Stored in Vector DB

2. **Query Processing**
   - User submits query → Query is embedded → Similar chunks retrieved → Context sent to LLM → Response returned to user

3. **Context Management**
   - System maintains conversation history and document context
   - Vector DB enables semantic search across all processed documents
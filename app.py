from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import fitz  # PyMuPDF
import numpy as np
import faiss
import os
import json
import logging
from datetime import datetime
import requests
import google.generativeai as genai
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
import torch
import re
import hashlib
import sqlite3
from typing import List, Dict, Optional
import pickle

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class ConversationMemory:
    def __init__(self, max_history=10):
        self.max_history = max_history
        self.conversations = {}  # session_id -> conversation history
        
    def add_message(self, session_id: str, role: str, content: str, sources: List[str] = None):
        """Add a message to conversation history"""
        if session_id not in self.conversations:
            self.conversations[session_id] = []
            
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "sources": sources or []
        }
        
        self.conversations[session_id].append(message)
        
        # Keep only recent messages
        if len(self.conversations[session_id]) > self.max_history * 2:  # *2 for user+assistant pairs
            self.conversations[session_id] = self.conversations[session_id][-self.max_history * 2:]
    
    def get_conversation_context(self, session_id: str, include_last_n: int = 3) -> str:
        """Get recent conversation context for better responses"""
        if session_id not in self.conversations:
            return ""
            
        recent_messages = self.conversations[session_id][-include_last_n * 2:]  # Last N exchanges
        context_parts = []
        
        for msg in recent_messages:
            if msg["role"] == "user":
                context_parts.append(f"Previous Question: {msg['content']}")
            elif msg["role"] == "assistant":
                context_parts.append(f"Previous Answer: {msg['content'][:200]}...")
                
        return "\n".join(context_parts)
    
    def get_full_conversation(self, session_id: str) -> List[Dict]:
        """Get full conversation history"""
        return self.conversations.get(session_id, [])
    
    def clear_conversation(self, session_id: str):
        """Clear conversation history for a session"""
        if session_id in self.conversations:
            del self.conversations[session_id]

class DocumentManager:
    def __init__(self):
        self.documents = {}  # doc_id -> document info
        self.sessions = {}   # session_id -> list of doc_ids
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for persistent storage"""
        self.conn = sqlite3.connect('documents.db', check_same_thread=False)
        cursor = self.conn.cursor()
        
        # Create documents table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                upload_time TEXT NOT NULL,
                chunk_count INTEGER NOT NULL,
                metadata TEXT,
                session_id TEXT
            )
        ''')
        
        # Create chunks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (doc_id)
            )
        ''')
        
        self.conn.commit()
    
    def add_document(self, doc_id: str, filename: str, chunks: List[str], 
                    metadata: Dict, session_id: str):
        """Add document to database and memory"""
        cursor = self.conn.cursor()
        
        # Insert document
        cursor.execute('''
            INSERT OR REPLACE INTO documents 
            (doc_id, filename, upload_time, chunk_count, metadata, session_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (doc_id, filename, datetime.now().isoformat(), 
              len(chunks), json.dumps(metadata), session_id))
        
        # Insert chunks
        cursor.execute('DELETE FROM chunks WHERE doc_id = ?', (doc_id,))
        for i, chunk in enumerate(chunks):
            cursor.execute('''
                INSERT INTO chunks (doc_id, chunk_index, content)
                VALUES (?, ?, ?)
            ''', (doc_id, i, chunk))
        
        self.conn.commit()
        
        # Update memory
        self.documents[doc_id] = {
            'filename': filename,
            'chunks': chunks,
            'metadata': metadata,
            'upload_time': datetime.now().isoformat(),
            'session_id': session_id
        }
        
        # Update session documents
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        if doc_id not in self.sessions[session_id]:
            self.sessions[session_id].append(doc_id)
    
    def get_session_documents(self, session_id: str) -> List[Dict]:
        """Get all documents for a session"""
        if session_id not in self.sessions:
            return []
            
        documents = []
        for doc_id in self.sessions[session_id]:
            if doc_id in self.documents:
                doc_info = self.documents[doc_id].copy()
                doc_info['doc_id'] = doc_id
                documents.append(doc_info)
        
        return documents
    
    def get_document_chunks(self, doc_id: str) -> List[str]:
        """Get chunks for a specific document"""
        if doc_id in self.documents:
            return self.documents[doc_id]['chunks']
        
        # Fallback to database
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT content FROM chunks 
            WHERE doc_id = ? 
            ORDER BY chunk_index
        ''', (doc_id,))
        
        return [row[0] for row in cursor.fetchall()]
    
    def remove_document(self, doc_id: str, session_id: str):
        """Remove document from session"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM documents WHERE doc_id = ? AND session_id = ?', 
                      (doc_id, session_id))
        cursor.execute('DELETE FROM chunks WHERE doc_id = ?', (doc_id,))
        self.conn.commit()
        
        # Update memory
        if doc_id in self.documents:
            del self.documents[doc_id]
        
        if session_id in self.sessions and doc_id in self.sessions[session_id]:
            self.sessions[session_id].remove(doc_id)

class MultiDocumentRAG:
    def __init__(self):
        self.embedding_model = None
        self.local_llm = None
        self.tokenizer = None
        self.vector_indices = {}  # doc_id -> FAISS index
        self.combined_indices = {}  # session_id -> combined FAISS index
        self.document_manager = DocumentManager()
        self.conversation_memory = ConversationMemory()
        self.load_embedding_model()
    
    def load_embedding_model(self):
        """Load the sentence transformer model for embeddings"""
        try:
            logger.info("Loading embedding model...")
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def load_local_llm(self, model_name="microsoft/DialoGPT-medium"):
        """Load local Hugging Face model"""
        try:
            logger.info(f"Loading local LLM: {model_name}")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
            if "DialoGPT" in model_name:
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                self.local_llm = AutoModelForCausalLM.from_pretrained(model_name)
                if self.tokenizer.pad_token is None:
                    self.tokenizer.pad_token = self.tokenizer.eos_token
            else:
                self.local_llm = pipeline(
                    "text-generation",
                    model=model_name,
                    device=0 if device == "cuda" else -1,
                    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                    max_new_tokens=512,
                    do_sample=True,
                    temperature=0.7,
                    top_p=0.9
                )
            
            logger.info("Local LLM loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load local LLM: {e}")
            return False
    
    def extract_text_from_pdf(self, pdf_file):
        """Extract text from PDF file"""
        try:
            doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
            text = ""
            metadata = {
                "pages": len(doc),
                "title": doc.metadata.get("title", ""),
                "author": doc.metadata.get("author", ""),
                "subject": doc.metadata.get("subject", "")
            }
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                if page_text.strip():
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            
            doc.close()
            return text.strip(), metadata
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
    
    def chunk_text(self, text, chunk_size=500, overlap=50):
        """Split text into overlapping chunks"""
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n+', '\n', text)
        
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Add overlap between chunks
        overlapped_chunks = []
        for i, chunk in enumerate(chunks):
            if i > 0 and overlap > 0:
                prev_chunk = chunks[i-1]
                overlap_text = prev_chunk[-overlap:] if len(prev_chunk) > overlap else prev_chunk
                chunk = overlap_text + " " + chunk
            overlapped_chunks.append(chunk)
        
        return overlapped_chunks
    
    def create_embeddings(self, chunks):
        """Create embeddings for text chunks"""
        try:
            embeddings = self.embedding_model.encode(chunks, show_progress_bar=True)
            return np.array(embeddings)
        except Exception as e:
            logger.error(f"Error creating embeddings: {e}")
            raise
    
    def build_vector_index(self, embeddings):
        """Build FAISS vector index"""
        try:
            dimension = embeddings.shape[1]
            index = faiss.IndexFlatL2(dimension)
            index.add(embeddings.astype('float32'))
            return index
        except Exception as e:
            logger.error(f"Error building vector index: {e}")
            raise
    
    def build_combined_index(self, session_id: str):
        """Build combined index for all documents in a session"""
        try:
            documents = self.document_manager.get_session_documents(session_id)
            if not documents:
                return None
            
            all_chunks = []
            chunk_metadata = []  # Store doc_id and chunk_index for each chunk
            
            for doc in documents:
                doc_id = doc['doc_id']
                chunks = self.document_manager.get_document_chunks(doc_id)
                
                for i, chunk in enumerate(chunks):
                    all_chunks.append(chunk)
                    chunk_metadata.append({
                        'doc_id': doc_id,
                        'doc_name': doc['filename'],
                        'chunk_index': i
                    })
            
            if not all_chunks:
                return None
            
            # Create embeddings for all chunks
            embeddings = self.create_embeddings(all_chunks)
            
            # Build combined index
            combined_index = self.build_vector_index(embeddings)
            
            # Store the combined index and metadata
            self.combined_indices[session_id] = {
                'index': combined_index,
                'chunks': all_chunks,
                'metadata': chunk_metadata
            }
            
            return combined_index
            
        except Exception as e:
            logger.error(f"Error building combined index: {e}")
            return None
    
    def retrieve_relevant_chunks_multi_doc(self, query: str, session_id: str, top_k: int = 5):
        """Retrieve relevant chunks from all documents in a session"""
        try:
            # Build or get combined index
            if session_id not in self.combined_indices:
                self.build_combined_index(session_id)
            
            if session_id not in self.combined_indices:
                return []
            
            combined_data = self.combined_indices[session_id]
            index = combined_data['index']
            chunks = combined_data['chunks']
            metadata = combined_data['metadata']
            
            # Create query embedding
            query_embedding = self.embedding_model.encode([query])
            
            # Search in combined index
            distances, indices = index.search(query_embedding.astype('float32'), top_k)
            
            # Get relevant chunks with metadata
            relevant_chunks = []
            for i, idx in enumerate(indices[0]):
                if idx < len(chunks):
                    chunk_meta = metadata[idx]
                    relevant_chunks.append({
                        "text": chunks[idx],
                        "score": float(distances[0][i]),
                        "doc_id": chunk_meta['doc_id'],
                        "doc_name": chunk_meta['doc_name'],
                        "chunk_index": chunk_meta['chunk_index']
                    })
            
            return relevant_chunks
            
        except Exception as e:
            logger.error(f"Error retrieving relevant chunks: {e}")
            return []
    
    def generate_answer_with_context(self, context: str, question: str, conversation_context: str, model_type: str, api_key: str = "", aiml_model: str = ""):
        """Generate answer with conversation context"""
        try:
            # Prepare enhanced prompt with conversation context
            enhanced_prompt = f"""Previous Conversation Context:
{conversation_context}

Current Context from Documents:
{context}

Current Question: {question}

Please provide a comprehensive answer based on both the document context and the conversation history. If this question relates to previous questions, acknowledge that connection."""

            if model_type == 'huggingface':
                return self.generate_answer_local(enhanced_prompt, question)
            elif model_type == 'openai':
                return self.generate_answer_openai(enhanced_prompt, question, api_key)
            elif model_type == 'gemini':
                return self.generate_answer_gemini(enhanced_prompt, question, api_key)
            elif model_type == 'aiml':
                return self.generate_answer_aiml(enhanced_prompt, question, api_key, aiml_model)
            else:
                return "Invalid model type specified."
                
        except Exception as e:
            logger.error(f"Error generating answer with context: {e}")
            return f"Error generating response: {str(e)}"
    
    def generate_answer_local(self, context, question):
        """Generate answer using local Hugging Face model"""
        try:
            if self.local_llm is None:
                return "Local model not loaded. Please select a different model."
            
            prompt = f"""Context: {context}

Question: {question}

Answer based on the context provided:"""
            
            if hasattr(self.local_llm, 'generate'):
                inputs = self.tokenizer.encode(prompt, return_tensors='pt', max_length=1024, truncation=True)
                
                with torch.no_grad():
                    outputs = self.local_llm.generate(
                        inputs,
                        max_new_tokens=200,
                        temperature=0.7,
                        do_sample=True,
                        pad_token_id=self.tokenizer.eos_token_id
                    )
                
                response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
                response = response[len(prompt):].strip()
            else:
                response = self.local_llm(prompt, max_new_tokens=200)[0]['generated_text']
                response = response[len(prompt):].strip()
            
            return response if response else "I couldn't generate a response based on the provided context."
        
        except Exception as e:
            logger.error(f"Error generating answer with local model: {e}")
            return f"Error generating response: {str(e)}"
    
    def generate_answer_openai(self, context, question, api_key):
        """Generate answer using OpenAI API"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that answers questions based on the provided context and conversation history. If the context doesn't contain relevant information, say so clearly."
                    },
                    {
                        "role": "user",
                        "content": f"{context}\n\nQuestion: {question}"
                    }
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                return f"Error calling OpenAI API: {response.status_code}"
        
        except Exception as e:
            logger.error(f"Error with OpenAI API: {e}")
            return f"Error with OpenAI API: {str(e)}"
    
    def generate_answer_gemini(self, context, question, api_key):
        """Generate answer using Google Gemini API"""
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            prompt = f"""{context}

Question: {question}

Answer:"""
            
            response = model.generate_content(prompt)
            return response.text
        
        except Exception as e:
            logger.error(f"Error with Gemini API: {e}")
            return f"Error with Gemini API: {str(e)}"
    
    def generate_answer_aiml(self, context, question, api_key, model_name="openai/gpt-4o-mini"):
        """Generate answer using AIML API"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            data = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that answers questions based on the provided context and conversation history. If the context doesn't contain relevant information, say so clearly."
                    },
                    {
                        "role": "user",
                        "content": f"{context}\n\nQuestion: {question}"
                    }
                ],
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            response = requests.post(
                "https://api.aimlapi.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                logger.error(f"AIML API error: {response.status_code} - {response.text}")
                return f"Error calling AIML API: {response.status_code}"
        
        except Exception as e:
            logger.error(f"Error with AIML API: {e}")
            return f"Error with AIML API: {str(e)}"

# Initialize the multi-document RAG system
rag_system = MultiDocumentRAG()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    try:
        if 'pdf' not in request.files:
            return jsonify({"error": "No PDF file provided"}), 400
        
        pdf_file = request.files['pdf']
        session_id = request.form.get('session_id', 'default')
        
        if pdf_file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Extract text from PDF
        text, metadata = rag_system.extract_text_from_pdf(pdf_file)
        
        if not text.strip():
            return jsonify({"error": "No text found in PDF"}), 400
        
        # Create document ID
        doc_id = hashlib.md5(f"{pdf_file.filename}{datetime.now()}{session_id}".encode()).hexdigest()
        
        # Chunk the text
        chunks = rag_system.chunk_text(text)
        
        # Create embeddings and build index for this document
        embeddings = rag_system.create_embeddings(chunks)
        index = rag_system.build_vector_index(embeddings)
        rag_system.vector_indices[doc_id] = index
        
        # Add document to manager
        rag_system.document_manager.add_document(
            doc_id, pdf_file.filename, chunks, metadata, session_id
        )
        
        # Rebuild combined index for the session
        rag_system.build_combined_index(session_id)
        
        return jsonify({
            "success": True,
            "doc_id": doc_id,
            "filename": pdf_file.filename,
            "chunks": len(chunks),
            "metadata": metadata,
            "session_id": session_id
        })
    
    except Exception as e:
        logger.error(f"Error uploading PDF: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/documents/<session_id>', methods=['GET'])
def get_session_documents(session_id):
    """Get all documents for a session"""
    try:
        documents = rag_system.document_manager.get_session_documents(session_id)
        return jsonify({"documents": documents})
    except Exception as e:
        logger.error(f"Error getting session documents: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/documents/<session_id>/<doc_id>', methods=['DELETE'])
def remove_document(session_id, doc_id):
    """Remove a document from session"""
    try:
        rag_system.document_manager.remove_document(doc_id, session_id)
        
        # Remove from vector indices
        if doc_id in rag_system.vector_indices:
            del rag_system.vector_indices[doc_id]
        
        # Rebuild combined index
        rag_system.build_combined_index(session_id)
        
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error removing document: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ask', methods=['POST'])
def ask_question():
    try:
        data = request.json
        question = data.get('question', '').strip()
        session_id = data.get('session_id', 'default')
        model_type = data.get('model_type', 'huggingface')
        api_key = data.get('api_key', '')
        
        if not question:
            return jsonify({"error": "No question provided"}), 400
        
        # Get conversation context
        conversation_context = rag_system.conversation_memory.get_conversation_context(session_id)
        
        # Add user message to conversation memory
        rag_system.conversation_memory.add_message(session_id, "user", question)
        
        # Retrieve relevant chunks from all documents in session
        relevant_chunks = rag_system.retrieve_relevant_chunks_multi_doc(question, session_id, top_k=5)
        
        if not relevant_chunks:
            answer = "I couldn't find relevant information in the uploaded documents to answer your question."
            sources = []
        else:
            # Prepare context from multiple documents
            context_parts = []
            for chunk in relevant_chunks:
                context_parts.append(f"From {chunk['doc_name']}: {chunk['text']}")
            
            context = "\n\n".join(context_parts)
            
            # Generate answer with conversation context
            aiml_model = data.get('aiml_model', 'openai/gpt-4o-mini')
            answer = rag_system.generate_answer_with_context(
                context, question, conversation_context, model_type, api_key, aiml_model
            )
            
            # Prepare sources with document information
            sources = []
            for chunk in relevant_chunks:
                sources.append({
                    "text": chunk["text"][:200] + "..." if len(chunk["text"]) > 200 else chunk["text"],
                    "score": chunk["score"],
                    "doc_name": chunk["doc_name"],
                    "doc_id": chunk["doc_id"],
                    "chunk_index": chunk["chunk_index"]
                })
        
        # Add assistant response to conversation memory
        source_names = [s["doc_name"] for s in sources]
        rag_system.conversation_memory.add_message(session_id, "assistant", answer, source_names)
        
        return jsonify({
            "answer": answer,
            "sources": sources,
            "model_used": model_type,
            "session_id": session_id,
            "conversation_context_used": bool(conversation_context)
        })
    
    except Exception as e:
        logger.error(f"Error processing question: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/conversation/<session_id>', methods=['GET'])
def get_conversation_history(session_id):
    """Get conversation history for a session"""
    try:
        history = rag_system.conversation_memory.get_full_conversation(session_id)
        return jsonify({"conversation": history})
    except Exception as e:
        logger.error(f"Error getting conversation history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/conversation/<session_id>', methods=['DELETE'])
def clear_conversation(session_id):
    """Clear conversation history for a session"""
    try:
        rag_system.conversation_memory.clear_conversation(session_id)
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/session/<session_id>/summary', methods=['GET'])
def get_session_summary(session_id):
    """Get summary of session including documents and conversation stats"""
    try:
        documents = rag_system.document_manager.get_session_documents(session_id)
        conversation = rag_system.conversation_memory.get_full_conversation(session_id)
        
        # Calculate stats
        total_chunks = sum(len(rag_system.document_manager.get_document_chunks(doc['doc_id'])) 
                          for doc in documents)
        
        user_messages = [msg for msg in conversation if msg['role'] == 'user']
        assistant_messages = [msg for msg in conversation if msg['role'] == 'assistant']
        
        summary = {
            "session_id": session_id,
            "documents": {
                "count": len(documents),
                "total_chunks": total_chunks,
                "files": [{"name": doc["filename"], "chunks": len(rag_system.document_manager.get_document_chunks(doc['doc_id']))} 
                         for doc in documents]
            },
            "conversation": {
                "total_messages": len(conversation),
                "user_questions": len(user_messages),
                "assistant_responses": len(assistant_messages),
                "last_activity": conversation[-1]["timestamp"] if conversation else None
            }
        }
        
        return jsonify(summary)
    except Exception as e:
        logger.error(f"Error getting session summary: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/models', methods=['GET'])
def get_available_models():
    """Get list of available models"""
    return jsonify({
        "huggingface": [
            "microsoft/DialoGPT-medium",
            "microsoft/DialoGPT-large",
            "HuggingFaceH4/zephyr-7b-beta",
            "mistralai/Mistral-7B-Instruct-v0.1"
        ],
        "aiml": [
            "openai/gpt-4o-mini",
            "openai/gpt-4o",
            "openai/gpt-3.5-turbo",
            "google/gemini-pro",
            "anthropic/claude-3-sonnet",
            "meta-llama/llama-3.1-8b-instruct"
        ]
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "embedding_model_loaded": rag_system.embedding_model is not None,
        "local_llm_loaded": rag_system.local_llm is not None,
        "total_sessions": len(rag_system.document_manager.sessions),
        "total_documents": len(rag_system.document_manager.documents),
        "active_conversations": len(rag_system.conversation_memory.conversations)
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

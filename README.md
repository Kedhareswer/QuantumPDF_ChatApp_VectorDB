# PDF RAG Chatbot

A fully functional PDF chatbot using Retrieval-Augmented Generation (RAG) with multiple LLM options.

## Features

- **PDF Processing**: Extract and chunk text from PDF documents
- **Vector Search**: FAISS-based similarity search for relevant content retrieval
- **Multiple LLM Options**:
  - Hugging Face models (local, free)
  - OpenAI GPT models (API)
  - Google Gemini (API)
  - AIML API (multiple models)
- **Real-time Chat Interface**: Interactive web-based chat
- **Source Citations**: Shows which document chunks were used for answers

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
   cd QuantumPDF_ChatApp
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   \`\`\`bash
   python app.py
   \`\`\`

4. **Access the interface**:
   Open your browser to `http://localhost:5000`

## Usage

1. **Upload a PDF**: Drag and drop or click to select a PDF file
2. **Choose Model**: Select from available LLM options
3. **Enter API Key**: If using API-based models, enter your API key
4. **Ask Questions**: Chat about the PDF content

## API Keys

### OpenAI
- Get your API key from: https://platform.openai.com/api-keys
- Models: GPT-3.5-turbo, GPT-4

### Google Gemini
- Get your API key from: https://makersuite.google.com/app/apikey
- Models: Gemini Pro

### AIML API
- Get your API key from: https://aimlapi.com
- Models: GPT-4o, Claude, Llama, and more

## Configuration

### Environment Variables (Optional)
Create a `.env` file:
\`\`\`
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
AIML_API_KEY=your_aiml_key
\`\`\`

### Model Configuration
- **Chunk Size**: Default 500 characters (adjustable in code)
- **Overlap**: Default 50 characters
- **Top-K Retrieval**: Default 3 chunks
- **Embedding Model**: sentence-transformers/all-MiniLM-L6-v2

## Performance Optimization

### For Better Performance:
1. **Use GPU**: Install `torch` with CUDA support
2. **Larger Models**: Use `all-mpnet-base-v2` for embeddings
3. **Better Chunking**: Implement semantic chunking
4. **Caching**: Add Redis for embedding cache

### Memory Requirements:
- **Minimum**: 4GB RAM
- **Recommended**: 8GB+ RAM
- **With Local LLM**: 16GB+ RAM

## Troubleshooting

### Common Issues:

1. **PDF Processing Fails**:
   - Ensure PDF contains extractable text
   - Check file size (large PDFs may timeout)

2. **Model Loading Errors**:
   - Check internet connection for downloads
   - Ensure sufficient RAM

3. **API Errors**:
   - Verify API keys are correct
   - Check API rate limits

### Logs:
Check console output for detailed error messages.

## Extending the System

### Adding New Models:
1. Add model configuration in `app.py`
2. Implement generation method
3. Update frontend model selection

### Custom Embeddings:
Replace `sentence-transformers` with your preferred embedding model.

### Database Integration:
Replace FAISS with persistent vector databases like Pinecone or Weaviate.

## Architecture

\`\`\`
Frontend (HTML/CSS/JS)
    ↓
Flask API Server
    ↓
PDF Processing (PyMuPDF)
    ↓
Text Chunking
    ↓
Embedding Generation (Sentence Transformers)
    ↓
Vector Storage (FAISS)
    ↓
Similarity Search
    ↓
LLM Generation (HF/OpenAI/Gemini/AIML)
    ↓
Response with Sources
\`\`\`

## License

MIT License - see LICENSE file for details.

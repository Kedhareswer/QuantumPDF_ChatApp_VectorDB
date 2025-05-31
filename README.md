<div align="center">
  <h1>✨ QuantumPDF ChatApp</h1>
  <p>
    <strong>An advanced AI-powered PDF chat application with Retrieval-Augmented Generation (RAG) capabilities</strong>
  </p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
  
  <p align="center">
    <a href="https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers">
      <img src="https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=social" alt="GitHub stars">
    </a>
    <a href="https://github.com/Kedhareswer/QuantumPDF_ChatApp/network/members">
      <img src="https://img.shields.io/github/forks/Kedhareswer/QuantumPDF_ChatApp?style=social" alt="GitHub forks">
    </a>
  </p>

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#demo">Demo</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#contributing">Contributing</a> •
    <a href="#license">License</a>
  </p>
</div>

## 🌟 Features

### 📄 Advanced PDF Processing
- **Smart Text Extraction**: Extract and chunk text from PDF documents with precision
- **Semantic Chunking**: Intelligent text segmentation for better context understanding
- **Batch Processing**: Handle multiple documents simultaneously

### 🔍 Powerful Search & Retrieval
- **FAISS-based Vector Search**: Lightning-fast similarity search
- **Hybrid Search**: Combine keyword and semantic search for optimal results
- **Relevance Scoring**: Smart ranking of retrieved content

### 🤖 Multiple AI Model Support
- **Local Models**: Run completely offline with Hugging Face models
- **Cloud AI**: Seamless integration with leading AI providers:
  - OpenAI GPT-4/3.5
  - Google Gemini
  - Anthropic Claude
  - AIML API (multiple models)
  - Groq API

### 🎨 Modern Web Interface
- **Real-time Chat**: Interactive conversation interface
- **Document Management**: Organize and manage your PDF library
- **Source Citations**: Trace answers back to original document sections
- **Dark/Light Mode**: Built-in theme support

### 🔄 Advanced Features
- **Weights & Biases Integration**: Track experiments and model performance
- **API Configuration**: Easy setup for different AI providers
- **Error Handling**: Robust error handling and user feedback
- **Responsive Design**: Works on desktop and tablet devices

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+ (for frontend development)
- pip (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kedhareswer/QuantumPDF_ChatApp.git
   cd QuantumPDF_ChatApp
   ```

2. **Set up Python environment**
   ```bash
   # Create and activate virtual environment (recommended)
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Required for cloud AI providers (optional for local models)
   OPENAI_API_KEY=your_openai_key
   GEMINI_API_KEY=your_gemini_key
   ANTHROPIC_API_KEY=your_anthropic_key
   AIML_API_KEY=your_aiml_key
   GROQ_API_KEY=your_groq_key
   
   # Optional: Weights & Biases for experiment tracking
   WANDB_API_KEY=your_wandb_key
   ```

4. **Run the application**
   ```bash
   # Start the backend API
   python app.py
   
   # In a new terminal, start the frontend (if developing)
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   Open your browser to [http://localhost:3000](http://localhost:3000)

## 🎯 Why QuantumPDF ChatApp?

- **Privacy-First**: Run completely offline with local models
- **Extensible**: Easy to add new AI providers and features
- **Production-Ready**: Built with scalability and performance in mind
- **Open Source**: Full control and transparency over your data

## 🤝 Contributing

We love contributions! Whether you're fixing bugs, improving documentation, or adding new features, your help is appreciated. Here's how to get started:

1. Fork the repository
2. Create a new branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Submit a pull request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Show Your Support

If you find this project useful, please consider giving it a ⭐️ on GitHub! Your support helps us continue to improve and maintain this project.

[![Star on GitHub](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp?style=social)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)

💡 **Pro Tip**: Starring the repo also helps others discover this project and shows your appreciation for open-source software!

## 🤝 Join Our Community

- [GitHub Discussions](https://github.com/Kedhareswer/QuantumPDF_ChatApp/discussions) - Ask questions and share ideas
- [Issues](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues) - Report bugs or request features
- [Discord](https://discord.gg/your-invite-link) - Chat with the community (coming soon!)

## 📞 Contact

Have questions or suggestions? We'd love to hear from you!

- Open an [issue](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
- Email: [contact@quantumpdf.app](mailto:contact@quantumpdf.app)
- Twitter: [@QuantumPDFApp](https://twitter.com/QuantumPDFApp)

## 📚 Additional Resources

- [API Documentation](https://github.com/Kedhareswer/QuantumPDF_ChatApp/wiki/API-Documentation)
- [Development Guide](https://github.com/Kedhareswer/QuantumPDF_ChatApp/wiki/Development-Guide)
- [FAQ](https://github.com/Kedhareswer/QuantumPDF_ChatApp/wiki/FAQ)
- [Release Notes](https://github.com/Kedhareswer/QuantumPDF_ChatApp/releases)

---

<div align="center">
  <p>Made with ❤️ by the QuantumPDF Team</p>
  <p>© 2023 QuantumPDF. All rights reserved.</p>
  
  [![GitHub contributors](https://img.shields.io/github/contributors/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/graphs/contributors)
  [![GitHub issues](https://img.shields.io/github/issues/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/issues)
  [![GitHub forks](https://img.shields.io/github/forks/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/network/members)
  [![GitHub stars](https://img.shields.io/github/stars/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/stargazers)
  [![GitHub license](https://img.shields.io/github/license/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/blob/main/LICENSE)
  
  [![Twitter Follow](https://img.shields.io/twitter/follow/QuantumPDFApp?style=social)](https://twitter.com/QuantumPDFApp)
  [![GitHub last commit](https://img.shields.io/github/last-commit/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/commits/main)
  [![GitHub release](https://img.shields.io/github/v/release/Kedhareswer/QuantumPDF_ChatApp)](https://github.com/Kedhareswer/QuantumPDF_ChatApp/releases)
</div>

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

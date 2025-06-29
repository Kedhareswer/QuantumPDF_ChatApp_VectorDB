export interface RAGQuery {
  question: string
  context?: string
  maxResults?: number
}

export interface RAGResponse {
  answer: string
  sources: Array<{
    text: string
    similarity: number
    metadata: Record<string, any>
  }>
  confidence: number
}

// Enhanced interfaces for self-reflective system
interface EnhancedQueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: Array<{
    content: string
    source: string
    similarity: number
  }>
  reasoning?: {
    initialThoughts: string
    criticalReview: string
    finalRefinement: string
  }
  qualityMetrics: {
    accuracyScore: number
    completenessScore: number
    clarityScore: number
    confidenceScore: number
    finalRating: number
  }
  tokenUsage: {
    contextTokens: number
    reasoningTokens: number
    responseTokens: number
    totalTokens: number
  }
}

interface ProcessingPhase {
  name: string
  tokenBudget: number
  completed: boolean
  result?: any
}

interface QualityGate {
  name: string
  passed: boolean
  issues: string[]
  confidence: number
}

import { AIClient } from "./ai-client"
import { PDFParser } from "./pdf-parser"

interface Document {
  id: string
  name: string
  content: string
  chunks: string[]
  embeddings: number[][]
  uploadedAt: Date
  metadata?: any
}

interface QueryResponse {
  answer: string
  sources: string[]
  relevanceScore: number
  retrievedChunks: Array<{
    content: string
    source: string
    similarity: number
  }>
}

interface AIConfig {
  provider:
    | "huggingface"
    | "openai"
    | "anthropic"
    | "aiml"
    | "groq"
    | "openrouter"
    | "deepinfra"
    | "deepseek"
    | "googleai"
    | "vertex"
    | "mistral"
    | "perplexity"
    | "xai"
    | "alibaba"
    | "minimax"
    | "fireworks"
    | "cerebras"
    | "replicate"
    | "anyscale"
  apiKey: string
  model: string
  baseUrl?: string
}

export class RAGEngine {
  private documents: Document[] = []
  private aiClient: AIClient | null = null
  private pdfParser: PDFParser
  private isInitialized = false
  private currentConfig: AIConfig | null = null
  private tokenBudget = 4000 // Default token budget
  private showThinking = false // Option to show/hide thinking process

  constructor() {
    this.pdfParser = new PDFParser()
  }

  async initialize(config?: AIConfig): Promise<void> {
    try {
      if (config) {
              // RAGEngine: Initializing with new config

      // Create AI client with the provided configuration
      this.aiClient = new AIClient(config)
      this.currentConfig = config
      }
      
      if (!this.aiClient) {
        throw new Error("AI client not available - configuration required")
      }
      
      console.log(`RAGEngine: Initializing with AI provider`)
      
      // Test AI client connection first
      console.log("RAGEngine: Testing AI provider connection...")
      const connectionTest = await this.aiClient.testConnection()
      if (!connectionTest) {
        console.warn("RAGEngine: AI provider connection test failed, but continuing initialization")
        // Don't throw here - allow initialization to continue with potential fallback
      } else {
        console.log("RAGEngine: AI provider connection test successful")
      }

      // Test embedding generation with error handling
      console.log("RAGEngine: Testing embedding generation...")
      try {
        const testEmbedding = await this.aiClient.generateEmbedding("test connection")
        if (!testEmbedding || !Array.isArray(testEmbedding) || testEmbedding.length === 0) {
          throw new Error("Invalid embedding response during initialization")
        }
        console.log(`RAGEngine: Embedding test successful, dimension: ${testEmbedding.length}`)
      } catch (embeddingError) {
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : "Unknown embedding error"
        console.error(`RAGEngine: Embedding generation failed during initialization: ${errorMessage}`)
        
        // For Cohere and other providers that might have embedding issues, 
        // we can still continue if text generation works
        if (errorMessage.includes("embedding")) {
          console.warn("RAGEngine: Continuing initialization despite embedding issues - will use fallback embeddings")
        } else {
          throw embeddingError // Re-throw non-embedding specific errors
        }
      }

      // Test text generation as a final check
      console.log("RAGEngine: Testing text generation...")
      try {
        const testResponse = await this.aiClient.generateText([
          { role: "user", content: "Hello, this is a connectivity test." }
        ])
        if (!testResponse || typeof testResponse !== 'string') {
          throw new Error("Invalid text generation response during initialization")
        }
        console.log("RAGEngine: Text generation test successful")
      } catch (textError) {
        const errorMessage = textError instanceof Error ? textError.message : "Unknown text generation error"
        console.error(`RAGEngine: Text generation failed during initialization: ${errorMessage}`)
        throw textError // Text generation is essential, so fail initialization
      }

      console.log("RAGEngine: Initialization completed successfully")
      this.isInitialized = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown initialization error"
      console.error(`RAGEngine: Initialization failed: ${errorMessage}`)
      
      // Provide specific guidance based on error type
      if (errorMessage.includes("API key") || errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        console.error("RAGEngine: Check your AI provider API key configuration")
      } else if (errorMessage.includes("model") || errorMessage.includes("404")) {
        console.error("RAGEngine: Check your AI model configuration")
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        console.error("RAGEngine: API rate limit exceeded - try again later")
      }
      
      this.isInitialized = false
      throw new Error(`RAG Engine initialization failed: ${errorMessage}`)
    }
  }

  async updateConfig(config: AIConfig) {
    try {
      console.log("Updating RAG Engine configuration")
      await this.initialize(config)

      // Re-generate embeddings for existing documents if provider changed
      if (this.documents.length > 0 && this.aiClient) {
        console.log("Re-generating embeddings for existing documents...")
        for (const document of this.documents) {
          if (document.chunks && document.chunks.length > 0) {
            document.embeddings = await this.aiClient.generateEmbeddings(document.chunks)
          }
        }
        console.log("Embeddings updated for all documents")
      }
    } catch (error) {
      console.error("Failed to update RAG Engine configuration:", error)
      throw error
    }
  }

  /**
   * Generates embeddings for a single string
   * @param text Text to generate embedding for
   * @returns Embedding as a number array
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
    if (!this.isInitialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error("Invalid text input for embedding generation")
      }

      // Generating embedding for text
      const embedding = await this.aiClient.generateEmbedding(text)
      
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Invalid embedding returned from AI client")
      }
      
      // Successfully generated embedding
      return embedding
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown embedding error"
      console.error(`RAGEngine: Embedding generation failed: ${errorMessage}`)
      
      // For critical embedding failures, provide fallback
      if (errorMessage.includes("API")) {
        console.warn("RAGEngine: Using fallback embedding due to provider error")
        // Generate a simple fallback embedding
        return this.generateFallbackEmbedding(text)
      }
      
      throw error
    }
  }

  private generateFallbackEmbedding(text: string): number[] {
    console.warn("RAGEngine: Generating fallback embedding")
    
    // Simple hash-based embedding for fallback
    const dimension = 1024
    const embedding = new Array(dimension).fill(0)
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      const index = charCode % dimension
      embedding[index] += charCode * 0.1
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
  }

  async processDocument(file: File): Promise<Document> {
    if (!this.isInitialized || !this.aiClient) {
      throw new Error("RAG engine not initialized")
    }

    try {
      // Processing document

      // Extract text from PDF
      const pdfContent = await this.pdfParser.extractText(file)

      // Chunk the text
      const chunks = this.pdfParser.chunkText(pdfContent.text, 500, 50)
      // Generated chunks

      if (chunks.length === 0) {
        throw new Error("No text chunks could be created from the document")
      }

      // Generate embeddings for all chunks
      // Generating embeddings
      const embeddings = await this.aiClient.generateEmbeddings(chunks)

      if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== chunks.length) {
        throw new Error("Failed to generate embeddings for all chunks")
      }

      const document: Document = {
        id: Date.now().toString(),
        name: file.name,
        content: pdfContent.text,
        chunks,
        embeddings,
        uploadedAt: new Date(),
        metadata: {
          ...pdfContent.metadata,
          aiProvider: this.currentConfig?.provider,
          aiModel: this.currentConfig?.model,
        },
      }

      console.log(`Document processed successfully: ${chunks.length} chunks, ${embeddings.length} embeddings`)
      return document
    } catch (error) {
      console.error("Error processing document:", error)
      throw error
    }
  }

  async addDocument(document: Document) {
    try {
      console.log("=== RAG Engine: Adding document ===")
      console.log("Document name:", document.name)
      console.log("Document ID:", document.id)
      
      // Validate document structure
      if (!document || typeof document !== "object") {
        console.error("Invalid document object:", document)
        throw new Error("Invalid document object")
      }

      console.log("Document structure validation:")
      console.log("- Has chunks:", !!document.chunks)
      console.log("- Chunks is array:", Array.isArray(document.chunks))
      console.log("- Chunks length:", document.chunks?.length)
      console.log("- Has embeddings:", !!document.embeddings)
      console.log("- Embeddings is array:", Array.isArray(document.embeddings))
      console.log("- Embeddings length:", document.embeddings?.length)

      if (!document.chunks || !Array.isArray(document.chunks)) {
        console.error("Document chunks are missing or invalid:", document.chunks)
        throw new Error("Document chunks are missing or invalid")
      }

      if (document.chunks.length === 0) {
        console.error("Document has no chunks")
        throw new Error("Document has no chunks")
      }

      console.log("First few chunks preview:")
      document.chunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`  Chunk ${i}: ${chunk.substring(0, 100)}...`)
      })

      // Check AI client status
      console.log("AI Client status:")
      console.log("- AI Client available:", !!this.aiClient)
      console.log("- RAG Engine initialized:", this.isInitialized)

      // Generate embeddings if they don't exist or are invalid
      if (
        !document.embeddings ||
        !Array.isArray(document.embeddings) ||
        document.embeddings.length !== document.chunks.length
      ) {
        if (!this.aiClient) {
          console.error("AI client not initialized - cannot generate embeddings")
          throw new Error("AI client not initialized")
        }

        console.log("🔄 Generating missing embeddings for document:", document.name)
        console.log("- Need to generate embeddings for", document.chunks.length, "chunks")
        
        try {
          const startTime = Date.now()
          document.embeddings = await this.aiClient.generateEmbeddings(document.chunks)
          const endTime = Date.now()
          console.log(`✅ Embeddings generated successfully in ${endTime - startTime}ms`)
          console.log("- Generated embeddings count:", document.embeddings.length)
          if (document.embeddings.length > 0) {
            console.log("- First embedding dimensions:", document.embeddings[0]?.length)
          }
        } catch (embeddingError) {
          console.error("❌ Failed to generate embeddings:", embeddingError)
          throw new Error(`Failed to generate embeddings: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`)
        }
      } else {
        console.log("✅ Document already has valid embeddings")
        console.log("- Embedding dimensions:", document.embeddings[0]?.length)
      }

      // Validate embeddings
      if (!document.embeddings || document.embeddings.length !== document.chunks.length) {
        console.error("Embedding validation failed:")
        console.error("- Embeddings exist:", !!document.embeddings)
        console.error("- Embeddings length:", document.embeddings?.length)
        console.error("- Chunks length:", document.chunks.length)
        throw new Error("Failed to generate valid embeddings for document")
      }

      // Check if embeddings are properly formatted
      console.log("Validating embedding format...")
      for (let i = 0; i < document.embeddings.length; i++) {
        if (!Array.isArray(document.embeddings[i]) || document.embeddings[i].length === 0) {
          console.error(`Invalid embedding at index ${i}:`, document.embeddings[i])
          throw new Error(`Invalid embedding at index ${i}`)
        }
        
        // Log first few embedding details
        if (i < 3) {
          console.log(`  Embedding ${i}: ${document.embeddings[i].length} dimensions`)
        }
      }

      // Add to documents array
      const beforeCount = this.documents.length
      this.documents.push(document)
      const afterCount = this.documents.length
      
      console.log("✅ Document added successfully to RAG engine")
      console.log("- Documents before:", beforeCount)
      console.log("- Documents after:", afterCount)
      console.log("- Document name:", document.name)
      console.log("- Chunks:", document.chunks.length)
      console.log("- Total documents in RAG engine:", this.documents.length)
      
      // Verify the document was actually added
      const addedDoc = this.documents.find(d => d.id === document.id)
      if (addedDoc) {
        console.log("✅ Document verification: Successfully found in RAG engine documents array")
      } else {
        console.error("❌ Document verification: NOT found in RAG engine documents array")
      }
      
      console.log("=== RAG Engine: Document addition complete ===")
      
    } catch (error) {
      console.error("❌ Error adding document to RAG engine:", error)
      console.error("Document details:", {
        name: document?.name,
        id: document?.id,
        hasChunks: !!document?.chunks,
        chunksLength: document?.chunks?.length,
        hasEmbeddings: !!document?.embeddings,
        embeddingsLength: document?.embeddings?.length
      })
      throw error
    }
  }

  private findRelevantChunks(questionEmbedding: number[], topK: number) {
    const allChunks: Array<{ content: string; source: string; similarity: number }> = [];

    try {
      console.log("findRelevantChunks: Starting chunk search")
      
      // Validate inputs
      if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
        console.error("Invalid question embedding:", questionEmbedding);
        return [];
      }

      if (!Array.isArray(this.documents) || this.documents.length === 0) {
        console.error("No documents available:", this.documents.length);
        return [];
      }

      if (!this.aiClient) {
        console.error("AI client not available");
        return [];
      }

      console.log(`Processing ${this.documents.length} documents for similarity search`)

      // Calculate similarity for all chunks
      this.documents.forEach((doc, docIndex) => {
        try {
          console.log(`Processing document ${docIndex}: ${doc.name}`)
          
          // Validate document structure
          if (!doc || !doc.chunks || !doc.embeddings) {
            console.warn(`Document ${docIndex} has invalid structure:`, {
              hasDoc: !!doc,
              hasChunks: !!doc?.chunks,
              hasEmbeddings: !!doc?.embeddings
            });
            return;
          }

          if (!Array.isArray(doc.chunks) || !Array.isArray(doc.embeddings)) {
            console.warn(`Document ${docIndex} has invalid chunks or embeddings:`, {
              chunksIsArray: Array.isArray(doc.chunks),
              embeddingsIsArray: Array.isArray(doc.embeddings)
            });
            return;
          }

          if (doc.chunks.length !== doc.embeddings.length) {
            console.warn(`Document ${docIndex} has mismatched chunks and embeddings:`, {
              chunksLength: doc.chunks.length,
              embeddingsLength: doc.embeddings.length
            });
            return;
          }

          console.log(`Document ${docIndex} has ${doc.chunks.length} valid chunks`)

          doc.chunks.forEach((chunk, chunkIndex) => {
            try {
              const chunkEmbedding = doc.embeddings[chunkIndex];

              // Validate chunk embedding
              if (!Array.isArray(chunkEmbedding) || chunkEmbedding.length === 0) {
                console.warn(`Invalid embedding for chunk ${chunkIndex} in document ${docIndex}:`, {
                  isArray: Array.isArray(chunkEmbedding),
                  length: chunkEmbedding?.length
                });
                return;
              }

              if (chunkEmbedding.length !== questionEmbedding.length) {
                console.warn(`Embedding dimension mismatch for chunk ${chunkIndex} in document ${docIndex}:`, {
                  chunkDimensions: chunkEmbedding.length,
                  questionDimensions: questionEmbedding.length
                });
                return;
              }

              // Calculate cosine similarity
              const similarity = this.aiClient!.cosineSimilarity(questionEmbedding, chunkEmbedding);

              if (typeof similarity === "number" && !isNaN(similarity)) {
                allChunks.push({
                  content: chunk || "",
                  source: `${doc.name || "Unknown Document"} (chunk ${chunkIndex + 1})`,
                  similarity,
                });
                
                // Log high-similarity chunks
                if (similarity > 0.3) {
                  console.log(`High similarity chunk found: ${similarity.toFixed(3)} from ${doc.name}`)
                }
              } else {
                console.warn(`Invalid similarity calculated for chunk ${chunkIndex} in document ${docIndex}:`, similarity);
              }
            } catch (chunkError) {
              console.error(`Error processing chunk ${chunkIndex} in document ${docIndex}:`, chunkError);
            }
          });
        } catch (docError) {
          console.error(`Error processing document ${docIndex}:`, docError);
        }
      });

      console.log(`Total chunks processed: ${allChunks.length}`)
      
      if (allChunks.length === 0) {
        console.warn("No chunks were successfully processed")
        return [];
      }

      // Sort by similarity and return top K
      const sortedChunks = allChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter((chunk) => chunk.similarity > 0.05); // Lower threshold for debugging

      console.log(`Returning ${sortedChunks.length} chunks (threshold: 0.05, topK: ${topK})`)
      if (sortedChunks.length > 0) {
        console.log(`Best similarity: ${sortedChunks[0].similarity.toFixed(3)}`)
        console.log(`Worst similarity: ${sortedChunks[sortedChunks.length - 1].similarity.toFixed(3)}`)
      }

      return sortedChunks;
    } catch (error) {
      console.error("Error finding relevant chunks:", error);
      return [];
    }
  }

  async query(question: string, options?: { 
    showThinking?: boolean, 
    tokenBudget?: number,
    complexityLevel?: 'simple' | 'normal' | 'complex'
  }): Promise<EnhancedQueryResponse> {
    console.log("Enhanced RAG query started:", question);

    // Initialize processing options
    const showThinking = options?.showThinking ?? false
    const tokenBudget = options?.tokenBudget ?? 4000
    const complexityLevel = options?.complexityLevel ?? 'normal'

    // Create default response structure
    const defaultResponse: EnhancedQueryResponse = {
      answer: "I apologize, but I couldn't process your question properly.",
      sources: [],
      relevanceScore: 0,
      retrievedChunks: [],
      qualityMetrics: {
        accuracyScore: 0,
        completenessScore: 0,
        clarityScore: 0,
        confidenceScore: 0,
        finalRating: 0
      },
      tokenUsage: {
        contextTokens: 0,
        reasoningTokens: 0,
        responseTokens: 0,
        totalTokens: 0
      }
    };

    try {
      // Validate system state
      if (!this.isInitialized || !this.aiClient) {
        return {
          ...defaultResponse,
          answer: "The system is not properly initialized. Please configure your AI provider and try again.",
        };
      }

      // Validate input
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return {
          ...defaultResponse,
          answer: "Please provide a valid question.",
        };
      }

      // Determine processing approach based on complexity
      return await this.processQueryEnhanced(question, tokenBudget, complexityLevel, showThinking)

    } catch (error) {
      console.error("Error in enhanced RAG query:", error);
      return {
        ...defaultResponse,
        answer: "I encountered an error while processing your request. Please try again later.",
      };
    }
  }

  private async processQueryEnhanced(
    question: string, 
    tokenBudget: number, 
    complexityLevel: string,
    showThinking: boolean
  ): Promise<EnhancedQueryResponse> {
    
    // Phase-based token allocation
    const tokenAllocation = this.calculateTokenAllocation(tokenBudget, complexityLevel)
    
    // Phase 1: Context Analysis and Initial Response
    const phase1Result = await this.phase1_ContextAnalysis(question, tokenAllocation.context)
    
    // Phase 2: Self-Critique and Validation (only for normal/complex queries)
    const phase2Result = complexityLevel === 'simple' 
      ? null 
      : await this.phase2_SelfCritique(phase1Result, tokenAllocation.critique)
    
    // Phase 3: Refinement and Final Response
    const phase3Result = await this.phase3_Refinement(
      phase1Result, 
      phase2Result, 
      tokenAllocation.refinement,
      showThinking
    )

    return phase3Result
  }

  private calculateTokenAllocation(budget: number, complexity: string) {
    const allocations = {
      'simple': { context: 0.6, critique: 0.0, refinement: 0.4 },
      'normal': { context: 0.4, critique: 0.3, refinement: 0.3 },
      'complex': { context: 0.3, critique: 0.4, refinement: 0.3 }
    }
    
    const allocation = allocations[complexity as keyof typeof allocations]
    
    return {
      context: Math.floor(budget * allocation.context),
      critique: Math.floor(budget * allocation.critique), 
      refinement: Math.floor(budget * allocation.refinement)
    }
  }

  private async phase1_ContextAnalysis(question: string, tokenBudget: number) {
    console.log("Phase 1: Context Analysis and Initial Response")
    
    // Debug: Check system state
    console.log("RAG Engine Debug:")
    console.log("- Documents available:", this.documents.length)
    console.log("- AI Client available:", !!this.aiClient)
    console.log("- Is initialized:", this.isInitialized)
    
    if (this.documents.length === 0) {
      console.warn("No documents available for retrieval")
      return {
        question,
        relevantChunks: [],
        context: "",
        initialResponse: "No documents have been uploaded yet. Please upload documents first to get answers.",
        questionType: 'general',
        tokensUsed: 0
      }
    }

    // Debug: Log documents info
    this.documents.forEach((doc, index) => {
      console.log(`Document ${index}: ${doc.name}, chunks: ${doc.chunks?.length || 0}, embeddings: ${doc.embeddings?.length || 0}`)
    })
    
    try {
      // Generate embedding for the question
      console.log("Generating embedding for question:", question.substring(0, 100) + "...")
      const questionEmbedding = await this.aiClient!.generateEmbedding(question);
      console.log("Question embedding generated, dimensions:", questionEmbedding.length)
      
      // Analyze question type for optimal chunk selection
      const questionType = this.analyzeQuestionType(question)
      const chunkLimit = this.getOptimalChunkLimit(questionType)
      console.log(`Question type: ${questionType}, chunk limit: ${chunkLimit}`)
      
      // Find relevant chunks
      console.log("Finding relevant chunks...")
      let relevantChunks = this.findRelevantChunks(questionEmbedding, chunkLimit);
      console.log(`Found ${relevantChunks.length} relevant chunks`)
      
      // Debug: Log chunk similarities
      if (relevantChunks.length > 0) {
        console.log("Top chunks:")
        relevantChunks.slice(0, 3).forEach((chunk, i) => {
          console.log(`  ${i + 1}. Similarity: ${chunk.similarity.toFixed(3)}, Source: ${chunk.source}`)
          console.log(`     Content preview: ${chunk.content.substring(0, 100)}...`)
        })
      } else {
        console.warn("No relevant chunks found - checking why...")
        
        // Debug: Check first document in detail
        if (this.documents.length > 0) {
          const firstDoc = this.documents[0]
          console.log("First document analysis:")
          console.log("- Name:", firstDoc.name)
          console.log("- Has chunks:", !!firstDoc.chunks)
          console.log("- Chunks length:", firstDoc.chunks?.length)
          console.log("- Has embeddings:", !!firstDoc.embeddings)
          console.log("- Embeddings length:", firstDoc.embeddings?.length)
          
          if (firstDoc.chunks && firstDoc.chunks.length > 0) {
            console.log("- First chunk preview:", firstDoc.chunks[0].substring(0, 100))
          }
          
          if (firstDoc.embeddings && firstDoc.embeddings.length > 0) {
            console.log("- First embedding dimensions:", firstDoc.embeddings[0]?.length)
            console.log("- Question embedding dimensions:", questionEmbedding.length)
          }
        }
      }
      
      if (relevantChunks.length === 0) {
        return {
          question,
          relevantChunks: [],
          context: "",
          initialResponse: "I couldn't find relevant information in the uploaded documents to answer your question. This might be because:\n\n1. The question doesn't match the document content\n2. The documents may not have processed correctly\n3. Try rephrasing your question\n\nDocument status: " + this.documents.length + " documents available with " + this.documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0) + " total chunks.",
          questionType,
          tokensUsed: 0
        }
      }

      // Optimize chunks for token budget
      console.log("Optimizing chunks for token budget:", tokenBudget * 0.7)
      const optimizedChunks = this.optimizeChunksForTokens(relevantChunks, tokenBudget * 0.7)
      console.log(`Optimized to ${optimizedChunks.length} chunks`)
      
      const context = optimizedChunks.map(chunk => chunk.content).join("\n\n");
      console.log("Context length:", context.length, "characters")
      
      // Generate initial response with enhanced prompt
      const systemPrompt = this.createEnhancedSystemPrompt(questionType)
      const userPrompt = this.createPhase1UserPrompt(question, context)
      
      console.log("Generating AI response...")
      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt }
      ];

      const initialResponse = await this.aiClient!.generateText(messages);
      console.log("AI response generated, length:", initialResponse.length)

      return {
        question,
        relevantChunks: optimizedChunks,
        context,
        initialResponse: initialResponse.trim(),
        questionType,
        tokensUsed: this.estimateTokens(systemPrompt + userPrompt + initialResponse)
      }
    } catch (error) {
      console.error("Error in phase1_ContextAnalysis:", error)
      return {
        question,
        relevantChunks: [],
        context: "",
        initialResponse: `Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        questionType: 'general',
        tokensUsed: 0
      }
    }
  }

  private async phase2_SelfCritique(phase1Result: any, tokenBudget: number) {
    console.log("Phase 2: Self-Critique and Validation")
    
    const critiquePrompt = this.createCritiquePrompt(phase1Result)
    
    const messages = [
      { 
        role: "system" as const, 
        content: "You are an AI critic. Review the response for accuracy, completeness, and source attribution. Use this format: ✓=verified, ?=uncertain, !=conflict, ∅=missing" 
      },
      { role: "user" as const, content: critiquePrompt }
    ];

    const critiqueResponse = await this.aiClient!.generateText(messages);
    
    // Parse critique response for issues
    const issues = this.parseCritiqueResponse(critiqueResponse)
    
    return {
      critiqueText: critiqueResponse.trim(),
      identifiedIssues: issues,
      tokensUsed: this.estimateTokens(critiquePrompt + critiqueResponse)
    }
  }

  private async phase3_Refinement(
    phase1Result: any, 
    phase2Result: any, 
    tokenBudget: number,
    showThinking: boolean
  ): Promise<EnhancedQueryResponse> {
    console.log("Phase 3: Refinement and Final Response")
    
    let refinementPrompt: string
    let finalResponse: string
    
    if (phase2Result) {
      // Complex processing with refinement
      refinementPrompt = this.createRefinementPrompt(phase1Result, phase2Result)
      
      const messages = [
        { 
          role: "system" as const, 
          content: "Create the final, polished response incorporating the critique. Be factual, well-structured, and properly cited." 
        },
        { role: "user" as const, content: refinementPrompt }
      ];

      finalResponse = await this.aiClient!.generateText(messages);
    } else {
      // Simple processing - use initial response
      finalResponse = phase1Result.initialResponse
    }

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      phase1Result, 
      phase2Result, 
      finalResponse
    )

    // Prepare final response
    let answer = finalResponse.trim()
    
    // Add thinking process if requested
    if (showThinking && phase2Result) {
      answer = `<thinking>
Initial Analysis: ${phase1Result.initialResponse}

Critical Review: ${phase2Result.critiqueText}

Final Refinement: Applied improvements based on critique
</thinking>

${finalResponse.trim()}`
    }

    // Calculate token usage
    const tokenUsage = {
      contextTokens: phase1Result.tokensUsed,
      reasoningTokens: phase2Result?.tokensUsed || 0,
      responseTokens: this.estimateTokens(finalResponse),
      totalTokens: phase1Result.tokensUsed + (phase2Result?.tokensUsed || 0) + this.estimateTokens(finalResponse)
    }

    // Prepare sources
    const sources = Array.from(
      new Set(phase1Result.relevantChunks.map((chunk: any) => chunk.source))
    ).filter(Boolean) as string[];

    return {
      answer,
      sources,
      relevanceScore: this.calculateRelevanceScore(phase1Result.relevantChunks),
      retrievedChunks: phase1Result.relevantChunks,
      reasoning: phase2Result ? {
        initialThoughts: phase1Result.initialResponse,
        criticalReview: phase2Result.critiqueText,
        finalRefinement: "Applied critique-based improvements"
      } : undefined,
      qualityMetrics,
      tokenUsage
    }
  }

  private analyzeQuestionType(question: string): string {
    const questionLower = question.toLowerCase()
    
    if (/(what are|list|summary|key points|main|overview)/i.test(question)) {
      return 'summary'
    } else if (/(how|why|explain|analyze|compare)/i.test(question)) {
      return 'analysis'
    } else if (/(when|date|time|timeline)/i.test(question)) {
      return 'timeline'
    } else if (/(number|amount|cost|price|data|statistics)/i.test(question)) {
      return 'data'
    } else if (/(process|steps|procedure|method)/i.test(question)) {
      return 'process'
    } else if (/(difference|versus|vs|compared to)/i.test(question)) {
      return 'comparison'
    }
    
    return 'general'
  }

  private getOptimalChunkLimit(questionType: string): number {
    const limits = {
      'summary': 8,
      'analysis': 6, 
      'timeline': 10,
      'data': 5,
      'process': 7,
      'comparison': 8,
      'general': 5
    }
    
    return limits[questionType as keyof typeof limits] || 5
  }

  private optimizeChunksForTokens(chunks: any[], tokenBudget: number) {
    let totalTokens = 0
    const optimizedChunks = []
    
    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens(chunk.content)
      if (totalTokens + chunkTokens <= tokenBudget) {
        optimizedChunks.push(chunk)
        totalTokens += chunkTokens
      } else {
        break
      }
    }
    
    return optimizedChunks
  }

  private createEnhancedSystemPrompt(questionType: string): string {
    const basePrompt = `You are an expert document analyst. Your responses must be:
1. FACTUALLY GROUNDED: Use ONLY information from provided context
2. WELL-STRUCTURED: Use appropriate formatting (tables, lists, headers)  
3. THOROUGHLY CITED: Reference specific sources
4. ERROR-AWARE: Flag inconsistencies or unclear information

QUALITY CHECKS:
- Mark uncertain info: [UNCLEAR FROM SOURCES]
- Flag conflicts: [CONFLICTING: Source A vs Source B]
- Use exact quotes: [QUOTE: "text" - Document X]
- Rate confidence: [HIGH/MEDIUM/LOW CONFIDENCE]

NEVER add information not in the provided context.`

    const typeSpecificPrompts = {
      'summary': '\nRESPONSE FORMAT: Executive summary with numbered key points and source table.',
      'analysis': '\nRESPONSE FORMAT: Structured analysis with reasoning, evidence, and conclusions.',
      'timeline': '\nRESPONSE FORMAT: Chronological table with dates, events, and sources.',
      'data': '\nRESPONSE FORMAT: Data table with numbers, units, and source verification.',
      'process': '\nRESPONSE FORMAT: Numbered steps with detailed procedures and requirements.',
      'comparison': '\nRESPONSE FORMAT: Comparison table showing similarities and differences.',
      'general': '\nRESPONSE FORMAT: Clear, structured response with proper headings.'
    }

    return basePrompt + (typeSpecificPrompts[questionType as keyof typeof typeSpecificPrompts] || typeSpecificPrompts.general)
  }

  private createPhase1UserPrompt(question: string, context: string): string {
    return `CONTEXT FROM DOCUMENTS:
${context}

QUESTION: ${question}

Provide a comprehensive, well-structured response based on the context above. Use tables for numerical data, lists for key points, and clear headings for organization.`
  }

  private createCritiquePrompt(phase1Result: any): string {
    return `REVIEW THIS RESPONSE FOR QUALITY:

QUESTION: ${phase1Result.question}

RESPONSE: ${phase1Result.initialResponse}

AVAILABLE CONTEXT: ${phase1Result.context.substring(0, 500)}...

CRITIQUE CHECKLIST:
✓ Factual accuracy - Are all claims supported by context?
✓ Completeness - Are all question aspects addressed?
✓ Source attribution - Are claims properly cited?
✓ Structure - Is the format appropriate?
✓ Consistency - Any internal contradictions?

Identify issues using: ✓=verified, ?=uncertain, !=conflict, ∅=missing
Be specific about what needs improvement.`
  }

  private createRefinementPrompt(phase1Result: any, phase2Result: any): string {
    return `REFINE THIS RESPONSE BASED ON CRITIQUE:

ORIGINAL QUESTION: ${phase1Result.question}

INITIAL RESPONSE: ${phase1Result.initialResponse}

CRITIQUE FINDINGS: ${phase2Result.critiqueText}

CONTEXT: ${phase1Result.context}

Create an improved final response that addresses the identified issues while maintaining factual accuracy and proper structure.`
  }

  private parseCritiqueResponse(critique: string): string[] {
    const issues = []
    
    if (critique.includes('?')) {
      issues.push('Uncertain information identified')
    }
    if (critique.includes('!')) {
      issues.push('Conflicting information found')  
    }
    if (critique.includes('∅')) {
      issues.push('Missing information noted')
    }
    if (critique.toLowerCase().includes('unsupported')) {
      issues.push('Unsupported claims detected')
    }
    if (critique.toLowerCase().includes('incomplete')) {
      issues.push('Incomplete coverage identified')
    }
    
    return issues
  }

  private calculateQualityMetrics(phase1Result: any, phase2Result: any, finalResponse: string) {
    // Basic quality scoring based on available information
    const hasSourceAttribution = finalResponse.includes('[') || finalResponse.includes('Document') || finalResponse.includes('Source')
    const hasClearStructure = finalResponse.includes('\n\n') || finalResponse.includes('##') || finalResponse.includes('1.')
    const usesContext = phase1Result.relevantChunks.length > 0
    const critiquePassed = !phase2Result || phase2Result.identifiedIssues.length === 0
    
    const accuracyScore = (hasSourceAttribution && usesContext && critiquePassed) ? 90 : 70
    const completenessScore = phase1Result.relevantChunks.length >= 3 ? 85 : 65
    const clarityScore = hasClearStructure ? 80 : 60  
    const confidenceScore = phase1Result.relevantChunks.length > 0 ? 
      Math.min(95, phase1Result.relevantChunks[0].similarity * 100) : 50
    
    const finalRating = (accuracyScore + completenessScore + clarityScore + confidenceScore) / 4
    
    return {
      accuracyScore,
      completenessScore,
      clarityScore,
      confidenceScore,
      finalRating
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  // Update the original query method signature for backward compatibility
  async querySimple(question: string): Promise<QueryResponse> {
    const enhancedResponse = await this.query(question, { complexityLevel: 'simple' })
    
    return {
      answer: enhancedResponse.answer,
      sources: enhancedResponse.sources,
      relevanceScore: enhancedResponse.relevanceScore,
      retrievedChunks: enhancedResponse.retrievedChunks
    }
  }

  private calculateRelevanceScore(chunks: Array<{ similarity: number }>): number {
    try {
      if (!Array.isArray(chunks) || chunks.length === 0) return 0

      const validSimilarities = chunks
        .map((chunk) => (chunk && typeof chunk.similarity === "number" ? chunk.similarity : 0))
        .filter((sim) => typeof sim === "number" && !isNaN(sim))

      if (validSimilarities.length === 0) return 0

      return validSimilarities.reduce((sum, sim) => sum + sim, 0) / validSimilarities.length
    } catch (error) {
      console.error("Error calculating relevance score:", error)
      return 0
    }
  }

  getDocuments(): Document[] {
    return Array.isArray(this.documents) ? this.documents : []
  }

  removeDocument(documentId: string) {
    try {
      if (!documentId || typeof documentId !== "string") {
        throw new Error("Invalid document ID")
      }

      const initialLength = this.documents.length
      this.documents = this.documents.filter((doc) => doc && doc.id !== documentId)

      const removedCount = initialLength - this.documents.length
      console.log(`Removed ${removedCount} document(s) with ID: ${documentId}`)
    } catch (error) {
      console.error("Error removing document:", error)
    }
  }

  clearDocuments() {
    try {
      this.documents = []
      console.log("Cleared all documents from RAG engine")
    } catch (error) {
      console.error("Error clearing documents:", error)
    }
  }

  // Health check method
  isHealthy(): boolean {
    try {
      return this.isInitialized && this.aiClient !== null && this.pdfParser !== null && Array.isArray(this.documents)
    } catch (error) {
      console.error("Error checking RAG engine health:", error)
      return false
    }
  }

  // Get status information
  getStatus() {
    try {
      return {
        initialized: this.isInitialized,
        documentCount: Array.isArray(this.documents) ? this.documents.length : 0,
        totalChunks: Array.isArray(this.documents)
          ? this.documents.reduce((total, doc) => {
              return total + (Array.isArray(doc.chunks) ? doc.chunks.length : 0)
            }, 0)
          : 0,
        healthy: this.isHealthy(),
        currentProvider: this.currentConfig?.provider,
        currentModel: this.currentConfig?.model,
        isHealthy: () => this.isHealthy(),
      }
    } catch (error) {
      console.error("Error getting RAG engine status:", error)
      return {
        initialized: false,
        documentCount: 0,
        totalChunks: 0,
        healthy: false,
        currentProvider: null,
        currentModel: null,
        isHealthy: () => false,
      }
    }
  }

  // Diagnostic method to help troubleshoot issues
  async runDiagnostics(): Promise<any> {
    console.log("=== RAG Engine Diagnostics ===")
    
    const diagnostics: {
      systemStatus: {
        initialized: boolean
        aiClientAvailable: boolean
        currentProvider: string | undefined
        currentModel: string | undefined
        documentsCount: number
        totalChunks: number
        totalEmbeddings: number
      }
      documents: Array<{
        index: number
        id: string
        name: string
        chunksCount: number
        embeddingsCount: number
        hasValidStructure: boolean
        firstChunkPreview: string
        embeddingDimension: number
      }>
      embeddingTest: {
        success: boolean
        dimensions?: number
        sampleValues?: number[]
        error?: string
      } | null
      similarityTest: {
        success: boolean
        similarity?: number
        testedAgainst?: string
      } | null
    } = {
      systemStatus: {
        initialized: this.isInitialized,
        aiClientAvailable: !!this.aiClient,
        currentProvider: this.currentConfig?.provider,
        currentModel: this.currentConfig?.model,
        documentsCount: this.documents.length,
        totalChunks: this.documents.reduce((total, doc) => total + (doc.chunks?.length || 0), 0),
        totalEmbeddings: this.documents.reduce((total, doc) => total + (doc.embeddings?.length || 0), 0)
      },
      documents: [],
      embeddingTest: null,
      similarityTest: null
    }

    // Document details
    diagnostics.documents = this.documents.map((doc, index) => ({
      index,
      id: doc.id,
      name: doc.name,
      chunksCount: doc.chunks?.length || 0,
      embeddingsCount: doc.embeddings?.length || 0,
      hasValidStructure: !!(doc.chunks && doc.embeddings && doc.chunks.length === doc.embeddings.length),
      firstChunkPreview: doc.chunks?.[0]?.substring(0, 100) + "..." || "No chunks",
      embeddingDimension: doc.embeddings?.[0]?.length || 0
    }))

    // Test embedding generation
    if (this.aiClient && this.isInitialized) {
      try {
        console.log("Testing embedding generation...")
        const testText = "This is a test for embedding generation"
        const testEmbedding = await this.aiClient.generateEmbedding(testText)
        diagnostics.embeddingTest = {
          success: true,
          dimensions: testEmbedding.length,
          sampleValues: testEmbedding.slice(0, 5)
        }
        console.log("✅ Embedding test successful")

        // Test similarity calculation if we have documents
        if (this.documents.length > 0 && this.documents[0].embeddings?.length > 0) {
          const firstDocEmbedding = this.documents[0].embeddings[0]
          const similarity = this.aiClient.cosineSimilarity(testEmbedding, firstDocEmbedding)
          diagnostics.similarityTest = {
            success: true,
            similarity,
            testedAgainst: `${this.documents[0].name} (chunk 1)`
          }
          console.log("✅ Similarity test successful:", similarity)
        }
      } catch (error) {
        diagnostics.embeddingTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.log("❌ Embedding test failed:", error)
      }
    }

    console.log("Diagnostics results:", diagnostics)
    console.log("=== End Diagnostics ===")
    return diagnostics
  }
}

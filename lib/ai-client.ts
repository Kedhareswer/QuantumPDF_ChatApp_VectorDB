// lib/ai-client.ts

interface AIConfig {
  provider:
    | "huggingface"
    | "openai"
    | "anthropic"
    | "aiml"
    | "groq"
    | "openrouter"
    | "cohere"
    | "deepinfra"
    | "deepseek"
    | "googleai"
    | "vertex"
    | "mistral"
    | "perplexity"
    | "together"
    | "xai"
    | "alibaba"
    | "minimax";
  apiKey: string;
  model: string; // Model for direct provider
  baseUrl?: string;
  ragoonServiceUrl?: string;
  capabilities?: Array<'text' | 'image' | 'audio'>; // New: Capabilities of the direct model
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface EmbeddingInput {
  inputType: "text" | "image_url"; // Add other types as RAGoon/models support them
  content: string; // Text content or URL for image
  modelName?: string | null; // Optional: request a specific RAGoon model config by name
  parameters?: Record<string, any>;
}

interface RagoonEmbeddingResponse {
  embedding: number[];
  modelUsed: string;
  dimensions: number;
}

export class AIClient {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  private async generateEmbeddingViaRAGoonService(input: EmbeddingInput): Promise<number[]> {
    if (!this.config.ragoonServiceUrl) {
      throw new Error("RAGoon service URL is not configured.");
    }
    const endpoint = `${this.config.ragoonServiceUrl.replace(/\/$/, "")}/embed`;
    console.log(`AIClient: Calling RAGoon service at ${endpoint} for inputType: ${input.inputType}`);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "Unknown error body");
        console.error(`AIClient: RAGoon service error. Status: ${response.status}. Body: ${errorBody}`);
        throw new Error(`RAGoon service request failed with status ${response.status}: ${errorBody}`);
      }
      const result: RagoonEmbeddingResponse = await response.json();
      if (!result.embedding || !Array.isArray(result.embedding) || result.embedding.length === 0) {
        console.error("AIClient: Invalid embedding array from RAGoon service", result);
        throw new Error("Invalid or empty embedding data from RAGoon service.");
      }
      console.log(`AIClient: Embedding received from RAGoon service using model ${result.modelUsed}, dimensions: ${result.dimensions}`);
      return result.embedding;
    } catch (error) {
      console.error("AIClient: Error calling RAGoon service:", error.message);
      throw error;
    }
  }

  // New method for direct multimodal calls (placeholder for now)
  private async generateDirectMultimodalEmbedding(input: EmbeddingInput): Promise<number[]> {
    console.log(`AIClient: [Direct Fallback] Attempting direct multimodal embedding for inputType '${input.inputType}'.`);
    // This is a placeholder. In a real scenario, this method would:
    // 1. Check this.config.provider and this.config.model to see if it's a known multimodal model.
    // 2. Make a specific API call to that provider's multimodal embedding endpoint.
    //    For example, if provider is 'huggingface' and model is a CLIP model,
    //    it might call '/api/huggingface/embedding' with parameters indicating image input.
    //    This might require the /api/huggingface/embedding endpoint to be multimodal-aware.
    // For now, as a safe placeholder, we will log and use the basic hash fallback.
    console.warn(`AIClient: [Direct Fallback] No specific direct multimodal provider implemented for '${this.config.provider}'. Using hash-based fallback for '${input.inputType}'.`);

    // Example of what it *could* do if HuggingFace backend was set up for it:
    // if (this.config.provider === "huggingface" && input.inputType === "image_url") {
    //   console.log(`AIClient: [Direct Fallback] Attempting to use HuggingFace for image URL: ${input.content} with model ${this.config.model}`);
    //   try {
    //     const response = await fetch("/api/huggingface/embedding", { // Assuming this endpoint can handle image URLs + multimodal models
    //       method: "POST",
    //       headers: { "Content-Type": "application/json" },
    //       body: JSON.stringify({
    //         image_url: input.content, // Or whatever the backend expects
    //         model: this.config.model, // Should be a multimodal model name
    //       }),
    //     });
    //     if (!response.ok) {
    //       const err = await response.text();
    //       throw new Error(`HF multimodal direct call failed: ${err}`);
    //     }
    //     const result = await response.json();
    //     if (result.embedding) return result.embedding;
    //     throw new Error("Invalid embedding from HF multimodal direct call");
    //   } catch (hfError) {
    //     console.error("AIClient: [Direct Fallback] HuggingFace multimodal attempt failed:", hfError.message);
    //     // Fall through to basic hash fallback
    //   }
    // }
    return this.generateFallbackEmbedding(input.content); // Basic hash fallback
  }

  private async executeDirectEmbeddingLogic(input: EmbeddingInput): Promise<number[]> {
    console.log(`AIClient: Executing direct embedding logic for inputType '${input.inputType}'.`);

    if (input.inputType === "image_url") {
      // Check if the configured direct model has 'image' capability
      const directModelCapabilities = this.config.capabilities || [];
      if (directModelCapabilities.includes('image')) {
        console.log(`AIClient: Direct model '${this.config.model}' has 'image' capability. Attempting direct multimodal embedding.`);
        try {
          return await this.generateDirectMultimodalEmbedding(input);
        } catch (multimodalError) {
          console.warn(`AIClient: Direct multimodal embedding failed (Error: ${multimodalError.message}). Falling back to hash-based embedding.`);
          return this.generateFallbackEmbedding(input.content);
        }
      } else {
        console.warn(`AIClient: Direct model '${this.config.model}' does not have 'image' capability listed or capabilities not defined. Using hash-based fallback for image input.`);
        return this.generateFallbackEmbedding(input.content);
      }
    } else if (input.inputType === "text") {
      const textContent = input.content;
      try {
        console.log(`AIClient: Generating text embedding directly using provider '${this.config.provider}'.`);
        switch (this.config.provider) {
          case "huggingface": return await this.generateHuggingFaceEmbedding(textContent);
          case "openai": return await this.generateOpenAIEmbedding(textContent);
          case "aiml": return await this.generateAIMLEmbedding(textContent);
          case "cohere": return await this.generateCohereEmbedding(textContent);
          case "vertex": return await this.generateVertexEmbedding(textContent);
          default:
            console.warn(`AIClient: Embedding generation not supported for direct provider: ${this.config.provider}. Using hash-fallback.`);
            return this.generateFallbackEmbedding(textContent);
        }
      } catch (directError) {
        console.error(`AIClient: Error in direct text embedding with ${this.config.provider}:`, directError.message);
        console.log("AIClient: Attempting final hash-fallback for text...");
        return this.generateFallbackEmbedding(textContent);
      }
    } else {
      console.warn(`AIClient: Unsupported inputType '${input.inputType}' in executeDirectEmbeddingLogic. Using hash-fallback.`);
      return this.generateFallbackEmbedding(input.content);
    }
  }

  async generateEmbedding(input: EmbeddingInput): Promise<number[]> {
    if (!input || typeof input.content !== "string" || input.content.trim().length === 0) {
      throw new Error("Invalid content for embedding generation: Content must be a non-empty string.");
    }
    if (!input.inputType || (input.inputType !== "text" && input.inputType !== "image_url")) {
        throw new Error("Invalid inputType for embedding generation: Must be 'text' or 'image_url'.");
    }

    if (this.config.ragoonServiceUrl) {
      try {
        console.log("AIClient: Attempting to generate embedding via RAGoon service.");
        return await this.generateEmbeddingViaRAGoonService(input);
      } catch (ragoonError) {
        console.warn(`AIClient: RAGoon service call failed (Error: ${ragoonError.message}). Falling back to direct provider logic.`);
        return await this.executeDirectEmbeddingLogic(input);
      }
    } else {
      console.log("AIClient: RAGoon service URL not configured. Using direct provider logic.");
      return await this.executeDirectEmbeddingLogic(input);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        console.warn(`AIClient:generateEmbeddings - Skipping invalid text at index ${i}, using fallback.`);
        embeddings.push(this.generateFallbackEmbedding("invalid input"));
        continue;
      }
      const input: EmbeddingInput = { inputType: "text", content: text };
      try {
        const embedding = await this.generateEmbedding(input);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`AIClient:generateEmbeddings - Error for text at index ${i} ('${text.substring(0,30)}...'):`, error.message);
        embeddings.push(this.generateFallbackEmbedding(text));
      }
    }
    return embeddings;
  }

  // --- Unchanged methods from here onwards (provider specifics, utils, etc.) ---
  // (generateHuggingFaceEmbedding, generateOpenAIEmbedding, etc. are called by executeDirectEmbeddingLogic)
  // (generateText, testConnection, etc. are also unchanged)

  private async generateHuggingFaceEmbedding(text: string): Promise<number[]> {
    console.log("AIClient: [Direct Text] Making server-side Hugging Face API request for embedding");
    try {
      const response = await fetch("/api/huggingface/embedding", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ text: text, model: "sentence-transformers/all-MiniLM-L6-v2", }), // This is a text model
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error("Invalid embedding response from server");
      }
      return result.embedding;
    } catch (error) {
      throw new Error(`Hugging Face text embedding API request failed: ${error.message}`);
    }
  }

  private async generateHuggingFaceText(messages: ChatMessage[]): Promise<string> {
    const prompt = this.formatMessagesForHuggingFace(messages);
    const context = messages.find((m) => m.role === "system")?.content || "";
    const response = await fetch("/api/huggingface/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ prompt: prompt, context: context, model: this.config.model, }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.statusText}`);
    }
    const result = await response.json();
    return result.text || "No response generated";
  }

  private async testHuggingFaceConnection(): Promise<boolean> {
    try {
      const response = await fetch("/api/test/huggingface", {
        method: "POST", headers: { "Content-Type": "application/json", }});
      return response.ok;
    } catch { return false; }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    console.log(`AIClient: [Direct Text] Making OpenAI API request to: ${baseUrl}/embeddings`);
    try {
      // For OpenAI, you might use a specific multimodal embedding model if 'input.inputType' was 'image_url'
      // and this method was enhanced to receive the full 'EmbeddingInput'.
      // However, current 'executeDirectEmbeddingLogic' only calls this for text.
      const modelToUse = (this.config.provider === "openai" && this.config.model.startsWith("text-embedding"))
                         ? this.config.model
                         : "text-embedding-3-small";

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
        body: JSON.stringify({ model: modelToUse, input: text, }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) errorMessage = errorData.error.message;
        } catch (parseError) { console.warn("Could not parse OpenAI error response as JSON");}
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }
      const result = await response.json();
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0 ||
          !result.data[0].embedding || !Array.isArray(result.data[0].embedding)) {
        throw new Error("Invalid embedding data from OpenAI API");
      }
      return result.data[0].embedding;
    } catch (error) {
      throw new Error(`OpenAI text embedding API request failed: ${error.message}`);
    }
  }

  private async generateOpenAIText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7, }),
    });
    if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
    const result = await response.json();
    return result.choices[0].message.content;
  }

  private async testOpenAIConnection(): Promise<boolean> {
    try {
      await this.generateOpenAIText([{ role: "user", content: "test" }]);
      return true;
    } catch { return false; }
  }

  private async generateAIMLEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1";
    console.log(`AIClient: [Direct Text] Making AIML API request to: ${baseUrl}/embeddings`);
    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text, }), // Defaulting to a text model
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) errorMessage = errorData.error.message;
          else if (errorData.message) errorMessage = errorData.message;
        } catch (parseError) { console.warn("Could not parse AIML error response as JSON");}
        throw new Error(`AIML API error: ${errorMessage}`);
      }
      const result = await response.json();
      if (!result.data || !Array.isArray(result.data) || result.data.length === 0 ||
          !result.data[0].embedding || !Array.isArray(result.data[0].embedding)) {
        throw new Error("Invalid embedding data from AIML API");
      }
      return result.data[0].embedding;
    } catch (error) {
      throw new Error(`AIML text embedding API request failed: ${error.message}`);
    }
  }

  private async generateAIMLText(messages: ChatMessage[]): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.aimlapi.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
      body: JSON.stringify({ model: this.config.model, messages: messages, temperature: 0.1, top_p: 0.1, frequency_penalty: 1, max_tokens: 551, top_k:0 }),
    });
    if (!response.ok) throw new Error(`AIML API error: ${response.statusText}`);
    const result = await response.json();
    return result.choices[0].message.content;
  }

  private async testAIMLConnection(): Promise<boolean> {
    try {
      await this.generateAIMLEmbedding("test connection");
      return true;
    } catch (error) { console.error("AIML connection test failed:", error); return false; }
  }

  private async generateAnthropicText(messages: ChatMessage[]): Promise<string> {
    // ... (unchanged)
    const baseUrl = this.config.baseUrl || "https://api.anthropic.com";
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": this.config.apiKey, "Content-Type": "application/json", "anthropic-version": "2023-06-01", },
      body: JSON.stringify({ model: this.config.model, max_tokens: 500, messages: messages.filter(m=>m.role !== "system"), system: messages.find(m=>m.role === "system")?.content }),
    });
    if (!response.ok) throw new Error(`Anthropic API error: ${response.statusText}`);
    const result = await response.json();
    return result.content[0].text;
  }

  private async testAnthropicConnection(): Promise<boolean> {
    // ... (unchanged)
    try { await this.generateAnthropicText([{ role: "user", content: "test" }]); return true; }
    catch { return false; }
  }

  private async generateGroqText(messages: ChatMessage[]): Promise<string> {
    // ... (unchanged)
    const baseUrl = this.config.baseUrl || "https://api.groq.com/openai/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
      body: JSON.stringify({ model: this.config.model, messages: messages, max_tokens: 500, temperature: 0.7, }),
    });
    if (!response.ok) throw new Error(`Groq API error: ${response.statusText}`);
    const result = await response.json();
    return result.choices[0].message.content;
  }

  private async testGroqConnection(): Promise<boolean> {
    // ... (unchanged)
    try { await this.generateGroqText([{ role: "user", content: "test" }]); return true; }
    catch { return false; }
  }

  private formatMessagesForHuggingFace(messages: ChatMessage[]): string {
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  }

  private generateFallbackEmbedding(text: string): number[] {
    console.log("AIClient: Generating final fallback hash-based embedding for text length:", text.length);
    const words = text.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
    const dimension = 384;
    const embedding = new Array(dimension).fill(0);
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[hash % dimension] += 1 / (index + 1);
    });
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0));
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    // ... (unchanged)
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // --- Other Provider Stubs ---
  // ... (test and generateText methods for OpenRouter, Cohere (text), DeepInfra, etc. remain unchanged)
  // ... (generateCohereEmbedding and generateVertexEmbedding are text-only for direct path)

  private async testOpenRouterConnection(): Promise<boolean> { return this.simpleTestConnection("openrouter"); }
  private async generateOpenRouterText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("openrouter", messages); }
  private async testCohereConnection(): Promise<boolean> { return this.simpleTestConnection("cohere"); }
  private async generateCohereText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("cohere", messages); }

  private async generateCohereEmbedding(text: string): Promise<number[]> {
    const baseUrl = this.config.baseUrl || "https://api.cohere.ai/v1";
    console.log(`AIClient: [Direct Text] Making Cohere API request to: ${baseUrl}/embed`);
    const response = await fetch(`${baseUrl}/embed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json", },
        body: JSON.stringify({ texts: [text], model: "embed-english-v3.0", input_type: "search_document", }),
      });
    if (!response.ok) throw new Error(`Cohere API error: ${response.statusText}`);
    const result = await response.json();
    return result.embeddings[0];
  }

  private async testDeepInfraConnection(): Promise<boolean> { return this.simpleTestConnection("deepinfra"); }
  private async generateDeepInfraText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("deepinfra", messages); }
  private async testDeepSeekConnection(): Promise<boolean> { return this.simpleTestConnection("deepseek"); }
  private async generateDeepSeekText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("deepseek", messages); }
  private async testGoogleAIConnection(): Promise<boolean> { return this.simpleTestConnection("googleai"); }
  private async generateGoogleAIText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("googleai", messages); }

  private async testVertexConnection(): Promise<boolean> { return this.simpleTestConnection("vertex"); }
  private async generateVertexText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("vertex", messages); }
  private async generateVertexEmbedding(text: string): Promise<number[]> {
    console.log("AIClient: [Direct Text] Vertex embedding (simplified/placeholder)");
    return this.simpleGenerateEmbedding("vertex", text); // Uses placeholder for text
  }

  private async testMistralConnection(): Promise<boolean> { return this.simpleTestConnection("mistral"); }
  private async generateMistralText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("mistral", messages); }
  // ... (and so on for other simpleTestConnection and simpleGenerateText stubs)
  private async testPerplexityConnection(): Promise<boolean> { return this.simpleTestConnection("perplexity"); }
  private async generatePerplexityText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("perplexity", messages); }
  private async testTogetherConnection(): Promise<boolean> { return this.simpleTestConnection("together"); }
  private async generateTogetherText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("together", messages); }
  private async testXAIConnection(): Promise<boolean> { return this.simpleTestConnection("xai"); }
  private async generateXAIText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("xai", messages); }
  private async testAlibabaConnection(): Promise<boolean> { return this.simpleTestConnection("alibaba"); }
  private async generateAlibabaText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("alibaba", messages); }
  private async testMiniMaxConnection(): Promise<boolean> { return this.simpleTestConnection("minimax"); }
  private async generateMiniMaxText(messages: ChatMessage[]): Promise<string> { return this.simpleGenerateText("minimax", messages); }

  private async simpleTestConnection(provider: string): Promise<boolean> {
    try { console.log(`Testing ${provider} connection (simplified)`); return !!this.config.apiKey; }
    catch { return false; }
  }
  private async simpleGenerateText(provider: string, messages: ChatMessage[]): Promise<string> {
    console.log(`Generating text with ${provider} (simplified)`);
    if (!this.config.apiKey) throw new Error(`${provider} API key not provided`);
    const userMessage = messages.find((m) => m.role === "user")?.content || "No user message";
    return `Placeholder response from ${provider} for: "${userMessage.substring(0, 50)}..."`;
  }
  private async simpleGenerateEmbedding(provider: string, text: string): Promise<number[]> { // This is only for text
    console.log(`Generating text embedding with ${provider} (simplified) for: ${text.substring(0,30)}`);
    const d = 384, e = new Array(d).fill(0);
    for (let i=0;i<text.length;i++) e[text.charCodeAt(i)%d]+=text.charCodeAt(i)/128;
    const m=Math.sqrt(e.reduce((s,v)=>s+v*v,0));
    return e.map(v=>(m>0?v/m:0));
  }
}

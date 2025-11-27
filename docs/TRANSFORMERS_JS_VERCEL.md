# Using Transformers.js on Vercel

## Overview

Transformers.js allows running transformer models directly in JavaScript/TypeScript, either in the browser or Node.js. This guide covers using it with Vercel deployments.

## ⚠️ Vercel Limitations

### Serverless Function Limits

- **Hobby Plan**: 50MB function size limit
- **Pro Plan**: 250MB function size limit
- **Enterprise**: Custom limits
- **Edge Functions**: 1MB limit (not suitable for models)

### Model Size Considerations

Even "small" models can be large:
- **Sentence Transformers (embeddings)**: 50-100MB
- **Small Language Models**: 100-500MB
- **Quantized Models**: 20-50MB (better option)

## ✅ Recommended Approaches

### Option 1: Client-Side Embeddings (Best for Vercel)

Run embeddings in the browser using transformers.js:

```typescript
// lib/client-embeddings.ts
import { pipeline, env } from '@xenova/transformers'

// Disable local model files (use CDN)
env.allowLocalModels = false
env.remoteURL = 'https://huggingface.co'

export class ClientEmbeddingGenerator {
  private pipe: any = null

  async initialize() {
    if (!this.pipe) {
      // Use a small, quantized model
      this.pipe = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2', // ~23MB, good for embeddings
        { quantized: true }
      )
    }
    return this.pipe
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const pipe = await this.initialize()
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  }
}
```

**Pros:**
- No serverless size limits
- Works on Vercel
- Reduces API costs
- Fast for small batches

**Cons:**
- Initial model download (cached in browser)
- Limited to browser-supported models
- User's device does the computation

### Option 2: Hybrid Approach (Recommended)

Use transformers.js for query expansion/rewriting, keep embeddings on server:

```typescript
// lib/query-expander.ts (Server-side, but lightweight)
import { pipeline } from '@xenova/transformers'

// Use a very small model for query expansion
const expander = await pipeline(
  'text2text-generation',
  'Xenova/LaMini-Flan-T5-783M', // ~300MB - too large for Vercel
  // Better: Use API for this
)

// Instead, use a rule-based or API-based approach
export async function expandQuery(query: string): Promise<string> {
  // Use your existing AI client for query expansion
  // This avoids model size issues
}
```

### Option 3: External Model Hosting

Host models separately and call via API:

```typescript
// Use Hugging Face Inference API or your own model server
const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${HF_TOKEN}` },
  body: JSON.stringify({ inputs: text })
})
```

## 🚫 What Won't Work on Vercel

1. **Large Models in Serverless Functions**
   - Models > 50MB (Hobby) or 250MB (Pro) won't deploy
   - Even if they fit, cold starts are slow

2. **Edge Functions with Models**
   - 1MB limit makes this impossible

3. **Persistent Model Storage**
   - Serverless functions are stateless
   - Models would need to download on each invocation (very slow)

## ✅ Best Practice: Current Architecture

Your current setup is actually optimal for Vercel:

1. **Embeddings via API** (OpenAI, Hugging Face, etc.)
   - No model size limits
   - Fast, reliable
   - Handled by external services

2. **Query Expansion via AI Client**
   - Uses your existing AI provider
   - No local models needed

3. **Client-Side Caching**
   - Zustand with localStorage for conversation history
   - No server-side state needed

## 🔄 If You Really Want Transformers.js

### For Client-Side (Browser)

```typescript
// components/embedding-generator.tsx
'use client'

import { useEffect, useState } from 'react'
import { pipeline } from '@xenova/transformers'

export function useClientEmbeddings() {
  const [pipe, setPipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
      .then(setPipe)
      .finally(() => setLoading(false))
  }, [])

  const generateEmbedding = async (text: string) => {
    if (!pipe) return null
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  }

  return { generateEmbedding, loading, ready: !!pipe }
}
```

### For Server-Side (Alternative Deployment)

If you need server-side transformers.js, consider:

1. **Railway/Render/Fly.io**: No strict size limits
2. **Dedicated VPS**: Full control
3. **AWS Lambda with Layers**: Up to 10GB (but complex setup)

## 📊 Comparison

| Approach | Vercel Compatible | Model Size | Speed | Cost |
|----------|------------------|------------|-------|------|
| Current (API-based) | ✅ Yes | N/A | Fast | API costs |
| Client-side transformers.js | ✅ Yes | 20-50MB | Medium | Free |
| Server-side transformers.js | ❌ No (size limits) | 50-500MB | Slow (cold starts) | Free |
| External API (HF Inference) | ✅ Yes | N/A | Fast | Free tier available |

## 🎯 Recommendation

**Stick with your current architecture** for Vercel:
- ✅ Works perfectly on Vercel
- ✅ No size limit issues
- ✅ Fast and reliable
- ✅ Already implemented

**Only consider transformers.js if:**
- You want to reduce API costs significantly
- You're okay with client-side computation
- You need offline capabilities
- You're deploying elsewhere (not Vercel)

## Implementation Example (Client-Side)

If you want to add client-side embeddings as an option:

```typescript
// lib/embedding-provider.ts
export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
}

// lib/api-embedding-provider.ts (Current)
export class APIEmbeddingProvider implements EmbeddingProvider {
  constructor(private aiClient: AIClient) {}
  
  async generateEmbedding(text: string) {
    return this.aiClient.generateEmbedding(text)
  }
  
  async generateEmbeddings(texts: string[]) {
    return this.aiClient.generateEmbeddings(texts)
  }
}

// lib/client-embedding-provider.ts (New, optional)
export class ClientEmbeddingProvider implements EmbeddingProvider {
  private pipe: any = null
  
  async initialize() {
    if (!this.pipe) {
      const { pipeline } = await import('@xenova/transformers')
      this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
    }
  }
  
  async generateEmbedding(text: string) {
    await this.initialize()
    const output = await this.pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(output.data)
  }
  
  async generateEmbeddings(texts: string[]) {
    await this.initialize()
    // Batch processing
    const results = await Promise.all(texts.map(t => this.generateEmbedding(t)))
    return results
  }
}
```

Then in your RAG engine, allow switching:

```typescript
// lib/rag-engine.ts
export class RAGEngine {
  private embeddingProvider: EmbeddingProvider
  
  constructor(embeddingProvider?: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider || new APIEmbeddingProvider(this.aiClient)
  }
  
  async generateEmbedding(text: string) {
    return this.embeddingProvider.generateEmbedding(text)
  }
}
```

## Summary

**For Vercel**: Your current API-based approach is the best choice. Transformers.js is better suited for:
- Client-side applications
- Alternative hosting (Railway, Render, etc.)
- Offline capabilities
- Cost reduction (if API costs are high)

The conversation persistence you requested is more valuable than adding transformers.js for Vercel deployment.


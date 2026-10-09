// lib/ai-client.ts
//
// Multi-provider AI gateway. Every call is a raw `fetch` from wherever the
// client is constructed (browser for the chat UI, Node for API routes), with
// the user's own key (BYOK).
//
// Providers fall into four wire protocols:
//   - "openai"      POST {base}/chat/completions and {base}/embeddings
//   - "anthropic"   POST {base}/v1/messages (native Messages API)
//   - "gemini"      POST {base}/models/{model}:generateContent / :batchEmbedContents
//   - "huggingface" proxied through /api/huggingface/* so a server-side token works too
// Everything provider-specific lives in PROVIDER_SPECS; the request/response
// code below is shared, so a fix to retries or streaming lands everywhere.

import { logger } from "./logger"
import { DEFAULT_EMBEDDING_DIMENSION } from "./vector-dimensions"

export type AIProvider =
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

export interface AIConfig {
  provider: AIProvider
  apiKey: string // User-provided API key for the selected provider
  model: string // Model name for the selected provider
  baseUrl?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface GenerateOptions {
  temperature?: number
  /** Output-token ceiling. Reasoning models spend part of this on thinking. */
  maxTokens?: number
  /**
   * "low" for cheap auxiliary calls (query rewriting, HyDE, critique) on models
   * that expose a reasoning-effort knob; ignored everywhere else.
   */
  effort?: "low" | "default"
}

type Protocol = "openai" | "anthropic" | "gemini" | "huggingface"

interface ProviderSpec {
  protocol: Protocol
  baseUrl: string
  /** Has an embeddings endpoint this client can call. */
  embeddings: boolean
  /** Name of the output-token field on /chat/completions. */
  tokenParam?: "max_tokens" | "max_completion_tokens"
  headers?: Record<string, string>
}

const PROVIDER_SPECS: Record<AIProvider, ProviderSpec> = {
  openai: { protocol: "openai", baseUrl: "https://api.openai.com/v1", embeddings: true, tokenParam: "max_completion_tokens" },
  anthropic: { protocol: "anthropic", baseUrl: "https://api.anthropic.com", embeddings: false },
  googleai: { protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", embeddings: true },
  // Vertex speaks the same generateContent shape; baseUrl must carry the project
  // path and apiKey is an OAuth access token (see geminiUrl).
  vertex: { protocol: "gemini", baseUrl: "", embeddings: false },
  huggingface: { protocol: "huggingface", baseUrl: "https://router.huggingface.co/v1", embeddings: true },
  groq: { protocol: "openai", baseUrl: "https://api.groq.com/openai/v1", embeddings: false },
  openrouter: {
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    embeddings: false,
    headers: { "HTTP-Referer": "https://quantumpdf-chatapp.com", "X-Title": "QuantumPDF ChatApp" },
  },
  aiml: { protocol: "openai", baseUrl: "https://api.aimlapi.com/v1", embeddings: true },
  deepinfra: { protocol: "openai", baseUrl: "https://api.deepinfra.com/v1/openai", embeddings: true },
  deepseek: { protocol: "openai", baseUrl: "https://api.deepseek.com", embeddings: false },
  mistral: { protocol: "openai", baseUrl: "https://api.mistral.ai/v1", embeddings: true },
  perplexity: { protocol: "openai", baseUrl: "https://api.perplexity.ai/router/v1", embeddings: false },
  xai: { protocol: "openai", baseUrl: "https://api.x.ai/v1", embeddings: false },
  alibaba: { protocol: "openai", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", embeddings: true },
  minimax: { protocol: "openai", baseUrl: "https://api.minimax.io/v1", embeddings: false, tokenParam: "max_completion_tokens" },
  fireworks: { protocol: "openai", baseUrl: "https://api.fireworks.ai/inference/v1", embeddings: true },
  cerebras: { protocol: "openai", baseUrl: "https://api.cerebras.ai/v1", embeddings: false },
}

/** Whether the provider has a real embeddings API (vs. the local lexical fallback). */
export function providerSupportsEmbeddings(provider: AIProvider): boolean {
  return PROVIDER_SPECS[provider]?.embeddings ?? false
}

// ============================================================================
// MODEL TABLES
// ============================================================================

// Checked against official provider docs, October 2026.
export const PROVIDER_DEFAULT_TEXT_MODELS: Record<AIProvider, string> = {
  huggingface: "openai/gpt-oss-120b",
  openai: "gpt-5.6-terra",
  anthropic: "claude-sonnet-5-5",
  aiml: "google/gemini-3-6-flash",
  groq: "openai/gpt-oss-120b",
  openrouter: "openai/gpt-5.6-luna",
  deepinfra: "deepseek-ai/DeepSeek-V4-Flash-0731",
  deepseek: "deepseek-flash",
  googleai: "gemini-3.5-flash-lite",
  vertex: "gemini-3.5-flash-lite",
  mistral: "mistral-small-latest",
  perplexity: "perplexity/kimi-k3",
  xai: "grok-4.3",
  alibaba: "qwen3.8-max",
  minimax: "MiniMax-M3",
  fireworks: "accounts/fireworks/models/deepseek-v4p1-flash",
  cerebras: "gpt-oss-120b",
}

export const PROVIDER_DEFAULT_EMBEDDING_MODELS: Partial<Record<AIProvider, string>> = {
  huggingface: "Qwen/Qwen3-Embedding-0.6B",
  openai: "text-embedding-3-small",
  aiml: "openai/text-embedding-3-small",
  googleai: "gemini-embedding-001",
  fireworks: "nomic-ai/nomic-embed-text-v1.5",
  deepinfra: "Qwen/Qwen3-Embedding-0.6B",
  mistral: "mistral-embed",
  alibaba: "text-embedding-v4",
}

/**
 * Old model id -> current replacement.
 *
 * This is load-bearing, not cosmetic: `aiConfig` is persisted to localStorage by
 * lib/store.ts, so anyone who already picked a model keeps that exact string
 * across updates. Without an entry here, retiring an id from the dropdown leaves
 * existing users sending a model the provider no longer serves.
 *
 * Every id removed from AI_PROVIDERS in unified-configuration.tsx should appear
 * on the left-hand side of one of these maps.
 */
export const MODEL_MIGRATIONS: Partial<Record<AIProvider, Record<string, string>>> = {
  googleai: {
    "embedding-001": "gemini-embedding-001",
    "models/embedding-001": "gemini-embedding-001",
    "text-embedding-004": "gemini-embedding-001",
    "gemini-3-pro": "gemini-3.1-pro-preview",
    "gemini-3-pro-preview": "gemini-3.1-pro-preview",
    "gemini-2.0-flash": "gemini-3.5-flash-lite",
    // Shuts down 2027-05-07
    "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",
    // Restricted to existing users; Vertex retires them 2026-10-20
    "gemini-2.5-pro": "gemini-3.1-pro-preview",
    "gemini-2.5-flash": "gemini-3.8-flash",
    "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
  },
  openai: {
    "gpt-4-turbo-preview": "gpt-5.6-sol",
    // Shut down 2026-10-23
    "gpt-4o": "gpt-5.6-sol",
    "gpt-4-turbo": "gpt-5.6-sol",
    o1: "gpt-5.6-sol",
    // Shut down 2026-12-11
    "gpt-5-pro": "gpt-5.6-sol",
    "gpt-5-mini": "gpt-5.6-terra",
    "gpt-5-nano": "gpt-5.6-luna",
    "o3-2025-04-16": "gpt-5.6-sol",
    // gpt-5.1 leaves the API 2027-04-01; its listed replacement is gpt-6-sol.
    "gpt-5.1-chat-latest": "gpt-6-sol",
    "gpt-5.1": "gpt-6-sol",
  },
  anthropic: {
    // Superseded by the 5.5 generation at the same or lower price.
    "claude-sonnet-5": "claude-sonnet-5-5",
    "claude-opus-5": "claude-opus-5-5",
    "claude-fable-5": "claude-fable-5-1",
    "claude-opus-4-8": "claude-opus-5-5",
    "claude-sonnet-4-6": "claude-sonnet-5-5",
    // Retiring no sooner than 2026-10-15.
    "claude-haiku-4-5": "claude-haiku-5-5",
    // These two ids carried a 20250514 suffix that never existed for 4.5.
    "claude-sonnet-4-5-20250514": "claude-sonnet-5-5",
    "claude-haiku-4-5-20250514": "claude-haiku-5-5",
    // Retired per the official deprecations table.
    "claude-sonnet-4-20250514": "claude-sonnet-5-5",
    "claude-3-5-sonnet-20241022": "claude-sonnet-5-5",
    "claude-3-5-haiku-20241022": "claude-haiku-5-5",
    "claude-3-5-haiku-latest": "claude-haiku-5-5",
    "claude-3-opus-20240229": "claude-opus-5-5",
  },
  deepseek: {
    // deepseek-chat / deepseek-reasoner shut down 2026-07-24. deepseek-v4-flash is a
    // temporary alias; the canonical name is now deepseek-flash.
    "deepseek-r1": "deepseek-v4-pro",
    "deepseek-chat": "deepseek-flash",
    "deepseek-reasoner": "deepseek-v4-pro",
    "deepseek-v3.1": "deepseek-flash",
    "deepseek-coder": "deepseek-v4-pro",
    "deepseek-v4-flash": "deepseek-flash",
  },
  groq: {
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "meta-llama/llama-4-maverick-17b-128e-instruct": "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct": "openai/gpt-oss-20b",
    "moonshotai/kimi-k2-instruct-0905": "minimaxai/minimax-m2.7",
    "qwen/qwen3-32b": "qwen/qwen3.8-27b",
    // Retired 2026-09-14
    "qwen/qwen3.6-27b": "qwen/qwen3.8-27b",
    // Decommissioned 2026-09-21 with no replacement
    "groq/compound": "openai/gpt-oss-120b",
    "groq/compound-mini": "openai/gpt-oss-20b",
  },
  perplexity: {
    "llama-3.1-sonar-small-128k-online": "perplexity/kimi-k3",
    "llama-3.1-sonar-large-128k-online": "perplexity/kimi-k3",
    "llama-3.1-sonar-huge-128k-online": "perplexity/kimi-k3",
    sonar: "perplexity/kimi-k3",
    "sonar-pro": "perplexity/kimi-k3",
    "sonar-reasoning": "perplexity/glm-5.2",
    "sonar-reasoning-pro": "perplexity/glm-5.2",
    "sonar-deep-research": "perplexity/glm-5.2",
  },
  xai: {
    "grok-beta": "grok-4.3",
    "grok-3-beta": "grok-4.3",
    "grok-3-latest": "grok-4.3",
    "grok-3-mini-beta": "grok-4.3",
    "grok-3-mini": "grok-4.3",
    "grok-4-0709": "grok-4.5",
    "grok-vision": "grok-4.5",
    // Dated 4.20 slugs are no longer documented; retired slugs redirect to grok-4.3.
    "grok-4.20-0309-reasoning": "grok-4.3",
    "grok-4.20-0309-non-reasoning": "grok-4.3",
    "grok-4.20-multi-agent-0309": "grok-4.20-multi-agent",
  },
  mistral: {
    "mistral-large-2512": "mistral-large-latest",
    "mistral-medium-2508": "mistral-medium-latest",
    "mistral-small-2506": "mistral-small-latest",
    "ministral-3-14b-2512": "ministral-14b-latest",
    "ministral-3-8b-2512": "ministral-8b-latest",
    "ministral-3-3b-2512": "ministral-3b-latest",
    // These "-3-" aliases were never documented; Mistral's are ministral-*-latest.
    "ministral-3-14b-latest": "ministral-14b-latest",
    "ministral-3-8b-latest": "ministral-8b-latest",
    "ministral-3-3b-latest": "ministral-3b-latest",
    "codestral-2508": "codestral-latest",
    "magistral-medium-2509": "mistral-medium-latest",
    "magistral-small-2509": "mistral-small-latest",
    "pixtral-large-latest": "mistral-large-latest",
  },
  cerebras: {
    "llama3.3-70b": "gpt-oss-120b",
    "llama3.1-70b": "gpt-oss-120b",
    "llama3.1-8b": "gpt-oss-120b",
    // Left shared inference 2026-09-03 / deprecated 2026-08-17
    "gemma-4-31b": "qwen-3.8-27b",
    "zai-glm-4.7": "gpt-oss-120b",
  },
  fireworks: {
    "accounts/fireworks/models/llama-v3p3-70b-instruct": "accounts/fireworks/models/deepseek-v4p1-flash",
    "accounts/fireworks/models/deepseek-v3p1": "accounts/fireworks/models/deepseek-v4p1-flash",
    // deepseek-v4-flash and its 0731 snapshot left serverless; V4.1 Flash replaces both.
    "accounts/fireworks/models/deepseek-v4-flash": "accounts/fireworks/models/deepseek-v4p1-flash",
    "accounts/fireworks/models/deepseek-v4-flash-0731": "accounts/fireworks/models/deepseek-v4p1-flash",
    "accounts/fireworks/models/kimi-k2-instruct-0905": "accounts/fireworks/models/kimi-k2p6",
    // Kimi K3 is served only through routers, not as a bare model id.
    "accounts/fireworks/models/kimi-k3": "accounts/fireworks/models/kimi-k2p6",
    "accounts/fireworks/models/qwen3-235b-a22b": "accounts/fireworks/models/glm-5p2",
    "accounts/fireworks/models/qwen3-32b": "accounts/fireworks/models/glm-5p2",
    "accounts/fireworks/models/qwen3p7-plus": "accounts/fireworks/models/glm-5p2",
    "accounts/fireworks/models/minimax-m3": "accounts/fireworks/models/glm-5p2",
    "accounts/fireworks/models/glm-4p6": "accounts/fireworks/models/glm-5p2",
    // Deprecated from serverless 2026-08-27
    "accounts/fireworks/models/gpt-oss-20b": "accounts/fireworks/models/gpt-oss-120b",
    "accounts/fireworks/models/qwen3-embedding-0p6b": "nomic-ai/nomic-embed-text-v1.5",
  },
  huggingface: {
    // The "Meta-" prefix was only ever used for Llama 3 / 3.1.
    "meta-llama/Meta-Llama-3.3-70B-Instruct": "meta-llama/Llama-3.3-70B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct": "Qwen/Qwen3.5-397B-A17B",
    "deepseek-ai/DeepSeek-V3": "deepseek-ai/DeepSeek-V4-Flash",
    "google/gemma-2-27b-it": "openai/gpt-oss-120b",
    "sentence-transformers/all-MiniLM-L6-v2": "Qwen/Qwen3-Embedding-0.6B",
  },
  deepinfra: {
    "meta-llama/Meta-Llama-3.3-70B-Instruct": "deepseek-ai/DeepSeek-V4-Flash-0731",
    "deepseek-ai/DeepSeek-V3": "deepseek-ai/DeepSeek-V4-Flash-0731",
    "deepseek-ai/DeepSeek-V4-Flash": "deepseek-ai/DeepSeek-V4-Flash-0731",
    "mistralai/Mistral-Small-3.2-Instruct": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
    "BAAI/bge-base-en-v1.5": "Qwen/Qwen3-Embedding-0.6B",
  },
  openrouter: {
    "openai/gpt-4o-mini": "openai/gpt-5.6-luna",
    "openai/gpt-5.1": "openai/gpt-5.6-sol",
    "openai/gpt-5-mini": "openai/gpt-5.6-terra",
    // OpenRouter's Claude slugs use dots, not hyphens.
    "anthropic/claude-3.5-sonnet-20241022": "anthropic/claude-sonnet-5.5",
    "anthropic/claude-sonnet-5": "anthropic/claude-sonnet-5.5",
    "anthropic/claude-opus-5": "anthropic/claude-opus-5.5",
    "x-ai/grok-4.5": "x-ai/grok-4.7",
    "google/gemini-3.5-flash-lite": "google/gemini-3.6-flash",
    "google/gemini-2.5-pro": "google/gemini-3.6-flash",
    "meta-llama/llama-3.3-405b-instruct": "openai/gpt-5.6-luna",
  },
  aiml: {
    "gpt-4o-mini": "google/gemini-3-6-flash",
    "gpt-5.1": "openai/gpt-5.6-sol",
    "claude-3-5-sonnet-20241022": "anthropic/claude-sonnet-5",
    "gemini-2.5-pro": "google/gemini-3-6-flash",
    "gemini-2.5-flash": "google/gemini-3-5-flash-lite",
    "llama-3.3-70b-instruct": "google/gemini-3-6-flash",
    "deepseek-v3": "deepseek/deepseek-v4-flash",
    "text-embedding-3-small": "openai/text-embedding-3-small",
  },
  alibaba: {
    "qwen-turbo": "qwen3.8-max",
  },
  minimax: {
    "abab6.5-chat": "MiniMax-M3",
    "abab6.5s-chat": "MiniMax-M3",
  },
  vertex: {
    "text-embedding-gecko": "gemini-3.5-flash-lite",
  },
}

// ============================================================================
// EMBEDDING CACHE
// ============================================================================

interface EmbeddingCacheEntry {
  embedding: number[]
  timestamp: number
}

/** FNV-1a 32-bit, base36. Collisions only cost a cache miss-turned-hit, so pair with length. */
function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`
}

// Global embedding cache (persists across AIClient instances)
const embeddingCache = new Map<string, EmbeddingCacheEntry>()
const EMBEDDING_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_SIZE = 1000 // Maximum cached embeddings

/** OpenAI caps an embeddings request at 2048 inputs; most providers accept far fewer. */
const EMBEDDING_BATCH_SIZE = 64
/** ~8k-token embedding context; chunks are far smaller, this only guards pathological input. */
const MAX_EMBEDDING_CHARS = 24000

const REQUEST_TIMEOUT_MS = 120_000
const MAX_ATTEMPTS = 3

// ============================================================================
// MODEL CAPABILITY HELPERS
// ============================================================================

/** OpenAI reasoning models (GPT-5.x, GPT-6.x, o-series) reject any temperature other than the default. */
function isOpenAIReasoningModel(model: string): boolean {
  return /(^|\/)(gpt-[56]|o\d)/i.test(model)
}

/**
 * Claude models from Opus 4.7 / Sonnet 5 onward reject sampling parameters
 * (temperature/top_p/top_k) with a 400. Only these older ids still accept them.
 */
function claudeAcceptsTemperature(model: string): boolean {
  return /claude-(3|opus-4-[0-6]|sonnet-4|haiku-4)/i.test(model)
}

/** Claude 5-series models take output_config.effort; older ones error on low effort for some tiers. */
function claudeSupportsEffort(model: string): boolean {
  return /claude-(fable|mythos|opus|sonnet|haiku)-5/i.test(model)
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
function claudeSupportsServerFallback(model: string): boolean {
  return /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/i.test(model)
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly provider?: string,
  ) {
    super(message)
    this.name = "AIProviderError"
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "")
  try {
    const data = JSON.parse(raw)
    const err = data?.error ?? data
    if (typeof err === "string") return err
    if (Array.isArray(data) && data[0]?.error?.message) return data[0].error.message // Gemini
    return err?.message || data?.message || data?.detail || raw || response.statusText
  } catch {
    return raw.slice(0, 500) || response.statusText
  }
}

/**
 * fetch with a timeout and retry on 408/409/429/5xx and network errors.
 * Honours Retry-After. Non-retryable statuses throw immediately with the
 * provider's own error message, so a bad model id surfaces as such instead of
 * as "Bad Request".
 */
async function fetchWithRetry(provider: string, url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      if (response.ok) return response

      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
      const message = await readErrorMessage(response)
      lastError = new AIProviderError(`${provider} API error (${response.status}): ${message}`, response.status, provider)
      if (!retryable || attempt === MAX_ATTEMPTS) throw lastError

      const retryAfter = Number(response.headers.get("retry-after"))
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 20_000) : 500 * 2 ** (attempt - 1))
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      lastError = error
      if (attempt === MAX_ATTEMPTS) break
      await sleep(500 * 2 ** (attempt - 1))
    } finally {
      clearTimeout(timer)
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new AIProviderError(`${provider} request failed: ${message}`, undefined, provider)
}

/** Iterate `data:` payloads of a server-sent-events body. */
async function* readSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body reader available")
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ""
    for (const line of lines) {
      if (line.startsWith("data:")) yield line.slice(5).trimStart()
    }
  }
  if (buffer.startsWith("data:")) yield buffer.slice(5).trimStart()
}

/** Some open reasoning models inline their chain of thought; strip it from answers. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim()
}

// ============================================================================
// LOCAL LEXICAL EMBEDDING
// ============================================================================

const LEXICAL_STOPWORDS = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were will with what which who how why when where do does did not no".split(" "),
)

/**
 * Deterministic feature-hashed embedding (word unigrams + bigrams + character
 * trigrams, sublinear TF, signed hashing, L2-normalised).
 *
 * Used for providers that have no embeddings API. It is a lexical model: cosine
 * similarity approximates term overlap, so retrieval still works for keyword-ish
 * questions, but it has no notion of synonyms. It is only ever used for *every*
 * vector of a provider, never mixed with real embeddings, so all vectors share
 * one space.
 */
export function generateLexicalEmbedding(text: string, dimension: number = DEFAULT_EMBEDDING_DIMENSION): number[] {
  const vector = new Float64Array(dimension)
  const tokens = (text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !LEXICAL_STOPWORDS.has(t))

  const counts = new Map<string, number>()
  const add = (feature: string, weight: number) => counts.set(feature, (counts.get(feature) || 0) + weight)
  for (let i = 0; i < tokens.length; i++) {
    add(`w:${tokens[i]}`, 1)
    if (i + 1 < tokens.length) add(`b:${tokens[i]}_${tokens[i + 1]}`, 0.5)
    const padded = `#${tokens[i]}#`
    for (let j = 0; j + 3 <= padded.length; j++) add(`c:${padded.slice(j, j + 3)}`, 0.25)
  }

  for (const [feature, count] of counts) {
    let h = 0x811c9dc5
    for (let i = 0; i < feature.length; i++) {
      h ^= feature.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    const index = (h >>> 0) % dimension
    const sign = (h >>> 31) & 1 ? -1 : 1
    vector[index] += sign * (1 + Math.log(count))
  }

  let norm = 0
  for (let i = 0; i < dimension; i++) norm += vector[i] * vector[i]
  norm = Math.sqrt(norm)
  const out = new Array<number>(dimension)
  for (let i = 0; i < dimension; i++) out[i] = norm > 0 ? vector[i] / norm : 0
  if (norm === 0) out[0] = 1 // empty/stopword-only text: a valid unit vector
  return out
}

// ============================================================================
// CLIENT
// ============================================================================

export class AIClient {
  private config: AIConfig
  private spec: ProviderSpec

  constructor(config: AIConfig) {
    const spec = PROVIDER_SPECS[config.provider]
    if (!spec) throw new Error(`Unsupported AI provider: ${config.provider}`)
    this.spec = spec

    const normalizedBaseUrl =
      config.provider === "xai" && config.baseUrl?.includes("api.xai.com")
        ? config.baseUrl.replace("api.xai.com", "api.x.ai")
        : config.baseUrl

    this.config = {
      ...config,
      apiKey: (config.apiKey || "").trim(),
      model: AIClient.normalizeModelAlias(config.provider, config.model),
      baseUrl: normalizedBaseUrl?.trim() || undefined,
    }
  }

  static normalizeModelAlias(provider: AIProvider, model: string): string {
    const trimmedModel = (model || "").trim()
    if (!trimmedModel) return trimmedModel

    const migrations = MODEL_MIGRATIONS[provider]
    if (!migrations) return trimmedModel

    const direct = migrations[trimmedModel]
    if (direct) return direct

    const lower = trimmedModel.toLowerCase()
    const match = Object.entries(migrations).find(([oldId]) => oldId.toLowerCase() === lower)
    return match?.[1] || trimmedModel
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || this.spec.baseUrl).replace(/\/+$/, "")
  }

  private isEmbeddingModel(model: string): boolean {
    return /embed|bge-|e5-|gte-/i.test(model || "")
  }

  private getModelForPurpose(purpose: "text" | "embedding"): string {
    const provider = this.config.provider
    const configuredModel = this.config.model
    const defaultTextModel = PROVIDER_DEFAULT_TEXT_MODELS[provider]
    const defaultEmbeddingModel = PROVIDER_DEFAULT_EMBEDDING_MODELS[provider]

    if (purpose === "embedding") {
      // The dropdown only offers chat models, so the configured model is used for
      // embeddings only when it actually is one.
      if (configuredModel && this.isEmbeddingModel(configuredModel)) return configuredModel
      return defaultEmbeddingModel || ""
    }

    if (!configuredModel) return defaultTextModel
    if (this.isEmbeddingModel(configuredModel)) {
      logger.warn(`Model '${configuredModel}' is an embedding model for ${provider}. Using text model '${defaultTextModel}'.`)
      return defaultTextModel
    }
    return configuredModel
  }

  /** True when this provider's vectors come from a real embeddings API. */
  get usesRemoteEmbeddings(): boolean {
    return this.spec.embeddings && !!PROVIDER_DEFAULT_EMBEDDING_MODELS[this.config.provider]
  }

  /** Identifies the vector space; documents embedded under a different id must be re-embedded. */
  get embeddingSpaceId(): string {
    return this.usesRemoteEmbeddings
      ? `${this.config.provider}:${this.getModelForPurpose("embedding")}`
      : `local-lexical:${DEFAULT_EMBEDDING_DIMENSION}`
  }

  // --------------------------------------------------------------------------
  // Embeddings
  // --------------------------------------------------------------------------

  /**
   * Embed one text. Throws when the provider's embeddings API fails: silently
   * substituting a different vector space would make retrieval meaningless.
   * Providers without an embeddings API always get the local lexical embedding.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text input for embedding generation")
    }
    const [embedding] = await this.generateEmbeddings([text])
    return embedding
  }

  async generateEmbeddings(
    texts: string[],
    onProgress?: (progress: { completed: number; total: number; textPreview: string }) => void,
  ): Promise<number[][]> {
    const results: number[][] = new Array(texts.length)
    const pending: number[] = []
    const space = this.embeddingSpaceId

    texts.forEach((raw, i) => {
      const text = typeof raw === "string" ? raw.trim() : ""
      if (!text) {
        // Still embedded below (as " ") so indices stay aligned with chunks and
        // the vector has the provider's dimension; it matches nothing.
        pending.push(i)
        return
      }
      const cached = embeddingCache.get(`${space}:${hashText(text)}`)
      if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL) {
        results[i] = cached.embedding
      } else {
        pending.push(i)
      }
    })

    let completed = texts.length - pending.length
    if (completed > 0) onProgress?.({ completed, total: texts.length, textPreview: "cached" })

    if (!this.usesRemoteEmbeddings) {
      for (const i of pending) {
        results[i] = generateLexicalEmbedding(texts[i] || "")
        completed++
      }
      onProgress?.({ completed, total: texts.length, textPreview: texts[texts.length - 1]?.slice(0, 50) || "" })
      return results
    }

    for (let start = 0; start < pending.length; start += EMBEDDING_BATCH_SIZE) {
      const indices = pending.slice(start, start + EMBEDDING_BATCH_SIZE)
      // Remote APIs reject empty strings; a single space embeds as "nothing".
      const batch = indices.map((i) => (texts[i] || "").trim().slice(0, MAX_EMBEDDING_CHARS) || " ")
      const vectors = await this.embedBatch(batch)
      if (vectors.length !== batch.length) {
        throw new Error(`${this.config.provider} returned ${vectors.length} embeddings for ${batch.length} inputs`)
      }
      indices.forEach((textIndex, j) => {
        const vector = vectors[j]
        if (!Array.isArray(vector) || vector.length === 0 || vector.some((v) => typeof v !== "number" || Number.isNaN(v))) {
          throw new Error(`${this.config.provider} returned an invalid embedding`)
        }
        results[textIndex] = vector
        if (batch[j].trim()) this.cacheEmbedding(`${space}:${hashText(batch[j])}`, vector)
      })
      completed += indices.length
      onProgress?.({ completed, total: texts.length, textPreview: batch[batch.length - 1].slice(0, 50) })
    }
    return results
  }

  private cacheEmbedding(key: string, embedding: number[]): void {
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = embeddingCache.keys().next().value
      if (oldestKey) embeddingCache.delete(oldestKey)
    }
    embeddingCache.set(key, { embedding, timestamp: Date.now() })
  }

  static clearEmbeddingCache(): void {
    embeddingCache.clear()
    logger.debug("AIClient: Embedding cache cleared")
  }

  static getCacheStats(): { size: number; maxSize: number } {
    return { size: embeddingCache.size, maxSize: MAX_CACHE_SIZE }
  }

  private async embedBatch(inputs: string[]): Promise<number[][]> {
    const model = this.getModelForPurpose("embedding")
    switch (this.spec.protocol) {
      case "gemini": {
        const name = model.startsWith("models/") ? model : `models/${model}`
        const response = await fetchWithRetry(this.config.provider, `${this.baseUrl}/${name}:batchEmbedContents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey },
          body: JSON.stringify({
            requests: inputs.map((text) => ({ model: name, content: { parts: [{ text }] } })),
          }),
        })
        const result = await response.json()
        return (result.embeddings || []).map((e: { values: number[] }) => e.values)
      }
      case "huggingface": {
        // Proxied so a server-side HUGGINGFACE_API_KEY works when the user has none;
        // one request per batch (the route accepts up to EMBEDDING_BATCH_SIZE texts).
        const response = await fetchWithRetry("huggingface", "/api/huggingface/embedding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: inputs, model, apiKey: this.config.apiKey || undefined }),
        })
        const result = await response.json()
        return result.embeddings
      }
      case "openai": {
        const response = await fetchWithRetry(this.config.provider, `${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: this.openAIHeaders(),
          body: JSON.stringify({ model, input: inputs, encoding_format: "float" }),
        })
        const result = await response.json()
        const data: Array<{ embedding: number[]; index?: number }> = result.data || []
        // The spec allows out-of-order items; `index` is authoritative when present.
        return data.every((d) => typeof d.index === "number")
          ? [...data].sort((a, b) => (a.index as number) - (b.index as number)).map((d) => d.embedding)
          : data.map((d) => d.embedding)
      }
      default:
        throw new Error(`Embeddings are not supported for provider ${this.config.provider}`)
    }
  }

  // --------------------------------------------------------------------------
  // Text generation
  // --------------------------------------------------------------------------

  async generateText(messages: ChatMessage[], options: GenerateOptions = {}): Promise<string> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Invalid messages array")
    }
    switch (this.spec.protocol) {
      case "anthropic":
        return this.anthropicText(messages, options)
      case "gemini":
        return this.geminiText(messages, options)
      case "huggingface":
        return this.huggingFaceText(messages, options)
      default:
        return this.openAIText(messages, options)
    }
  }

  /**
   * Stream tokens through `onChunk`. Falls back to a single non-streaming call
   * when the stream fails *before* any token arrived; a failure mid-stream is
   * reported through `onError` (retrying would duplicate text already shown).
   */
  async generateTextStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void,
    options: GenerateOptions = {},
  ): Promise<void> {
    let emitted = false
    const emit = (chunk: string) => {
      if (!chunk) return
      emitted = true
      onChunk(chunk)
    }
    try {
      if (!Array.isArray(messages) || messages.length === 0) throw new Error("Invalid messages array")
      switch (this.spec.protocol) {
        case "anthropic":
          await this.anthropicStream(messages, options, emit)
          break
        case "openai":
          await this.openAIStream(messages, options, emit)
          break
        default:
          emit(await this.generateText(messages, options))
      }
      onComplete?.()
    } catch (error) {
      if (!emitted) {
        logger.warn(`Streaming failed for ${this.config.provider}, retrying without streaming:`, error)
        try {
          emit(await this.generateText(messages, options))
          onComplete?.()
          return
        } catch (fallbackError) {
          error = fallbackError
        }
      }
      const err = error instanceof Error ? error : new Error(String(error))
      if (onError) onError(err)
      else throw err
    }
  }

  // ---- OpenAI-compatible -----------------------------------------------------

  private openAIHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      ...(this.spec.headers || {}),
    }
  }

  private openAIBody(messages: ChatMessage[], options: GenerateOptions, stream: boolean) {
    const model = this.getModelForPurpose("text")
    const reasoning = isOpenAIReasoningModel(model)
    // Reasoning models bill thinking against the same ceiling, so leave headroom.
    const maxTokens = options.maxTokens ?? (reasoning ? 8192 : 2048)
    const body: Record<string, unknown> = {
      model,
      messages,
      [this.spec.tokenParam || "max_tokens"]: maxTokens,
      stream,
    }
    if (!reasoning) body.temperature = options.temperature ?? 0.1
    if (reasoning && options.effort === "low" && this.config.provider === "openai") {
      body.reasoning_effort = "low"
    }
    return body
  }

  private async openAIText(messages: ChatMessage[], options: GenerateOptions): Promise<string> {
    const response = await fetchWithRetry(this.config.provider, `${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.openAIHeaders(),
      body: JSON.stringify(this.openAIBody(messages, options, false)),
    })
    const result = await response.json()
    const choice = result?.choices?.[0]
    const content = choice?.message?.content
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((p: { text?: string }) => p?.text || "").join("")
        : ""
    if (!text.trim()) {
      if (choice?.finish_reason === "length") {
        throw new AIProviderError(`${this.config.provider}: the model used its whole token budget before answering`, undefined, this.config.provider)
      }
      throw new AIProviderError(`${this.config.provider} returned an empty response`, undefined, this.config.provider)
    }
    return stripThinking(text)
  }

  private async openAIStream(messages: ChatMessage[], options: GenerateOptions, emit: (chunk: string) => void) {
    const response = await fetchWithRetry(this.config.provider, `${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.openAIHeaders(),
      body: JSON.stringify(this.openAIBody(messages, options, true)),
    })
    let inThink = false
    for await (const data of readSSE(response)) {
      if (data === "[DONE]") return
      let parsed: { choices?: Array<{ delta?: { content?: string } }>; error?: { message?: string } }
      try {
        parsed = JSON.parse(data)
      } catch {
        continue
      }
      if (parsed.error) throw new Error(parsed.error.message || "Stream error")
      let content = parsed.choices?.[0]?.delta?.content || ""
      // Hide inline <think> blocks some open models emit.
      if (content.includes("<think>")) inThink = true
      if (inThink) {
        const end = content.indexOf("</think>")
        if (end === -1) continue
        inThink = false
        content = content.slice(end + "</think>".length)
      }
      emit(content)
    }
  }

  // ---- Anthropic ---------------------------------------------------------------

  private anthropicRequest(messages: ChatMessage[], options: GenerateOptions, stream: boolean) {
    const model = this.getModelForPurpose("text")
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
    const body: Record<string, unknown> = {
      model,
      // Thinking is on by default for the 5-series and counts against max_tokens.
      max_tokens: options.maxTokens ?? 16000,
      messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      stream,
    }
    if (system) body.system = system
    if (claudeAcceptsTemperature(model)) body.temperature = options.temperature ?? 0.1
    if (claudeSupportsEffort(model)) body.output_config = { effort: options.effort === "low" ? "low" : "medium" }

    const headers: Record<string, string> = {
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      // Required for calls made straight from the browser (BYOK).
      "anthropic-dangerous-direct-browser-access": "true",
    }
    if (claudeSupportsServerFallback(model)) {
      // On a safety-classifier refusal, re-run the request on a model chosen by
      // refusal category instead of returning an empty refusal.
      headers["anthropic-beta"] = "server-side-fallback-2026-07-01"
      body.fallbacks = "default"
    }
    return { url: `${this.baseUrl}/v1/messages`, headers, body }
  }

  private async anthropicText(messages: ChatMessage[], options: GenerateOptions): Promise<string> {
    const { url, headers, body } = this.anthropicRequest(messages, options, false)
    const response = await fetchWithRetry("anthropic", url, { method: "POST", headers, body: JSON.stringify(body) })
    const result = await response.json()
    // Content can start with thinking/fallback blocks; only text blocks are the answer.
    const text = (result.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
    if (result.stop_reason === "refusal" && !text.trim()) {
      throw new AIProviderError("anthropic: the model declined to answer this request", undefined, "anthropic")
    }
    if (!text.trim()) throw new AIProviderError(`anthropic returned no text (stop_reason: ${result.stop_reason})`, undefined, "anthropic")
    return text
  }

  private async anthropicStream(messages: ChatMessage[], options: GenerateOptions, emit: (chunk: string) => void) {
    const { url, headers, body } = this.anthropicRequest(messages, options, true)
    const response = await fetchWithRetry("anthropic", url, { method: "POST", headers, body: JSON.stringify(body) })
    for await (const data of readSSE(response)) {
      let event: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } }
      try {
        event = JSON.parse(data)
      } catch {
        continue
      }
      if (event.type === "error") throw new Error(event.error?.message || "Anthropic stream error")
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") emit(event.delta.text || "")
      if (event.type === "message_stop") return
    }
  }

  // ---- Gemini / Vertex ---------------------------------------------------------------

  private geminiUrl(model: string): { url: string; headers: Record<string, string> } {
    if (this.config.provider === "vertex") {
      // baseUrl: https://REGION-aiplatform.googleapis.com/v1/projects/PROJECT/locations/REGION
      if (!this.config.baseUrl || !/projects\/[^/]+/.test(this.config.baseUrl)) {
        throw new Error(
          "Vertex AI needs a base URL like https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1",
        )
      }
      const base = this.baseUrl.replace(/\/publishers\/.*$/, "")
      return {
        url: `${base}/publishers/google/models/${model}:generateContent`,
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      }
    }
    return {
      url: `${this.baseUrl}/models/${model.replace(/^models\//, "")}:generateContent`,
      headers: { "x-goog-api-key": this.config.apiKey, "Content-Type": "application/json" },
    }
  }

  private async geminiText(messages: ChatMessage[], options: GenerateOptions): Promise<string> {
    const model = this.getModelForPurpose("text")
    const { url, headers } = this.geminiUrl(model)
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
    const body: Record<string, unknown> = {
      contents: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 8192,
      },
    }
    // Google recommends leaving Gemini 3 at its default temperature; low values
    // can make its thinking loop or degrade.
    if (!/gemini-3/i.test(model)) {
      (body.generationConfig as Record<string, unknown>).temperature = options.temperature ?? 0.1
    }
    if (system) body.systemInstruction = { parts: [{ text: system }] }

    const response = await fetchWithRetry(this.config.provider, url, { method: "POST", headers, body: JSON.stringify(body) })
    const result = await response.json()
    const candidate = result?.candidates?.[0]
    const text = (candidate?.content?.parts || [])
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("")
    if (!text.trim()) {
      const reason = candidate?.finishReason || result?.promptFeedback?.blockReason || "unknown"
      throw new AIProviderError(`${this.config.provider} returned no text (finish reason: ${reason})`, undefined, this.config.provider)
    }
    return text
  }

  // ---- Hugging Face (server proxy) ---------------------------------------------------------------

  private async huggingFaceText(messages: ChatMessage[], options: GenerateOptions): Promise<string> {
    const response = await fetchWithRetry("huggingface", "/api/huggingface/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: this.getModelForPurpose("text"),
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 2048,
        apiKey: this.config.apiKey || undefined,
      }),
    })
    const result = await response.json()
    if (typeof result?.text !== "string" || !result.text.trim()) {
      throw new AIProviderError("huggingface returned an empty response", undefined, "huggingface")
    }
    return stripThinking(result.text)
  }

  // --------------------------------------------------------------------------
  // Connection test
  // --------------------------------------------------------------------------

  /** One minimal chat call. Returns false (never throws) so the UI can show a status. */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey && this.spec.protocol !== "huggingface") return false
      await this.generateText([{ role: "user", content: "Reply with the single word OK." }], { maxTokens: 512, effort: "low" })
      return true
    } catch (error) {
      logger.warn(`Connection test failed for ${this.config.provider}:`, error)
      return false
    }
  }

  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension")
    }
    let dot = 0
    let magA = 0
    let magB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      magA += a[i] * a[i]
      magB += b[i] * b[i]
    }
    if (magA === 0 || magB === 0) return 0
    return dot / (Math.sqrt(magA) * Math.sqrt(magB))
  }
}

import { logger } from "@/lib/logger"
import { resolveApiKey } from "@/lib/server-key-guard"
import { InferenceClient } from "@huggingface/inference"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B"
/** Inputs per request; the client batches to this size. */
const MAX_BATCH = 64

type Nested = number | Nested[]

/** Mean-pool a [tokens][dim] matrix into one vector (token-level models). */
function meanPool(rows: number[][]): number[] {
  const out = new Array<number>(rows[0].length).fill(0)
  for (const row of rows) row.forEach((v, i) => (out[i] += v / rows.length))
  return out
}

/**
 * Normalise featureExtraction output to one vector per input. Depending on the
 * model and provider it is a vector (single input), a [n][dim] matrix, or a
 * token-level [n][tokens][dim] tensor (single input: [tokens][dim]).
 */
function toVectors(output: Nested, inputCount: number): number[][] {
  if (!Array.isArray(output) || output.length === 0) throw new Error("Empty embedding response")
  const depth = (v: Nested): number => (Array.isArray(v) ? 1 + depth(v[0]) : 0)
  const d = depth(output)

  if (d === 1) return [output as number[]]
  if (d === 2) {
    const rows = output as number[][]
    // One input that came back token-level, or one pooled row per input.
    return inputCount === 1 && rows.length !== 1 ? [meanPool(rows)] : rows
  }
  if (d === 3) return (output as number[][][]).map(meanPool)
  throw new Error(`Unexpected embedding response shape (depth ${d})`)
}

export async function POST(request: NextRequest) {
  let model = DEFAULT_MODEL
  try {
    const body = await request.json()
    const texts: unknown[] = Array.isArray(body?.texts) ? body.texts : typeof body?.text === "string" ? [body.text] : []
    if (texts.length === 0 || texts.length > MAX_BATCH || !texts.every((t) => typeof t === "string" && t.trim())) {
      return NextResponse.json({ error: `Provide 1-${MAX_BATCH} non-empty texts` }, { status: 400 })
    }

    // The user's own key, or the server's key for same-origin, rate-limited use only.
    const key = resolveApiKey(request, body?.apiKey, {
      provider: "huggingface",
      serverKey: process.env.HUGGINGFACE_API_KEY,
      perMinute: 120,
    })
    if (!key.ok) {
      return NextResponse.json(
        { error: key.error },
        { status: key.status, headers: key.retryAfterMs ? { "Retry-After": String(Math.ceil(key.retryAfterMs / 1000)) } : undefined },
      )
    }

    if (typeof body?.model === "string" && body.model.trim()) model = body.model.trim()
    const inputs = (texts as string[]).map((t) => t.trim())

    const output = await new InferenceClient(key.token).featureExtraction({
      model,
      inputs: inputs.length === 1 ? inputs[0] : inputs,
    })
    const embeddings = toVectors(output as Nested, inputs.length)

    if (embeddings.length !== inputs.length) {
      throw new Error(`Expected ${inputs.length} embeddings, got ${embeddings.length}`)
    }
    if (!embeddings.every((e) => e.length > 0 && e.every((v) => typeof v === "number" && !Number.isNaN(v)))) {
      throw new Error("Generated embedding contains invalid values")
    }

    logger.debug(`Generated ${embeddings.length} embedding(s) of dimension ${embeddings[0].length} (key: ${key.source})`)
    return NextResponse.json({
      success: true,
      embeddings,
      // Single-input callers still read `embedding`.
      embedding: embeddings[0],
      model,
      dimension: embeddings[0].length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Hugging Face embedding API error for model ${model}:`, message)
    // 502: the upstream provider failed, not this route.
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

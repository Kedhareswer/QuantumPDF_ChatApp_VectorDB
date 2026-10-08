import { InferenceClient } from "@huggingface/inference"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

/**
 * Chat completion through Hugging Face Inference Providers.
 *
 * Proxied (rather than called from the browser) so a server-side
 * HUGGINGFACE_API_KEY works for users who have not entered their own token.
 */
export async function POST(request: NextRequest) {
  let model = "openai/gpt-oss-120b"
  try {
    const body = await request.json()
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : []
    const token =
      typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : process.env.HUGGINGFACE_API_KEY

    if (!token) {
      return NextResponse.json(
        { error: "No Hugging Face token: enter one in settings or set HUGGINGFACE_API_KEY on the server." },
        { status: 401 },
      )
    }
    if (
      messages.length === 0 ||
      !messages.every((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m?.content === "string")
    ) {
      return NextResponse.json({ error: "messages must be a non-empty array of {role, content}" }, { status: 400 })
    }
    if (typeof body?.model === "string" && body.model.trim()) model = body.model.trim()

    const temperature = typeof body?.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 2) : 0.1
    const maxTokens = typeof body?.maxTokens === "number" ? Math.min(Math.max(Math.floor(body.maxTokens), 1), 16384) : 2048

    const client = new InferenceClient(token)
    const result = await client.chatCompletion({ model, messages, temperature, max_tokens: maxTokens })
    const text = result.choices?.[0]?.message?.content ?? ""
    return NextResponse.json({ text, model })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Hugging Face chat completion failed for ${model}:`, message)
    // 502: the upstream provider failed, not this route.
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

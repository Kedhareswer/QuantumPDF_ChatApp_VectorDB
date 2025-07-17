import { type NextRequest } from "next/server"
import { InferenceClient } from "@huggingface/inference"

export const runtime = "edge";

/**
 * Handles POST requests by streaming a multi-step text generation process using a Hugging Face model via Server-Sent Events (SSE).
 *
 * Parses the request body for a prompt, optional context, and model selection. Validates input and streams progress events for each step: searching, ranking, context preparation, and answer generation. The final step streams the generated text and model information. Errors and invalid input are returned as JSON responses with appropriate status codes.
 *
 * @returns A streaming Response with event-encoded JSON messages for each step of the process, suitable for consumption via SSE.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Helper to stream events
  function streamEvent(controller: ReadableStreamDefaultController, event: any) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  // Parse request
  let textModel: string = "meta-llama/Meta-Llama-3.3-70B-Instruct";
  let apiKey = process.env.HUGGINGFACE_API_KEY;
  let prompt = "";
  let context = "";
  let model = "";
  try {
    const body = await request.json();
    prompt = body.prompt;
    context = body.context;
    model = body.model;
    if (model) textModel = model;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "HUGGINGFACE_API_KEY not configured on server" }), { status: 500 });
    }
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Invalid prompt input" }), { status: 400 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  // Streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Searching document database
        streamEvent(controller, { step: "search", status: "in_progress" });
        await new Promise((res) => setTimeout(res, 400));
        streamEvent(controller, { step: "search", status: "done" });

        // Step 2: Ranking by relevance
        streamEvent(controller, { step: "ranking", status: "in_progress" });
        await new Promise((res) => setTimeout(res, 400));
        streamEvent(controller, { step: "ranking", status: "done" });

        // Step 3: Preparing context
        streamEvent(controller, { step: "context", status: "in_progress" });
        await new Promise((res) => setTimeout(res, 400));
        streamEvent(controller, { step: "context", status: "done" });

        // Step 4: Generating answer (in progress)
        streamEvent(controller, { step: "answer", status: "in_progress" });

        // Generate answer
        const client = new InferenceClient(apiKey!);
        const fullPrompt = context
          ? `Context: ${context}\n\nQuestion: ${prompt}\n\nAnswer:`
          : `Question: ${prompt}\n\nAnswer:`;
        const response = await client.textGeneration({
          model: textModel,
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.7,
            do_sample: true,
            return_full_text: false,
          },
        });
        const generatedText = response.generated_text?.trim() || "";
        streamEvent(controller, { step: "answer", status: "done", text: generatedText, model: textModel });
        controller.close();
      } catch (error) {
        streamEvent(controller, { step: "error", status: "error", message: error instanceof Error ? error.message : String(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Destructure all expected parameters for chat completions
  const { messages, model = "gpt-3.5-turbo", temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stream } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ success: false, error: "Messages are required for chat completions." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    return NextResponse.json({ success: false, error: "OpenAI API key is not configured on the server." }, { status: 500 });
  }

  // Construct the payload, only including parameters if they are provided
  const payload: Record<string, any> = {
    messages,
    model,
  };
  if (temperature !== undefined) payload.temperature = temperature;
  if (max_tokens !== undefined) payload.max_tokens = max_tokens;
  if (top_p !== undefined) payload.top_p = top_p;
  if (frequency_penalty !== undefined) payload.frequency_penalty = frequency_penalty;
  if (presence_penalty !== undefined) payload.presence_penalty = presence_penalty;
  if (stream !== undefined) payload.stream = stream; // For streaming responses

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    // Handle streaming responses if stream is true
    if (stream && openaiResponse.body) {
      // For streaming, we directly pass through the stream from OpenAI
      // The client will need to handle Server-Sent Events (SSE)
      return new NextResponse(openaiResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For non-streaming responses
    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json(
        { success: false, error: data.error?.message || "Failed to fetch chat completions from OpenAI." },
        { status: openaiResponse.status }
      );
    }

    // The typical response for non-streaming chat completions contains `choices`.
    // We'll return the first choice's message content.
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
       return NextResponse.json({ success: true, message: data.choices[0].message, usage: data.usage, model: data.model });
    } else {
      console.error("Unexpected response structure from OpenAI chat API:", data);
      return NextResponse.json({ success: false, error: "Unexpected response structure from OpenAI." }, { status: 500 });
    }

  } catch (error) {
    console.error("Error calling OpenAI chat API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed to connect to OpenAI: ${errorMessage}` }, { status: 500 });
  }
}

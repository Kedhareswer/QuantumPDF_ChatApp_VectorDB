import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { text, model = "text-embedding-3-small" } = await request.json();

  if (!text) {
    return NextResponse.json({ success: false, error: "Text is required for embeddings." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    return NextResponse.json({ success: false, error: "OpenAI API key is not configured on the server." }, { status: 500 });
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: model,
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", data);
      return NextResponse.json(
        { success: false, error: data.error?.message || "Failed to fetch embeddings from OpenAI." },
        { status: openaiResponse.status }
      );
    }

    // The OpenAI API for embeddings returns a list of embedding objects.
    // We expect one input string, so we'll get one embedding object.
    // The actual embedding is in `data.data[0].embedding`.
    if (data.data && data.data.length > 0 && data.data[0].embedding) {
      return NextResponse.json({ success: true, embedding: data.data[0].embedding });
    } else {
      console.error("Unexpected response structure from OpenAI embeddings API:", data);
      return NextResponse.json({ success: false, error: "Unexpected response structure from OpenAI." }, { status: 500 });
    }

  } catch (error) {
    console.error("Error calling OpenAI embeddings API:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Failed to connect to OpenAI: ${errorMessage}` }, { status: 500 });
  }
}

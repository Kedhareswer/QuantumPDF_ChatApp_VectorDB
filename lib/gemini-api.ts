// Updated client for the Gemini API with correct endpoint and model name

export interface GeminiMessage {
  role: "user" | "model"
  parts: {
    text: string
  }[]
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string
      }[]
    }
    finishReason: string
  }[]
  promptFeedback?: {
    blockReason?: string
    safetyRatings?: {
      category: string
      probability: string
    }[]
  }
}

export async function generateResponse(messages: GeminiMessage[], apiKey: string): Promise<string> {
  try {
    // Add a sophisticated system prompt
    const systemPrompt = {
      role: "model",
      parts: [{
        text: `You are a helpful PDF chat assistant. Your main goal is to help users understand the content of their PDF documents. 
        
        When responding:
        1. Always be friendly and conversational
        2. If the user asks a question about the PDF content:
           - First check if the information is in the provided context
           - If not found, suggest relevant external resources (websites, books, YouTube videos)
           - Never say "I don't know" or "Information not found"
        3. If the user says "Hi" or similar greeting:
           - Respond with a friendly greeting
           - Offer to help with the PDF
           - Ask what they'd like to know about the document
        4. If the user asks about the PDF content:
           - Summarize the main topics
           - Point out key sections
           - Suggest specific pages to read
        5. Always try to be helpful and provide value, even if the exact information isn't in the PDF
        6. If you need to look up information online:
           - Say "Let me find that for you"
           - Provide relevant links when possible
        7. Maintain a professional but friendly tone throughout the conversation
        8. If you're unsure about something:
           - Say "Let me check that for you"
           - Offer to look it up
           - Never make things up
        9. Always prioritize the user's needs and try to provide value in your responses`
      }]
    };

    // Add the system prompt to the beginning of messages
    const allMessages = [systemPrompt, ...messages];

    // Build the Gemini API endpoint URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Prepare the request body with all messages
    const body = {
      contents: allMessages.map(m => ({ role: m.role, parts: m.parts })),
    };

    // Make the API call using fetch
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errorMessage = `Gemini API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` ${JSON.stringify(errorData)}`;
      } catch (e) {
        errorMessage += ` ${await response.text()}`;
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Content filtered: ${data.promptFeedback.blockReason}`);
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // Add helpful links if the response suggests looking up information
    if (responseText.toLowerCase().includes("let me find that for you") || 
        responseText.toLowerCase().includes("let me check that for you")) {
      // Add some helpful resources
      const helpfulLinks = `

For more information, you might find these resources helpful:
- Wikipedia: https://en.wikipedia.org/wiki/
- YouTube: https://www.youtube.com/results?search_query=
- Google Scholar: https://scholar.google.com/scholar?q=`;
      return responseText + helpfulLinks;
    }

    return responseText;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    
    // Instead of throwing an error, return a helpful fallback message
    return `I'm having a bit of trouble with that request right now. Let me help you in a different way! 

How about:
1. I can help you explore the PDF content
2. I can suggest relevant external resources
3. I can help you find specific information in the document

What would you like to do?`;
  }
}

// Fallback function to generate responses locally when the API is unavailable
export function generateLocalResponse(query: string, context: string): string {
  const lowerQuery = query.toLowerCase();
  const lowerContext = context.toLowerCase();

  const keywords = lowerQuery
    .replace(/[^w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const sentences = context.split(/[.!?]+/);
  const relevantSentences = sentences.filter((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    return keywords.some((keyword) => lowerSentence.includes(keyword));
  });

  if (relevantSentences.length > 0) {
    return `Based on the document content, I found the following information:\n\n${relevantSentences.map((s) => s.trim()).join("\n\n")}\n\nPlease note that this is a simplified response as the AI service is currently unavailable.`;
  }

  return `I couldn't find specific information about "${query}" in the provided documents.\n\nThe AI service is currently unavailable, so I'm providing a simplified response. Please try again later for more accurate answers.`;
}

export async function listModels(apiKey: string): Promise<any> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Error listing models: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` ${JSON.stringify(errorData)}`;
      } catch (e) {
        errorMessage += ` ${await response.text()}`;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error listing models:", error);
    throw new Error(`Failed to list models: ${error.message}`);
  }
}

import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.WANDB_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "WANDB_API_KEY not configured" }, { status: 500 })
    }

    // Test Wandb API connection
    const response = await fetch("https://api.wandb.ai/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              id
              username
            }
          }
        `,
      }),
    })

    if (!response.ok) {
      throw new Error(`Wandb API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`Wandb GraphQL error: ${data.errors[0].message}`)
    }

    return NextResponse.json({
      success: true,
      message: "Wandb API connected successfully",
      user: data.data.viewer.username,
    })
  } catch (error) {
    console.error("Wandb API test failed:", error)
    return NextResponse.json(
      {
        error: "Failed to connect to Wandb API",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

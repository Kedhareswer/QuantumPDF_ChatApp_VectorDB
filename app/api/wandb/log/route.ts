import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { runId, eventType, data, timestamp } = await request.json()
    const apiKey = process.env.WANDB_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "WANDB_API_KEY not configured" }, { status: 500 })
    }

    // Log metrics to Wandb
    const response = await fetch("https://api.wandb.ai/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation LogMetrics($input: LogMetricsInput!) {
            logMetrics(input: $input) {
              success
            }
          }
        `,
        variables: {
          input: {
            runId: runId,
            metrics: [
              {
                name: eventType,
                value: JSON.stringify(data),
                timestamp: timestamp,
              },
            ],
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Wandb API error: ${response.statusText}`)
    }

    const result = await response.json()

    if (result.errors) {
      throw new Error(`Wandb GraphQL error: ${result.errors[0].message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error logging to Wandb:", error)
    return NextResponse.json({ error: "Failed to log to Wandb" }, { status: 500 })
  }
}

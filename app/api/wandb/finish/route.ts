import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { runId } = await request.json()
    const apiKey = process.env.WANDB_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "WANDB_API_KEY not configured" }, { status: 500 })
    }

    // Finish the Wandb run
    const response = await fetch("https://api.wandb.ai/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation FinishRun($input: FinishRunInput!) {
            finishRun(input: $input) {
              run {
                id
                state
              }
            }
          }
        `,
        variables: {
          input: {
            runId: runId,
            exitCode: 0,
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Wandb API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`Wandb GraphQL error: ${data.errors[0].message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error finishing Wandb run:", error)
    return NextResponse.json({ error: "Failed to finish Wandb run" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { project, config } = await request.json()
    const apiKey = process.env.WANDB_API_KEY

    if (!apiKey) {
      console.error("WANDB_API_KEY environment variable not found")
      return NextResponse.json({ error: "WANDB_API_KEY not configured" }, { status: 500 })
    }

    // Initialize a new Wandb run
    const response = await fetch("https://api.wandb.ai/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation CreateRun($input: CreateRunInput!) {
            createRun(input: $input) {
              run {
                id
                name
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            project: project,
            config: JSON.stringify(config),
            tags: ["pdf-rag", "huggingface", "nextjs"],
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

    const runId = data.data.createRun.run.id

    return NextResponse.json({
      success: true,
      runId,
      runName: data.data.createRun.run.name,
    })
  } catch (error) {
    console.error("Error initializing Wandb run:", error)
    return NextResponse.json({ error: "Failed to initialize Wandb run" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"

// Cache: 10 minutes
export const revalidate = 600

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get("username")
    const repo = searchParams.get("repo")

    if (!username || !repo) {
      return NextResponse.json({ error: "Missing username or repo" }, { status: 400 })
    }

    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN || process.env.GITHUB_PAT

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "User-Agent": "QuantumPDF-ChatApp",
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const ghRes = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
      headers,
      // GitHub recommends conditional requests; if needed we can add ETag/If-None-Match here
      cache: "no-store",
    })

    const rateLimit = {
      limit: ghRes.headers.get("x-ratelimit-limit") || undefined,
      remaining: ghRes.headers.get("x-ratelimit-remaining") || undefined,
      reset: ghRes.headers.get("x-ratelimit-reset") || undefined,
    }

    if (!ghRes.ok) {
      const text = await ghRes.text()
      return NextResponse.json(
        { error: `GitHub API error`, status: ghRes.status, details: text, rateLimit },
        { status: ghRes.status, headers: { "Cache-Control": "max-age=60, s-maxage=60" } },
      )
    }

    const data = await ghRes.json()
    const stars = typeof data?.stargazers_count === "number" ? data.stargazers_count : 0

    return NextResponse.json(
      { stars, rateLimit },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=600" } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 })
  }
}

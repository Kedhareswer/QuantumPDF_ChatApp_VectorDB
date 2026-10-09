import { afterEach, describe, expect, it, vi } from "vitest"
import { isSameOrigin, resolveApiKey } from "@/lib/server-key-guard"

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers), url: "https://app.example.com/api/huggingface/text" })
let n = 0
// Unique IP per test so the in-memory rate limiter starts fresh.
const ip = () => `10.0.0.${++n}`

afterEach(() => vi.unstubAllEnvs())

describe("isSameOrigin", () => {
  it("trusts Sec-Fetch-Site when present", () => {
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "same-origin" }), "https://a.com/x")).toBe(true)
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "cross-site", origin: "https://a.com" }), "https://a.com/x")).toBe(false)
  })
  it("falls back to comparing Origin with the host", () => {
    expect(isSameOrigin(new Headers({ origin: "https://a.com", host: "a.com" }), "https://a.com/x")).toBe(true)
    expect(isSameOrigin(new Headers({ origin: "https://evil.com", host: "a.com" }), "https://a.com/x")).toBe(false)
    expect(isSameOrigin(new Headers({ host: "a.com" }), "https://a.com/x")).toBe(false)
  })
})

describe("resolveApiKey", () => {
  const opts = { provider: "huggingface", serverKey: "server-secret", perMinute: 2 }

  it("always uses the caller's own key", () => {
    const r = resolveApiKey(req({ origin: "https://evil.com", host: "app.example.com" }), " user-key ", opts)
    expect(r).toEqual({ ok: true, token: "user-key", source: "user" })
  })

  it("refuses the server key to cross-origin callers", () => {
    const r = resolveApiKey(req({ origin: "https://evil.com", host: "app.example.com", "x-forwarded-for": ip() }), undefined, opts)
    expect(r).toMatchObject({ ok: false, status: 403 })
  })

  it("lends the server key to same-origin callers, rate-limited per IP", () => {
    const headers = { "sec-fetch-site": "same-origin", "x-forwarded-for": ip() }
    expect(resolveApiKey(req(headers), "", opts)).toMatchObject({ ok: true, source: "server", token: "server-secret" })
    expect(resolveApiKey(req(headers), "", opts)).toMatchObject({ ok: true })
    const third = resolveApiKey(req(headers), "", opts)
    expect(third).toMatchObject({ ok: false, status: 429 })
  })

  it("can disable the server key entirely", () => {
    vi.stubEnv("HUGGINGFACE_SERVER_KEY", "disabled")
    const r = resolveApiKey(req({ "sec-fetch-site": "same-origin", "x-forwarded-for": ip() }), undefined, opts)
    expect(r).toMatchObject({ ok: false, status: 401 })
  })

  it("reports a missing key", () => {
    const r = resolveApiKey(req({ "sec-fetch-site": "same-origin" }), undefined, { ...opts, serverKey: undefined })
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
})

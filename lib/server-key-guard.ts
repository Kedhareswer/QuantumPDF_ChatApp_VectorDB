/**
 * Guards server-side fallback API keys (e.g. HUGGINGFACE_API_KEY) used by the
 * proxy routes when a user has not supplied their own key.
 *
 * Without this, anyone who finds the route URL can spend the deployment's
 * key. The guard:
 *   1. lets a request through on its *own* key unconditionally (that is the
 *      caller's money, not ours);
 *   2. otherwise allows the server key only for same-origin browser requests
 *      (Origin / Sec-Fetch-Site must match this deployment), and
 *   3. rate-limits server-key use per client IP.
 *
 * Origin headers can be forged by non-browser clients, so (2) stops other
 * websites and casual use, and (3) bounds what a determined caller can spend.
 * It is not authentication: deployments that must not share a key at all set
 * `<PROVIDER>_SERVER_KEY=disabled` (e.g. HUGGINGFACE_SERVER_KEY=disabled).
 */
import { checkRateLimit } from "./guardrails"

export type KeyResolution =
  | { ok: true; token: string; source: "user" | "server" }
  | { ok: false; status: number; error: string; retryAfterMs?: number }

export interface ServerKeyOptions {
  /** Name used in env switches and rate-limit buckets, e.g. "huggingface". */
  provider: string
  /** Value of the server's own key (may be undefined). */
  serverKey: string | undefined
  /** Max server-key requests per client IP per minute. */
  perMinute: number
}

function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip") || "unknown"
}

/** True when the request demonstrably comes from a page served by this deployment. */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site")
  if (fetchSite) return fetchSite === "same-origin"

  const origin = headers.get("origin")
  if (!origin) return false
  try {
    const host = headers.get("x-forwarded-host") || headers.get("host") || new URL(requestUrl).host
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function resolveApiKey(
  request: { headers: Headers; url: string },
  userKey: unknown,
  options: ServerKeyOptions,
): KeyResolution {
  if (typeof userKey === "string" && userKey.trim()) {
    return { ok: true, token: userKey.trim(), source: "user" }
  }

  const disabled = process.env[`${options.provider.toUpperCase()}_SERVER_KEY`] === "disabled"
  if (!options.serverKey || disabled) {
    return { ok: false, status: 401, error: `No ${options.provider} API key: enter your own key in settings.` }
  }

  if (!isSameOrigin(request.headers, request.url)) {
    return {
      ok: false,
      status: 403,
      error: `The server's ${options.provider} key is only available to this app. Supply your own API key.`,
    }
  }

  const limit = checkRateLimit(`server-key:${options.provider}:${clientIp(request.headers)}`, {
    windowMs: 60_000,
    maxRequests: options.perMinute,
  })
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit for the shared ${options.provider} key reached. Wait a minute or supply your own API key.`,
      retryAfterMs: limit.retryAfterMs,
    }
  }

  return { ok: true, token: options.serverKey, source: "server" }
}

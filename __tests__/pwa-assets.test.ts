import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import manifest from "@/app/manifest"

/**
 * The PWA asset inventory is maintained by hand in four places: app/manifest.ts,
 * public/sw.js (PRECACHE_URLS), app/layout.tsx <link> tags, and the sizes[] list
 * in scripts/generate-pwa-icons.mjs. They drifted badly once already — the
 * manifest pointed at PNGs that were never generated, layout.tsx linked
 * /manifest.json (the route serves /manifest.webmanifest), and sw.js precached
 * five URLs that 404'd, which made cache.addAll reject and left the service
 * worker permanently uninstalled.
 *
 * These assertions are the cheap version of a build-time generator: every
 * referenced asset must exist in public/, or be a route Next.js serves.
 */

const PUBLIC_DIR = path.resolve(__dirname, "..", "public")

/** Paths served by an app-router route rather than a file in public/. */
const ROUTE_SERVED = new Set(["/", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml"])

function resolves(url: string): boolean {
  if (ROUTE_SERVED.has(url)) return true
  return fs.existsSync(path.join(PUBLIC_DIR, url.replace(/^\//, "")))
}

function readSw(): string {
  return fs.readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8")
}

describe("PWA asset inventory", () => {
  it("every icon the manifest declares exists", () => {
    const missing = manifest().icons?.filter((i) => !resolves(i.src)).map((i) => i.src) ?? []
    expect(missing).toEqual([])
  })

  it("every shortcut and screenshot asset the manifest declares exists", () => {
    const m = manifest()
    const urls = [
      ...(m.shortcuts ?? []).flatMap((s) => (s.icons ?? []).map((i) => i.src)),
      ...(m.screenshots ?? []).map((s) => s.src),
    ]
    expect(urls.filter((u) => !resolves(u))).toEqual([])
  })

  it("every service-worker precache URL exists", () => {
    const block = readSw().match(/const PRECACHE_URLS = \[([\s\S]*?)\]/)
    expect(block, "PRECACHE_URLS not found in public/sw.js").toBeTruthy()

    const urls = [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((u) => !resolves(u))).toEqual([])
  })

  it("the wasm module is cached first, not re-written on every load", () => {
    // anydoc's module is ~6MB; falling through to networkFirst re-puts it into
    // the runtime cache on every page load.
    const cacheFirst = readSw().match(/const CACHE_FIRST_ROUTES = \[([\s\S]*?)\];/)
    expect(cacheFirst?.[1]).toMatch(/wasm/)
  })

  it("layout.tsx links the manifest route that actually exists", () => {
    const layout = fs.readFileSync(path.resolve(__dirname, "..", "app", "layout.tsx"), "utf8")
    expect(layout).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(layout).not.toContain('href="/manifest.json"')
  })

  it("every icon href in layout.tsx exists", () => {
    const layout = fs.readFileSync(path.resolve(__dirname, "..", "app", "layout.tsx"), "utf8")
    const hrefs = [...layout.matchAll(/(?:href|content)="(\/[^"]+\.(?:png|svg|ico|xml))"/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.filter((h) => !resolves(h))).toEqual([])
  })
})

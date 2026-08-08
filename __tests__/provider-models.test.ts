import { describe, expect, it } from "vitest"
import { AI_PROVIDERS } from "@/components/unified-configuration"
import {
  MODEL_MIGRATIONS,
  PROVIDER_DEFAULT_EMBEDDING_MODELS,
  PROVIDER_DEFAULT_TEXT_MODELS,
} from "@/lib/ai-client"

/**
 * Guards the provider tables against the two failure modes that are silent at
 * runtime and only surface as a 404 from the provider:
 *
 *   1. A migration points at a model id that no longer exists in the dropdown —
 *      i.e. a typo, or a target that was itself retired in a later refresh.
 *   2. A model id is offered in the dropdown while also being listed as
 *      deprecated for that provider, so picking it immediately gets rewritten.
 *
 * MODEL_MIGRATIONS is load-bearing: aiConfig is persisted to localStorage, so
 * users carry old model ids across updates and rely on this remap.
 */

type ProviderKey = keyof typeof AI_PROVIDERS

const modelsOf = (key: string): string[] => {
  const entry = (AI_PROVIDERS as Record<string, { models: string[] }>)[key]
  return entry ? entry.models : []
}

describe("provider model tables", () => {
  it("every provider offers its own defaultModel", () => {
    const bad = Object.entries(AI_PROVIDERS)
      .filter(([, p]) => !p.models.includes(p.defaultModel))
      .map(([k, p]) => `${k}: ${p.defaultModel}`)
    expect(bad).toEqual([])
  })

  it("every migration target is a model the provider still offers", () => {
    const bad: string[] = []
    for (const [provider, map] of Object.entries(MODEL_MIGRATIONS)) {
      const offered = modelsOf(provider)
      // Providers with no dropdown entry (vertex, alibaba, minimax) are skipped.
      if (offered.length === 0) continue
      for (const [from, to] of Object.entries(map ?? {})) {
        // Embedding models are not in the chat dropdown by design — they are
        // selected automatically from PROVIDER_DEFAULT_EMBEDDING_MODELS.
        const embed = PROVIDER_DEFAULT_EMBEDDING_MODELS[provider as keyof typeof PROVIDER_DEFAULT_EMBEDDING_MODELS]
        if (!offered.includes(to) && to !== embed) {
          bad.push(`${provider}: ${from} -> ${to} (target not offered)`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it("no offered model is also a migration source", () => {
    const bad: string[] = []
    for (const [provider, map] of Object.entries(MODEL_MIGRATIONS)) {
      for (const from of Object.keys(map ?? {})) {
        if (modelsOf(provider).includes(from)) bad.push(`${provider}: ${from}`)
      }
    }
    expect(bad).toEqual([])
  })

  it("no migration is a self-loop", () => {
    const bad: string[] = []
    for (const [provider, map] of Object.entries(MODEL_MIGRATIONS)) {
      for (const [from, to] of Object.entries(map ?? {})) {
        if (from === to) bad.push(`${provider}: ${from}`)
      }
    }
    expect(bad).toEqual([])
  })

  it("each dropdown provider has a default text model in ai-client", () => {
    const missing = Object.keys(AI_PROVIDERS).filter(
      (k) => !PROVIDER_DEFAULT_TEXT_MODELS[k as keyof typeof PROVIDER_DEFAULT_TEXT_MODELS],
    )
    expect(missing).toEqual([])
  })

  it("ai-client defaults are models the provider actually offers", () => {
    const bad: string[] = []
    for (const key of Object.keys(AI_PROVIDERS) as ProviderKey[]) {
      const fallback = PROVIDER_DEFAULT_TEXT_MODELS[key as keyof typeof PROVIDER_DEFAULT_TEXT_MODELS]
      if (fallback && !modelsOf(key).includes(fallback)) bad.push(`${key}: ${fallback}`)
    }
    expect(bad).toEqual([])
  })

  it("providers removed from the dropdown are gone from ai-client too", () => {
    expect(Object.keys(PROVIDER_DEFAULT_TEXT_MODELS)).not.toContain("anyscale")
    expect(Object.keys(PROVIDER_DEFAULT_TEXT_MODELS)).not.toContain("replicate")
  })
})

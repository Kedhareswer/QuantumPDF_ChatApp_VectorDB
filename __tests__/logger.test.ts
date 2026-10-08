import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { logger } from "@/lib/logger"

describe("logger", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = { ...originalEnv }
  })

  it("silences debug() in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    delete process.env.NEXT_PUBLIC_DEBUG
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("hidden")
    expect(spy).not.toHaveBeenCalled()
  })

  it("emits debug() outside production", () => {
    vi.stubEnv("NODE_ENV", "development")
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("shown")
    expect(spy).toHaveBeenCalledWith("shown")
  })

  it("emits debug() in production when NEXT_PUBLIC_DEBUG=true", () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.NEXT_PUBLIC_DEBUG = "true"
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    logger.debug("forced")
    expect(spy).toHaveBeenCalledWith("forced")
  })

  it("always emits warn() and error()", () => {
    vi.stubEnv("NODE_ENV", "production")
    delete process.env.NEXT_PUBLIC_DEBUG
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger.warn("w")
    logger.error("e")
    expect(warnSpy).toHaveBeenCalledWith("w")
    expect(errorSpy).toHaveBeenCalledWith("e")
  })
})

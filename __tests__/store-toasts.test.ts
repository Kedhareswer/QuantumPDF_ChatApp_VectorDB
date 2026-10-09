import { afterEach, describe, expect, it, vi } from "vitest"
import { useAppStore } from "@/lib/store"

describe("store toasts", () => {
  afterEach(() => vi.useRealTimers())

  it("auto-dismisses success after 5s and errors after 10s", () => {
    vi.useFakeTimers()
    const { addError } = useAppStore.getState()
    addError({ type: "success", title: "a", message: "a" })
    addError({ type: "success", title: "b", message: "b" })
    addError({ type: "error", title: "c", message: "c" })
    expect(useAppStore.getState().errors).toHaveLength(3)

    vi.advanceTimersByTime(5000)
    expect(useAppStore.getState().errors.map((e) => e.title)).toEqual(["c"])

    vi.advanceTimersByTime(5000)
    expect(useAppStore.getState().errors).toHaveLength(0)
  })
})

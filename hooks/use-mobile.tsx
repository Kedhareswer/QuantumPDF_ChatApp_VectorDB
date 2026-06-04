import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile(): boolean {
  // useSyncExternalStore reads the initial value synchronously (with an SSR-safe
  // server snapshot) and subscribes to changes, with no setState inside an effect.
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}

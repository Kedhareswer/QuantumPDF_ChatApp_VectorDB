/**
 * Debug-gated logger.
 *
 * `debug`/`info` are silenced in production unless `NEXT_PUBLIC_DEBUG=true`,
 * which keeps the console quiet for end users while preserving developer
 * visibility. `warn`/`error` always pass through.
 *
 * The flag is read at call-time (not module-load) so runtime env changes — and
 * tests — can toggle it.
 */
function debugEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEBUG === "true" ||
    process.env.NODE_ENV !== "production"
  )
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (debugEnabled()) console.log(...args)
  },
  info: (...args: unknown[]): void => {
    if (debugEnabled()) console.info(...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },
  error: (...args: unknown[]): void => {
    console.error(...args)
  },
}

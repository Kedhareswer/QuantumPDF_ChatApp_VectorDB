// lib/rate-limiter.ts - Advanced rate limiting with token bucket and adaptive backoff

export interface RateLimiterConfig {
  algorithm: 'fixed' | 'token-bucket' | 'adaptive'
  tokensPerInterval: number
  intervalMs: number
  maxBurst: number
  adaptiveBackoff?: {
    enabled: boolean
    initialDelay: number
    maxDelay: number
    multiplier: number
  }
}

export abstract class BaseRateLimiter {
  protected config: RateLimiterConfig

  constructor(config: RateLimiterConfig) {
    this.config = config
  }

  abstract async acquire(): Promise<void>
  abstract getStats(): any
  abstract reset(): void
}

// Fixed window rate limiter
export class FixedWindowRateLimiter extends BaseRateLimiter {
  private requests: number = 0
  private windowStart: number = Date.now()

  async acquire(): Promise<void> {
    const now = Date.now()
    const windowElapsed = now - this.windowStart

    // Reset window if interval has passed
    if (windowElapsed >= this.config.intervalMs) {
      this.requests = 0
      this.windowStart = now
    }

    // Check if we've exceeded the limit
    if (this.requests >= this.config.tokensPerInterval) {
      const waitTime = this.config.intervalMs - windowElapsed
      await this.delay(waitTime)
      // Reset after waiting
      this.requests = 0
      this.windowStart = Date.now()
    }

    this.requests++
  }

  getStats() {
    return {
      requests: this.requests,
      limit: this.config.tokensPerInterval,
      windowStart: new Date(this.windowStart),
      remainingTime: Math.max(
        0,
        this.config.intervalMs - (Date.now() - this.windowStart)
      ),
    }
  }

  reset(): void {
    this.requests = 0
    this.windowStart = Date.now()
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Token bucket rate limiter (smooths traffic better than fixed window)
export class TokenBucketRateLimiter extends BaseRateLimiter {
  private tokens: number
  private lastRefillTime: number
  private queue: Array<() => void> = []

  constructor(config: RateLimiterConfig) {
    super(config)
    this.tokens = config.maxBurst
    this.lastRefillTime = Date.now()
  }

  async acquire(): Promise<void> {
    await this.refillTokens()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return Promise.resolve()
    }

    // Wait for token to become available
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
      this.processQueue()
    })
  }

  private async refillTokens(): Promise<void> {
    const now = Date.now()
    const timePassed = now - this.lastRefillTime

    // Calculate tokens to add
    const tokensToAdd =
      (timePassed / this.config.intervalMs) * this.config.tokensPerInterval

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxBurst)
      this.lastRefillTime = now
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      await this.refillTokens()

      if (this.tokens >= 1) {
        this.tokens -= 1
        const resolve = this.queue.shift()
        resolve?.()
      } else {
        // Wait for next refill
        const refillTime =
          this.config.intervalMs / this.config.tokensPerInterval
        await this.delay(refillTime)
      }
    }
  }

  getStats() {
    return {
      tokens: this.tokens,
      maxTokens: this.config.maxBurst,
      queueLength: this.queue.length,
      lastRefillTime: new Date(this.lastRefillTime),
    }
  }

  reset(): void {
    this.tokens = this.config.maxBurst
    this.lastRefillTime = Date.now()
    this.queue = []
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Adaptive rate limiter with exponential backoff
export class AdaptiveRateLimiter extends BaseRateLimiter {
  private bucketLimiter: TokenBucketRateLimiter
  private failures: number = 0
  private currentDelay: number
  private lastFailureTime: number = 0

  constructor(config: RateLimiterConfig) {
    super(config)
    this.bucketLimiter = new TokenBucketRateLimiter(config)
    this.currentDelay = config.adaptiveBackoff?.initialDelay || 100
  }

  async acquire(): Promise<void> {
    // First, check token bucket
    await this.bucketLimiter.acquire()

    // If we have recent failures, add adaptive delay
    if (this.failures > 0) {
      const timeSinceFailure = Date.now() - this.lastFailureTime

      // Reset if enough time has passed
      if (timeSinceFailure > 60000) {
        // 1 minute
        this.resetBackoff()
      } else {
        await this.delay(this.currentDelay)
      }
    }
  }

  recordSuccess(): void {
    // Gradually reduce delay on success
    if (this.failures > 0) {
      this.failures = Math.max(0, this.failures - 1)
      this.currentDelay = Math.max(
        this.config.adaptiveBackoff?.initialDelay || 100,
        this.currentDelay / (this.config.adaptiveBackoff?.multiplier || 2)
      )
    }
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    const maxDelay = this.config.adaptiveBackoff?.maxDelay || 5000
    const multiplier = this.config.adaptiveBackoff?.multiplier || 2

    this.currentDelay = Math.min(this.currentDelay * multiplier, maxDelay)
  }

  getStats() {
    return {
      ...this.bucketLimiter.getStats(),
      failures: this.failures,
      currentDelay: this.currentDelay,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime)
        : null,
    }
  }

  reset(): void {
    this.bucketLimiter.reset()
    this.resetBackoff()
  }

  private resetBackoff(): void {
    this.failures = 0
    this.currentDelay = this.config.adaptiveBackoff?.initialDelay || 100
    this.lastFailureTime = 0
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Factory function
export function createRateLimiter(config: RateLimiterConfig): BaseRateLimiter {
  switch (config.algorithm) {
    case 'fixed':
      return new FixedWindowRateLimiter(config)
    case 'token-bucket':
      return new TokenBucketRateLimiter(config)
    case 'adaptive':
      return new AdaptiveRateLimiter(config)
    default:
      return new TokenBucketRateLimiter(config)
  }
}

// Circuit breaker for provider fallback
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private nextAttemptTime: number = 0

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000, // 1 minute
    private halfOpenRequests: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now()
      if (now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN
        this.successCount = 0
        console.log('Circuit breaker entering HALF_OPEN state')
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Try again in ${Math.ceil((this.nextAttemptTime - now) / 1000)}s`
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.halfOpenRequests) {
        this.state = CircuitState.CLOSED
        console.log('Circuit breaker closed after successful recovery')
      }
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.resetTimeout
      console.log('Circuit breaker reopened after failure in HALF_OPEN state')
    } else if (this.failures >= this.failureThreshold) {
      this.state = CircuitState.OPEN
      this.nextAttemptTime = Date.now() + this.resetTimeout
      console.log(
        `Circuit breaker opened after ${this.failures} failures. Will retry at ${new Date(this.nextAttemptTime).toLocaleTimeString()}`
      )
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime)
        : null,
      nextAttemptTime: this.nextAttemptTime
        ? new Date(this.nextAttemptTime)
        : null,
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.nextAttemptTime = 0
  }
}

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Star } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SpringOptions as FM_SpringOptions } from "framer-motion"
import { useMotionValue, useSpring, useTransform } from "framer-motion"

// Public SpringOptions type to keep API stable even if framer-motion changes types
export type SpringOptions = Pick<FM_SpringOptions, "stiffness" | "damping"> & {
  mass?: number
}

export interface GitHubStarsButtonProps {
  username: string
  repo: string
  formatted?: boolean
  transition?: SpringOptions
  inView?: boolean
  inViewMargin?: string
  inViewOnce?: boolean
  className?: string
  onClick?: () => void
}

// Minimal GitHub repo response type
interface GitHubRepoResponse {
  stargazers_count?: number
  message?: string // when hitting rate limits
}

// Local cache TTL (ms)
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function cacheKey(username: string, repo: string) {
  return `gh-stars:${username}/${repo}`
}

function readCachedStars(username: string, repo: string): number | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(username, repo))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value: number; ts: number }
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed.value
  } catch {
    return null
  }
}

function writeCachedStars(username: string, repo: string, value: number) {
  try {
    sessionStorage.setItem(cacheKey(username, repo), JSON.stringify({ value, ts: Date.now() }))
  } catch {
    // no-op
  }
}

function formatCount(n: number, compact: boolean): string {
  if (!compact) return n.toLocaleString()
  if (n < 1000) return n.toLocaleString()
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(1)}B`
}

// Simple particle burst using DOM nodes + CSS transitions
function ParticleBurst({ trigger }: { trigger: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [burstKey, setBurstKey] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    setBurstKey((k) => k + 1)
    const root = containerRef.current

    const count = 16
    const rect = root.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const nodes: HTMLSpanElement[] = []

    for (let i = 0; i < count; i++) {
      const node = document.createElement("span")
      node.className = "absolute block rounded-full pointer-events-none"
      const size = 4 + Math.random() * 3
      node.style.width = `${size}px`
      node.style.height = `${size}px`
      node.style.left = `${centerX - size / 2}px`
      node.style.top = `${centerY - size / 2}px`
      node.style.background = `radial-gradient(circle, #FFD166 0%, #F7B801 40%, #E09F3E 100%)`
      node.style.opacity = "0.9"
      node.style.transform = `translate(0px, 0px) scale(1)`
      node.style.transition = `transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 600ms ease-out`
      root.appendChild(node)
      nodes.push(node)

      // Animate to random direction
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
      const distance = 28 + Math.random() * 24
      requestAnimationFrame(() => {
        node.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(${0.8 + Math.random() * 0.6})`
        node.style.opacity = "0"
      })
    }

    const cleanup = setTimeout(() => {
      nodes.forEach((n) => n.remove())
    }, 700)

    return () => clearTimeout(cleanup)
  }, [trigger])

  return <div ref={containerRef} className="absolute inset-0 overflow-visible" />
}

export function GitHubStarsButton({
  username,
  repo,
  formatted = false,
  transition = { stiffness: 90, damping: 50 },
  inView = false,
  inViewMargin = "0px",
  inViewOnce = true,
  className,
  onClick,
}: GitHubStarsButtonProps) {
  const [stars, setStars] = useState<number>(0)
  const [target, setTarget] = useState<number>(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [burstCounter, setBurstCounter] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hadError, setHadError] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: transition.stiffness, damping: transition.damping, mass: transition.mass || 1 })
  const rounded = useTransform(spring, (v: number) => Math.round(v))

  // Observe viewport entry to optionally trigger animation
  useEffect(() => {
    if (!inView || !buttonRef.current) return

    const el = buttonRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            triggerAnimate()
            if (inViewOnce) observer.disconnect()
          }
        }
      },
      { root: null, rootMargin: inViewMargin, threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, inViewMargin, inViewOnce])

  const fetchStars = useCallback(async () => {
    setIsLoading(true)
    setHadError(false)

    try {
      const cached = readCachedStars(username, repo)
      if (cached !== null) {
        setTarget(cached)
        setIsLoading(false)
        return
      }

      // Try server-side cached endpoint first
      let value = 0
      let ok = false
      try {
        const apiRes = await fetch(`/api/github/stars?username=${encodeURIComponent(username)}&repo=${encodeURIComponent(repo)}`, {
          headers: { "cache-control": "no-cache" },
        })
        if (apiRes.ok) {
          const payload = await apiRes.json()
          if (typeof payload?.stars === 'number') {
            value = payload.stars
            ok = true
          }
        }
      } catch {}

      // Fallback to GitHub public API if server route fails
      if (!ok) {
        const res = await fetch(`https://api.github.com/repos/${username}/${repo}`)
        if (!res.ok) {
          // 404 for private repos, 403 for rate limits
          setHadError(true)
          setIsLoading(false)
          return
        }
        const data: GitHubRepoResponse = await res.json()
        value = typeof data.stargazers_count === "number" ? data.stargazers_count : 0
      }
      writeCachedStars(username, repo, value)
      setTarget(value)
    } catch (e) {
      setHadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [username, repo])

  useEffect(() => {
    fetchStars()
  }, [fetchStars])

  // Drive the spring to target
  useEffect(() => {
    mv.set(stars)
    spring.set(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  // Subscribe rounded value to update visual number
  useEffect(() => {
    const unsub = rounded.on("change", (v: number) => setStars(v))
    return () => unsub()
  }, [rounded])

  const label = useMemo(() => {
    if (isLoading) return "Loading GitHub stars"
    if (hadError) return `GitHub stars (error)`
    return `GitHub stars: ${target}`
  }, [isLoading, hadError, target])

  const triggerAnimate = useCallback(() => {
    // If already animated once and inViewOnce is true, skip repeated burst
    if (hasAnimated && inViewOnce) return
    setHasAnimated(true)
    setBurstCounter((c) => c + 1)
  }, [hasAnimated, inViewOnce])

  const handleClick = useCallback(() => {
    triggerAnimate()

    if (onClick) {
      onClick()
      return
    }

    // Default: open repo after short delay to let the burst play
    const url = `https://github.com/${username}/${repo}`
    setTimeout(() => {
      try {
        window.open(url, "_blank", "noopener,noreferrer")
      } catch {
        window.location.href = url
      }
    }, 500)
  }, [onClick, repo, username, triggerAnimate])

  // Icon fill animation based on progress toward target
  const progress = useMemo(() => (target > 0 ? Math.min(1, stars / Math.max(target, 1)) : 0), [stars, target])

  return (
    <div className={cn("relative inline-block", className)}>
      <Button
        ref={buttonRef}
        variant="outline"
        className={cn(
          "border-2 border-black bg-white hover:bg-black hover:text-white transition-colors",
          "flex items-center gap-2 px-3 py-2",
        )}
        aria-label={label}
        title={label}
        onClick={handleClick}
        disabled={isLoading}
      >
        <div className="relative w-4 h-4">
          <Star className="absolute inset-0 w-4 h-4 text-gray-400" />
          <Star
            className="absolute inset-0 w-4 h-4 text-yellow-500"
            style={{
              clipPath: `inset(${Math.round((1 - progress) * 100)}% 0 0 0)`,
              transition: "clip-path 400ms ease-out",
            }}
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-3 w-10" />
        ) : (
          <span className="tabular-nums font-semibold min-w-[3.5ch] text-right">
            {formatted ? formatCount(stars, true) : stars.toLocaleString()}
          </span>
        )}
      </Button>

      {/* Particle burst layer */}
      {!isLoading && <ParticleBurst trigger={burstCounter} />}

      {/* Subtext for errors (optional) */}
      {hadError && (
        <div className="absolute left-0 right-0 mt-1 text-[10px] text-red-600 text-center select-none">
          API limit or network error
        </div>
      )}
    </div>
  )
}

export default GitHubStarsButton

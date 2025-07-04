"use client"

import { useEffect, useRef } from "react"
// @ts-ignore - mermaid has no TS types in this project
import mermaid from "mermaid"

interface MermaidProps {
  chart: string
}

export default function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    // Initialize once
    mermaid.initialize({ startOnLoad: false, theme: "neutral" })
    const id = `mermaid-${Date.now().toString(36)}`
    try {
      // Use callback form to properly resolve promise and avoid [object Promise]
      (mermaid as any).render(id, chart, (svg: string) => {
        if (ref.current) ref.current.innerHTML = svg
      })
    } catch (err) {
      console.error("Mermaid render error", err)
    }
  }, [chart])

  return <div ref={ref} className="my-4 overflow-x-auto" />
} 
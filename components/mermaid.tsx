"use client"

import { useEffect, useRef } from "react"
// @ts-expect-error - mermaid has no TS types in this project
import mermaid from "mermaid"

interface MermaidProps {
  chart: string
}

interface MermaidRenderer {
  initialize: (config: { startOnLoad: boolean; theme: string }) => void
  render: (id: string, chart: string, cb: (svg: string) => void) => void
}

export default function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null)
  const renderer = mermaid as unknown as MermaidRenderer

  useEffect(() => {
    if (!ref.current) return
    // Initialize once
    renderer.initialize({ startOnLoad: false, theme: "neutral" })
    const id = `mermaid-${Date.now().toString(36)}`
    try {
      // Use callback form to properly resolve promise and avoid [object Promise]
      renderer.render(id, chart, (svg: string) => {
        if (ref.current) ref.current.innerHTML = svg
      })
    } catch (err) {
      console.error("Mermaid render error", err)
    }
  }, [chart, renderer])

  return <div ref={ref} className="my-4 overflow-x-auto" />
} 

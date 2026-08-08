"use client"

/**
 * First-run product tour (driver.js).
 *
 * Replaces the old TutorialModal, which collected an API key inline. The tour
 * points at the Settings tab instead — the same provider/key form lives there
 * in UnifiedConfiguration, so there is only one place to maintain.
 */
import { useAppStore } from "@/lib/store"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { useEffect } from "react"

const SEEN_KEY = "quantum-pdf-tour-completed"

export function OnboardingTour() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return
    // ponytail: desktop only — below lg the sidebar the tour points at is
    // off-canvas, so every highlight would land on a hidden element.
    if (!window.matchMedia("(min-width: 1024px)").matches) return

    const tour = driver({
      showProgress: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Get started",
      steps: [
        {
          popover: {
            title: "Welcome to QuantumPDF",
            description:
              "Ask questions about your own documents. Three things to know — this takes about 20 seconds.",
          },
        },
        {
          element: '[data-tour="tab-settings"]',
          popover: {
            title: "1. Connect an AI provider",
            description:
              "Settings holds the provider list. Pick one — OpenAI, Anthropic, Google, Groq, DeepSeek or Mistral — and paste its API key. You only need one.",
            side: "right",
          },
          onHighlightStarted: () => setActiveTab("settings"),
        },
        {
          element: '[data-tour="tab-documents"]',
          popover: {
            title: "2. Upload a document",
            description:
              "PDF, Word, PowerPoint, Excel, OpenDocument, EPUB or CSV. Text is extracted, chunked and embedded so it can be searched.",
            side: "right",
          },
          onHighlightStarted: () => setActiveTab("documents"),
        },
        {
          element: "#chat-input",
          popover: {
            title: "3. Ask away",
            description:
              "Answers cite the chunks they came from, so you can check every claim against the source.",
            side: "top",
          },
        },
      ],
    })

    const timer = setTimeout(() => {
      // Mark seen on start, not on finish: otherwise React StrictMode's
      // double-mount destroys the tour before it ever runs and burns the flag.
      localStorage.setItem(SEEN_KEY, "true")
      tour.drive()
    }, 1200) // long enough for a cold first paint — a spotlight on a half-drawn app reads as broken

    return () => {
      clearTimeout(timer)
      tour.destroy()
    }
  }, [setActiveTab])

  return null
}

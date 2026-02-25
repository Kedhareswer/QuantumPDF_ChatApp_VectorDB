"use client"

import { Brain, Database, FileText, Zap } from "lucide-react"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

export default function Loading() {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const loadingSteps = useMemo(
    () => [
      { icon: Brain, text: "Initializing AI Engine", delay: 0 },
      { icon: Database, text: "Connecting Vector Database", delay: 800 },
      { icon: FileText, text: "Loading Document Processor", delay: 1600 },
      { icon: Zap, text: "Powering Up Quantum PDF", delay: 2400 },
    ],
    []
  )

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 1
      })
    }, 30)

    // Cycle through loading steps
    loadingSteps.forEach((step, index) => {
      setTimeout(() => {
        setCurrentStep(index)
      }, step.delay)
    })

    return () => clearInterval(progressInterval)
  }, [loadingSteps])

  const CurrentIcon = loadingSteps[currentStep]?.icon || Brain

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center z-50">
      <div className="text-center space-y-8 max-w-md px-4">
        {/* Animated Logo */}
        <div className="relative">
          <div className="w-32 h-32 mx-auto border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            <div className="w-full h-full flex items-center justify-center p-4">
              <Image
                src="/brain.png"
                alt="Quantum PDF"
                width={96}
                height={96}
                className="object-contain animate-float"
              />
            </div>
          </div>
          {/* Floating particles effect */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-black rounded-full animate-ping" />
          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-black rounded-full animate-ping" style={{ animationDelay: "0.5s" }} />
        </div>

        {/* Brand Name */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">
            QUANTUM PDF
          </h1>
          <p className="text-sm font-semibold text-gray-600 tracking-wider">
            AI DOCUMENT ANALYSIS
          </p>
        </div>

        {/* Loading Step Indicator */}
        <div className="min-h-[60px] flex flex-col items-center justify-center space-y-3">
          <div className="flex items-center space-x-3 text-black">
            <CurrentIcon className="w-5 h-5 animate-bounce" />
            <span className="text-sm font-semibold tracking-wide">
              {loadingSteps[currentStep]?.text || "Loading..."}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-gray-200 border-2 border-black relative overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
          <p className="text-xs font-mono text-gray-500">
            {progress}% COMPLETE
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="px-3 py-1 bg-black text-white text-xs font-semibold border-2 border-black">
            RAG POWERED
          </span>
          <span className="px-3 py-1 bg-white text-black text-xs font-semibold border-2 border-black">
            MULTI-DOC
          </span>
          <span className="px-3 py-1 bg-black text-white text-xs font-semibold border-2 border-black">
            AI CHAT
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}

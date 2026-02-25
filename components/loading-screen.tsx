"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

interface LoadingScreenProps {
  onComplete: () => void
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [showLogo, setShowLogo] = useState(false)

  useEffect(() => {
    // Show logo animation
    setTimeout(() => setShowLogo(true), 200)

    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onComplete, 800) // Allow fade out animation to complete
    }, 2500)

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-800 opacity-0 pointer-events-none">
        <div className="text-center space-y-6">
          <div className="w-32 h-32 mx-auto border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="w-full h-full flex items-center justify-center p-4">
              <Image
                src="/brain.png"
                alt="Quantum PDF"
                width={96}
                height={96}
                className="object-contain"
              />
            </div>
          </div>
          <h1 className="leading-none tracking-tight text-black select-none">
            <span className="block text-4xl md:text-5xl xl:text-6xl font-black">
              {"QUANTUM PDF".split("").map((letter, index) => (
                <span
                  key={index}
                  className="inline-block opacity-0"
                  style={{
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </span>
              ))}
            </span>
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center space-y-8">
        {/* Animated Logo */}
        <div
          className={`transform transition-all duration-700 ${
            showLogo ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <div className="w-32 h-32 mx-auto border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
            <div className="w-full h-full flex items-center justify-center p-4">
              <Image
                src="/brain.png"
                alt="Quantum PDF"
                width={96}
                height={96}
                className="object-contain animate-float"
              />
            </div>
            {/* Corner accents */}
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-black" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-black" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-black" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-black" />
          </div>
        </div>

        {/* Animated Text */}
        <h1 className="leading-none tracking-tight text-black select-none">
          <span className="block text-4xl md:text-5xl xl:text-6xl font-black overflow-hidden">
            {"QUANTUM PDF".split("").map((letter, index) => (
              <span
                key={index}
                className="inline-block animate-letterSlideIn opacity-0 translate-y-full"
                style={{
                  animationDelay: `${0.5 + index * 0.05}s`,
                }}
              >
                {letter === " " ? "\u00A0" : letter}
              </span>
            ))}
          </span>
          <span className="block text-sm md:text-base font-semibold text-gray-600 mt-3 tracking-wider opacity-0 animate-fadeIn" style={{ animationDelay: "1.2s" }}>
            AI DOCUMENT ANALYSIS
          </span>
        </h1>

        {/* Loading indicator */}
        <div className="flex items-center justify-center space-x-2 opacity-0 animate-fadeIn" style={{ animationDelay: "1.5s" }}>
          <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes letterSlideIn {
          0% {
            opacity: 0;
            transform: translateY(100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(2deg);
          }
        }
        .animate-letterSlideIn {
          animation: letterSlideIn 0.5s ease-out forwards;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

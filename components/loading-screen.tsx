"use client"

import { useEffect, useState } from "react"

interface LoadingScreenProps {
  onComplete: () => void
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onComplete, 500) // Allow fade out animation to complete
    }, 3000) // 3 seconds

    return () => clearTimeout(timer)
  }, [onComplete])

  if (!isVisible) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center transition-opacity duration-500 opacity-0 pointer-events-none">
        <div className="text-center">
          <h1 className="leading-none tracking-tight text-white select-none">
            <span className="block text-[22vw] md:text-[16vw] xl:text-[12vw] 2xl:text-[10vw] font-extrabold overflow-hidden">
              {"Quantum".split("").map((letter, index) => (
                <span
                  key={index}
                  className="inline-block animate-letterSlideIn opacity-0 -translate-y-full"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    clipPath: "inset(0 0 100% 0)",
                  }}
                >
                  {letter}
                </span>
              ))}
            </span>
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="leading-none tracking-tight text-white select-none">
          <span className="block text-[22vw] md:text-[16vw] xl:text-[12vw] 2xl:text-[10vw] font-extrabold overflow-hidden">
            {"Quantum".split("").map((letter, index) => (
              <span
                key={index}
                className="inline-block animate-letterSlideIn opacity-0 -translate-y-full"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  clipPath: "inset(0 0 100% 0)",
                }}
              >
                {letter}
              </span>
            ))}
          </span>
        </h1>
      </div>
    </div>
  )
}

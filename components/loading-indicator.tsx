import { Brain } from "lucide-react"

interface LoadingIndicatorProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingIndicator({
  message = "Loading...",
  className = "",
  size = "md"
}: LoadingIndicatorProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  }

  const dotSizes = {
    sm: "w-1 h-1",
    md: "w-1.5 h-1.5",
    lg: "w-2 h-2"
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      {/* Branded loading animation */}
      <div className="relative mb-4">
        <div className={`${sizeClasses[size]} border-2 border-black bg-white flex items-center justify-center`}>
          <Brain className={`${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-10 h-10'} animate-pulse`} />
        </div>
        {/* Animated corner dots */}
        <div className={`absolute -top-0.5 -left-0.5 ${dotSizes[size]} bg-black rounded-full animate-ping`} />
        <div className={`absolute -top-0.5 -right-0.5 ${dotSizes[size]} bg-black rounded-full animate-ping`} style={{ animationDelay: "0.2s" }} />
        <div className={`absolute -bottom-0.5 -left-0.5 ${dotSizes[size]} bg-black rounded-full animate-ping`} style={{ animationDelay: "0.4s" }} />
        <div className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} bg-black rounded-full animate-ping`} style={{ animationDelay: "0.6s" }} />
      </div>

      {/* Loading message */}
      <p className={`font-semibold text-black ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'}`}>
        {message}
      </p>

      {/* Animated dots */}
      <div className="flex items-center space-x-1 mt-2">
        <div className={`${dotSizes[size]} bg-black rounded-full animate-bounce`} style={{ animationDelay: "0s" }} />
        <div className={`${dotSizes[size]} bg-black rounded-full animate-bounce`} style={{ animationDelay: "0.2s" }} />
        <div className={`${dotSizes[size]} bg-black rounded-full animate-bounce`} style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  )
}

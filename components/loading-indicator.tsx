import { Loader2 } from "lucide-react"

interface LoadingIndicatorProps {
  message?: string
  className?: string
}

export function LoadingIndicator({ message = "Loading...", className = "" }: LoadingIndicatorProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin mb-2" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}

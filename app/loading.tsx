import { Loader2, Brain } from "lucide-react"

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center space-y-6 max-w-sm px-4">
        {/* Logo/Icon */}
        <div className="w-16 h-16 border-4 border-black mx-auto flex items-center justify-center bg-gray-50">
          <Brain className="w-8 h-8" />
        </div>
        
        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-semibold tracking-wide">LOADING QUANTUM PDF</span>
        </div>
        
        {/* Progress Indicator */}
        <div className="space-y-3">
          <div className="w-full bg-gray-200 h-2 border-2 border-black">
            <div className="bg-black h-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
          <p className="text-sm text-gray-600">
            Initializing AI-powered document analysis...
          </p>
        </div>
      </div>
    </div>
  )
}

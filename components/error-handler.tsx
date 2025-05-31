"use client"

import { useState, useCallback } from "react"
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface ErrorInfo {
  id: string
  type: "error" | "warning" | "info" | "success"
  title: string
  message: string
  details?: string
  dismissible?: boolean
  persistent?: boolean
  action?: {
    label: string
    handler: () => void
  }
  timestamp: Date
}

interface ErrorHandlerProps {
  errors: ErrorInfo[]
  onDismiss: (id: string) => void
}

export function useErrorHandler() {
  const [errors, setErrors] = useState<ErrorInfo[]>([])
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  // Monitor network status
  useState(() => {
    if (typeof window !== "undefined") {
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)

      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  })

  const addError = useCallback((error: Omit<ErrorInfo, "id" | "timestamp">) => {
    const newError: ErrorInfo = {
      ...error,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    }

    setErrors((prev) => [...prev, newError])

    // Auto-dismiss non-persistent errors after 5 seconds
    if (!error.persistent && error.dismissible !== false) {
      setTimeout(() => {
        setErrors((prev) => prev.filter((e) => e.id !== newError.id))
      }, 5000)
    }
  }, [])

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  // Convenience methods for common error types
  const addApiError = useCallback(
    (provider: string, message: string) => {
      addError({
        type: "error",
        title: `${provider} API Error`,
        message,
        details: "Check your API key, network connection, and provider status",
        dismissible: true,
      })
    },
    [addError],
  )

  const addNetworkError = useCallback(
    (operation: string) => {
      addError({
        type: "error",
        title: "Network Error",
        message: `Failed to ${operation}. Please check your internet connection.`,
        dismissible: true,
      })
    },
    [addError],
  )

  const addValidationError = useCallback(
    (field: string, message: string) => {
      addError({
        type: "warning",
        title: `${field} Validation Error`,
        message,
        dismissible: true,
      })
    },
    [addError],
  )

  const addSuccess = useCallback(
    (message: string) => {
      addError({
        type: "success",
        title: "Success",
        message,
        dismissible: true,
      })
    },
    [addError],
  )

  return {
    errors,
    isOnline,
    addError,
    dismissError,
    clearErrors,
    addApiError,
    addNetworkError,
    addValidationError,
    addSuccess,
  }
}

export function ErrorHandler({ errors, onDismiss }: ErrorHandlerProps) {
  const getIcon = (type: ErrorInfo["type"]) => {
    switch (type) {
      case "error":
        return <AlertCircle className="h-4 w-4" />
      case "warning":
        return <AlertTriangle className="h-4 w-4" />
      case "info":
        return <Info className="h-4 w-4" />
      case "success":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getVariant = (type: ErrorInfo["type"]) => {
    switch (type) {
      case "error":
        return "destructive"
      case "warning":
        return "default"
      case "info":
        return "default"
      case "success":
        return "default"
      default:
        return "default"
    }
  }

  const getColorClasses = (type: ErrorInfo["type"]) => {
    switch (type) {
      case "error":
        return "border-red-600 bg-red-50"
      case "warning":
        return "border-yellow-600 bg-yellow-50"
      case "info":
        return "border-blue-600 bg-blue-50"
      case "success":
        return "border-green-600 bg-green-50"
      default:
        return "border-gray-600 bg-gray-50"
    }
  }

  if (errors.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-md">
      {errors.map((error) => (
        <Alert
          key={error.id}
          variant={getVariant(error.type)}
          className={`${getColorClasses(error.type)} border-2 shadow-lg animate-in slide-in-from-right-full duration-300`}
        >
          <div className="flex items-start space-x-2">
            {getIcon(error.type)}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm">{error.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {error.type.toUpperCase()}
                  </Badge>
                </div>
                {error.dismissible !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(error.id)}
                    className="h-6 w-6 p-0 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <AlertDescription className="text-sm">{error.message}</AlertDescription>
              {error.details && (
                <AlertDescription className="text-xs text-gray-600 mt-1">{error.details}</AlertDescription>
              )}
              {error.action && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={error.action.handler}
                    className="h-7 text-xs border-current"
                  >
                    {error.action.label}
                  </Button>
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">{error.timestamp.toLocaleTimeString()}</div>
            </div>
          </div>
        </Alert>
      ))}
    </div>
  )
}

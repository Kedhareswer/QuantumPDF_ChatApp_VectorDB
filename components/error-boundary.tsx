"use client"

import React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />
      }

      return (
        <div className="min-h-screen bg-white text-black font-mono flex items-center justify-center p-4">
          <Card className="border-2 border-red-600 shadow-none max-w-md w-full">
            <CardHeader className="border-b border-red-600 bg-red-50">
              <CardTitle className="flex items-center space-x-2 text-red-800">
                <AlertTriangle className="w-6 h-6" />
                <span>APPLICATION ERROR</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Something went wrong:</strong>
                </p>
                <p className="text-sm text-gray-600">{this.state.error?.message || "An unexpected error occurred"}</p>
              </div>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-xs bg-gray-100 p-3 rounded border">
                  <summary className="cursor-pointer font-medium">Technical Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error.stack}</pre>
                  {this.state.errorInfo && (
                    <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.errorInfo.componentStack}</pre>
                  )}
                </details>
              )}

              <div className="flex space-x-2">
                <Button
                  onClick={this.resetError}
                  className="flex-1 border-2 border-black bg-white text-black hover:bg-black hover:text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1 border-2 border-black"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                If this problem persists, please refresh the page or contact support.
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

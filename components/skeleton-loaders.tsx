"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

export function DocumentCardSkeleton() {
  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

export function DocumentLibrarySkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ConfigurationSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />

      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border-2 border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex justify-end space-x-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SystemStatusSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />

      <div className="grid gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function PDFProcessorSkeleton() {
  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-48" />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
            <Skeleton className="h-8 w-8 mx-auto mb-3" />
            <Skeleton className="h-4 w-48 mx-auto mb-2" />
            <Skeleton className="h-3 w-32 mx-auto" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
      <div className="border-t border-gray-200 p-4">
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  )
}

export function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />

      <Card className="border-2 border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// New skeleton loaders for missing states

export function SearchResultsSkeleton() {
  return (
    <Card className="border-2 border-black shadow-none">
      <CardHeader className="border-b border-black">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-4 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function EnhancedSearchLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-black shadow-none">
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-3 w-48 mx-auto" />
            </div>
            <div className="w-full max-w-xs">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function APITestingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
          <div className="flex items-center justify-center space-x-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div 
                key={i}
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConfigurationTestingSkeleton() {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-1 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ChatProcessingSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Card className="border-2 border-gray-200 bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4 mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function QuickActionsLoadingSkeleton() {
  return (
    <div className="flex items-center space-x-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BulkExportLoadingSkeleton() {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-6 w-8 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RealTimeMetricsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, cardIndex) => (
        <Card key={cardIndex} className="border-2 border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
            {cardIndex === 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TabContentLoadingSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-2 border-gray-200">
            <CardHeader className="border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function MainAppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar skeleton */}
      <div className="w-80 bg-white border-r-2 border-black">
        <div className="p-6 border-b-2 border-black bg-black">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 bg-white/20" />
            <Skeleton className="h-4 w-48 bg-white/10" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-2 border-gray-200">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-2 border-black p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-8 w-8" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </header>
        <div className="flex-1 p-6">
          <div className="space-y-6">
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-black" />
              <Skeleton className="h-6 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VectorDatabaseLoadingSkeleton() {
  return (
    <Card className="border-2 border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-8 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WandbConfigurationLoadingSkeleton() {
  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

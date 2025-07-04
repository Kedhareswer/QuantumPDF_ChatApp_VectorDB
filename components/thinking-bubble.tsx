import React, { useState } from "react"
import { Brain, ChevronDown, ChevronRight, Clock, Sparkles, Zap } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface Reasoning {
  initialThoughts?: string
  criticalReview?: string
  finalRefinement?: string
}


interface ThinkingBubbleProps {
  reasoning: Reasoning
  responseTime?: number
}

export function ThinkingBubble({
  reasoning,
  responseTime,
}: ThinkingBubbleProps) {
  const [open, setOpen] = useState(false)

  const renderMetricBadges = () => (
    <div className="flex items-center space-x-2 flex-wrap">
      {responseTime !== undefined && (
        <Badge variant="outline" className="text-xs border-gray-300">
          <Clock className="w-3 h-3 mr-1" />
          {responseTime < 1000 ? `${responseTime}ms` : `${(responseTime / 1000).toFixed(1)}s`}
        </Badge>
      )}
    </div>
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 border border-purple-200 text-purple-800 text-sm font-semibold rounded-md hover:bg-purple-100 transition-colors"
          aria-expanded={open}
        >
          <span className="flex items-center space-x-2">
            <Brain className="w-4 h-4" />
            <span>AI Reasoning Process</span>
          </span>
          <span className="flex items-center space-x-2">
            {renderMetricBadges()}
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3 border border-purple-200 bg-purple-50/50">
          <CardContent className="p-4 space-y-4 text-sm leading-relaxed text-purple-900">
            {reasoning.initialThoughts && (
              <section>
                <h4 className="font-bold mb-1 flex items-center space-x-1">
                  <span>Initial Analysis</span>
                </h4>
                <p className="whitespace-pre-wrap">{reasoning.initialThoughts}</p>
              </section>
            )}
            {reasoning.criticalReview && (
              <section>
                <h4 className="font-bold mb-1 flex items-center space-x-1">
                  <span>Critical Review</span>
                </h4>
                <p className="whitespace-pre-wrap">{reasoning.criticalReview}</p>
              </section>
            )}
            {reasoning.finalRefinement && (
              <section>
                <h4 className="font-bold mb-1 flex items-center space-x-1">
                  <span>Final Enhancement</span>
                </h4>
                <p className="whitespace-pre-wrap">{reasoning.finalRefinement}</p>
              </section>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
} 
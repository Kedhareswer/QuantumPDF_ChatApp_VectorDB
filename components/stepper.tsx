"use client"

import { CheckCircle, Circle, XCircle } from "lucide-react"

interface StepperStep {
  key: string
  label: string
  status: "pending" | "in_progress" | "done" | "error"
}

interface StepperProps {
  steps: StepperStep[]
}

export function Stepper({ steps }: StepperProps) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.key} className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {step.status === "done" && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {step.status === "error" && (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            {step.status === "in_progress" && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {step.status === "pending" && (
              <Circle className="w-5 h-5 text-gray-300" />
            )}
          </div>
          <span className={`text-sm ${
            step.status === "done" ? "text-green-700" :
            step.status === "error" ? "text-red-700" :
            step.status === "in_progress" ? "text-blue-700" :
            "text-gray-500"
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}

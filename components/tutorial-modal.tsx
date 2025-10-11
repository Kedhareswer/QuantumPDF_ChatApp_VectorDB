"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import Image from "next/image"

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

const TUTORIAL_STEPS = [
  {
    title: "Step 1: Configure AI Provider",
    description: "Set up your AI provider credentials to enable document analysis and chat functionality.",
    gif: "/Step-1.gif",
  },
  {
    title: "Step 2: Upload Documents",
    description: "Upload your PDF documents to start analyzing and chatting with them.",
    gif: "/Step-2.gif",
  },
  {
    title: "Step 3: Chat with Documents",
    description: "Ask questions about your documents and get AI-powered answers with source citations.",
    gif: "/Step-3.gif",
  },
  {
    title: "Step 4: Advanced Features",
    description: "Explore advanced features like vector database configuration and system monitoring.",
    gif: "/Step-4.gif",
  },
]

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleFinish()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = () => {
    localStorage.setItem("quantum-pdf-tutorial-completed", "true")
    onClose()
  }

  const handleSkip = () => {
    localStorage.setItem("quantum-pdf-tutorial-completed", "true")
    onClose()
  }

  const currentStepData = TUTORIAL_STEPS[currentStep]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl border-2 border-black shadow-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              Welcome to Quantum PDF!
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-black"
                    : index < currentStep
                    ? "w-2 bg-black/50"
                    : "w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* Current step content */}
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">{currentStepData.title}</h3>
              <p className="text-gray-600">{currentStepData.description}</p>
            </div>

            {/* GIF display */}
            <div className="relative w-full aspect-video bg-gray-100 rounded-lg border-2 border-black overflow-hidden">
              <Image
                src={currentStepData.gif}
                alt={currentStepData.title}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Step counter */}
            <div className="text-center text-sm text-gray-500">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-black">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="border-2 border-black hover:bg-black hover:text-white disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-gray-600 hover:text-black hover:bg-gray-100"
            >
              Skip Tutorial
            </Button>

            <Button
              onClick={handleNext}
              className="bg-black text-white hover:bg-gray-800 border-2 border-black"
            >
              {currentStep === TUTORIAL_STEPS.length - 1 ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

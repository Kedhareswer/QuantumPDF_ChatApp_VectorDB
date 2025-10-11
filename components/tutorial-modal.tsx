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
      <DialogContent
        hideCloseButton
        className="max-w-[90vw] w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] sm:max-h-[90vh] border-2 border-black shadow-lg overflow-hidden flex flex-col p-3 sm:p-6"
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg md:text-xl font-bold pr-8">
            Welcome to Quantum PDF!
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 min-h-0">
          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2 py-2">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 sm:h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-6 sm:w-8 bg-black"
                    : index < currentStep
                    ? "w-1.5 sm:w-2 bg-black/50"
                    : "w-1.5 sm:w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* Current step content */}
          <div className="space-y-2 sm:space-y-3">
            <div className="text-center space-y-1 sm:space-y-2">
              <h3 className="text-sm sm:text-base md:text-lg font-bold px-2">{currentStepData.title}</h3>
              <p className="text-xs sm:text-sm text-gray-600 px-2">{currentStepData.description}</p>
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
            <div className="text-center text-xs sm:text-sm text-gray-500 py-1">
              Step {currentStep + 1} of {TUTORIAL_STEPS.length}
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 pt-3 sm:pt-4 border-t-2 border-black">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="w-full sm:w-auto border-2 border-black hover:bg-black hover:text-white disabled:opacity-50 text-xs sm:text-sm h-8 sm:h-10"
          >
            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Previous
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full sm:w-auto text-gray-600 hover:text-black hover:bg-gray-100 order-last sm:order-none text-xs sm:text-sm h-8 sm:h-10"
          >
            Skip Tutorial
          </Button>

          <Button
            onClick={handleNext}
            className="w-full sm:w-auto bg-black text-white hover:bg-gray-800 border-2 border-black text-xs sm:text-sm h-8 sm:h-10"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              "Get Started"
            ) : (
              <>
                Next
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

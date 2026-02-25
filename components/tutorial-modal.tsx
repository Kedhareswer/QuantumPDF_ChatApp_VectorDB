"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AIClient } from "@/lib/ai-client"
import { useAppStore } from "@/lib/store"
import { CheckCircle, ChevronRight, ExternalLink, Loader2 } from "lucide-react"
import { useState } from "react"

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

const PROVIDERS = [
  { id: "openai",    name: "OpenAI",    model: "gpt-4o-mini",              keyPrefix: "sk-",      docsUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic", model: "claude-3-5-haiku-20241022",keyPrefix: "sk-ant-",  docsUrl: "https://console.anthropic.com/" },
  { id: "googleai",  name: "Google AI", model: "gemini-2.5-flash",         keyPrefix: "AIza",     docsUrl: "https://aistudio.google.com/apikey" },
  { id: "groq",      name: "Groq",      model: "llama-3.3-70b-versatile",  keyPrefix: "gsk_",     docsUrl: "https://console.groq.com/keys" },
  { id: "deepseek",  name: "DeepSeek",  model: "deepseek-chat",            keyPrefix: "sk-",      docsUrl: "https://platform.deepseek.com/" },
  { id: "mistral",   name: "Mistral",   model: "mistral-small-latest",     keyPrefix: "...",      docsUrl: "https://console.mistral.ai/" },
] as const


type Step = "pick" | "key" | "done"

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const { setAIConfig } = useAppStore()

  const [step, setStep] = useState<Step>("pick")
  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[number] | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState("")

  const handleProviderSelect = (p: typeof PROVIDERS[number]) => {
    setSelectedProvider(p)
    setApiKey("")
    setTestError("")
    setStep("key")
  }

  const handleConnect = async () => {
    if (!selectedProvider || !apiKey.trim()) return
    setTesting(true)
    setTestError("")

    try {
      const config = {
        provider: selectedProvider.id as unknown,
        model: selectedProvider.model,
        apiKey: apiKey.trim(),
      }
      // Quick validation — generate a tiny embedding to confirm the key works
      const client = new AIClient(config)
      await client.generateEmbedding("test")
      setAIConfig(config)
      setStep("done")
    } catch (err: unknown) {
      const msg = err?.message || String(err)
      setTestError(
        msg.includes("401") || msg.includes("403") || msg.includes("invalid")
          ? "Invalid API key. Please check and try again."
          : "Connection failed. Check your key or network and retry."
      )
    } finally {
      setTesting(false)
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

  const reset = () => {
    setStep("pick")
    setSelectedProvider(null)
    setApiKey("")
    setTestError("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-2 border-black shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Welcome to QuantumPDF</DialogTitle>
        </DialogHeader>

        {/* Step 1 — Pick provider */}
        {step === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Choose your AI provider to get started. You only need one API key.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p)}
                  className="flex items-center justify-between rounded border-2 border-black px-3 py-2 text-sm font-medium hover:bg-black hover:text-white transition-colors text-left"
                >
                  {p.name}
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="w-full text-gray-500 hover:text-black"
            >
              Skip - I&apos;ll configure later in Settings
            </Button>
          </div>
        )}

        {/* Step 2 — Enter API key */}
        {step === "key" && selectedProvider && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={reset} className="text-xs text-gray-500 hover:text-black underline">
                ← Back
              </button>
              <span className="text-sm font-semibold">{selectedProvider.name}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                placeholder={`${selectedProvider.keyPrefix}...`}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestError("") }}
                className="border-2 border-black font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                autoFocus
              />
              {testError && (
                <p className="text-xs text-red-600">{testError}</p>
              )}
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-black"
              >
                Get your {selectedProvider.name} API key
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <Button
              type="button"
              onClick={handleConnect}
              disabled={!apiKey.trim() || testing}
              className="w-full bg-black text-white hover:bg-gray-800 border-2 border-black"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing connection…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        )}

        {/* Step 3 — Success */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <div>
              <p className="font-semibold">Connected to {selectedProvider?.name}!</p>
              <p className="text-sm text-gray-600 mt-1">
                Upload a document and start asking questions.
              </p>
            </div>
            <Button
              onClick={handleFinish}
              className="w-full bg-black text-white hover:bg-gray-800 border-2 border-black"
            >
              Get Started
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { LoadingScreen } from "@/components/loading-screen"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { Toaster } from "@/components/ui/toaster"
import { useState } from "react"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [showLoading, setShowLoading] = useState(true)

  return (
    <>
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      {showLoading && (
        <LoadingScreen onComplete={() => setShowLoading(false)} />
      )}
      <div className={showLoading ? "opacity-0" : "opacity-100 transition-opacity duration-500"}>
        {children}
      </div>
      {/* useToast() had 19 live call sites but nothing ever rendered them, so
          document-library and quick-actions feedback was silently dropped. */}
      <Toaster />
    </>
  )
}

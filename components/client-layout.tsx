"use client"

import { LoadingScreen } from "@/components/loading-screen"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
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
    </>
  )
}

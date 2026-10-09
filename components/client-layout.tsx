"use client"

import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { Toaster } from "@/components/ui/toaster"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      {children}
      {/* useToast() had 19 live call sites but nothing ever rendered them, so
          document-library and quick-actions feedback was silently dropped. */}
      <Toaster />
    </>
  )
}

"use client"

import React, { Suspense, lazy } from 'react'
import { useDeviceDetection } from '@/hooks/use-device-detection'
import { LoadingIndicator } from '@/components/loading-indicator'

// Generic component router interface
interface ComponentRouterProps {
  desktopComponent: React.ComponentType<any>
  mobileComponent: React.ComponentType<any>
  fallbackComponent?: React.ComponentType<any>
  props?: any
  loadingComponent?: React.ComponentType
}

// Main device router component
export function DeviceRouter({
  desktopComponent: DesktopComponent,
  mobileComponent: MobileComponent,
  fallbackComponent: FallbackComponent,
  props = {},
  loadingComponent: LoadingComponent = LoadingIndicator,
}: ComponentRouterProps) {
  const { isMobile, isTablet } = useDeviceDetection()

  // Use mobile component for mobile devices, tablet uses mobile for now
  // Can be extended to have separate tablet components later
  const ComponentToRender = (isMobile || isTablet) ? MobileComponent : DesktopComponent

  return (
    <Suspense fallback={<LoadingComponent />}>
      <ComponentToRender {...props} />
    </Suspense>
  )
}

// Specific component routers for major components
interface ChatInterfaceRouterProps {
  messages: any[]
  onSendMessage: (content: string, options?: any) => void
  onClearChat: () => void
  onNewSession: () => void
  isProcessing: boolean
  disabled: boolean
  ragEngine?: any
}

export function ChatInterfaceRouter(props: ChatInterfaceRouterProps) {
  // Lazy load components to avoid loading both on initial render
  const DesktopChatInterface = lazy(() => import('@/components/chat-interface').then(module => ({ default: module.ChatInterface })))
  const MobileChatInterface = lazy(() => import('@/components/mobile/chat-interface').then(module => ({ default: module.ChatInterface })))

  return (
    <DeviceRouter
      desktopComponent={DesktopChatInterface}
      mobileComponent={MobileChatInterface}
      props={props}
    />
  )
}

interface APIConfigurationRouterProps {
  onConfigurationChange?: (config: any) => void
  initialConfig?: any
}

export function APIConfigurationRouter(props: APIConfigurationRouterProps) {
  const DesktopAPIConfiguration = lazy(() => import('@/components/enhanced-api-configuration').then(module => ({ default: module.EnhancedAPIConfiguration })))
  const MobileAPIConfiguration = lazy(() => import('@/components/mobile/enhanced-api-configuration').then(module => ({ default: module.EnhancedAPIConfiguration })))

  return (
    <DeviceRouter
      desktopComponent={DesktopAPIConfiguration}
      mobileComponent={MobileAPIConfiguration}
      props={props}
    />
  )
}

interface DocumentLibraryRouterProps {
  documents: any[]
  onRemoveDocument: (documentId: string) => void
  isLoading?: boolean
}

export function DocumentLibraryRouter(props: DocumentLibraryRouterProps) {
  const DesktopDocumentLibrary = lazy(() => import('@/components/document-library').then(module => ({ default: module.DocumentLibrary })))
  const MobileDocumentLibrary = lazy(() => import('@/components/mobile/document-library').then(module => ({ default: module.DocumentLibrary })))

  return (
    <DeviceRouter
      desktopComponent={DesktopDocumentLibrary}
      mobileComponent={MobileDocumentLibrary}
      props={props}
    />
  )
}

interface UnifiedConfigurationRouterProps {
  onTestAI: (config: any) => Promise<boolean>
  onTestVectorDB: (config: any) => Promise<boolean>
  onTestWandb: (config: any) => Promise<boolean>
}

export function UnifiedConfigurationRouter(props: UnifiedConfigurationRouterProps) {
  const DesktopUnifiedConfiguration = lazy(() => import('@/components/unified-configuration').then(module => ({ default: module.UnifiedConfiguration })))
  const MobileUnifiedConfiguration = lazy(() => import('@/components/mobile/unified-configuration').then(module => ({ default: module.UnifiedConfiguration })))

  return (
    <DeviceRouter
      desktopComponent={DesktopUnifiedConfiguration}
      mobileComponent={MobileUnifiedConfiguration}
      props={props}
    />
  )
}

// Utility function to create custom component routers
export function createComponentRouter<T extends object>(
  desktopImportPath: string,
  mobileImportPath: string,
  exportName = 'default'
) {
  return function ComponentRouter(props: T) {
    const DesktopComponent = lazy(() => 
      import(desktopImportPath).then(module => ({ 
        default: exportName === 'default' ? module.default : module[exportName] 
      }))
    )
    const MobileComponent = lazy(() => 
      import(mobileImportPath).then(module => ({ 
        default: exportName === 'default' ? module.default : module[exportName] 
      }))
    )

    return (
      <DeviceRouter
        desktopComponent={DesktopComponent}
        mobileComponent={MobileComponent}
        props={props}
      />
    )
  }
}

// Debug component to show current device detection
export function DeviceDebugInfo() {
  const deviceInfo = useDeviceDetection()
  
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 text-xs rounded z-50 opacity-75">
      <div>Device: {deviceInfo.type}</div>
      <div>Size: {deviceInfo.screenWidth}x{deviceInfo.screenHeight}</div>
      <div>Touch: {deviceInfo.isTouchDevice ? 'Yes' : 'No'}</div>
      <div>Portrait: {deviceInfo.isPortrait ? 'Yes' : 'No'}</div>
    </div>
  )
} 
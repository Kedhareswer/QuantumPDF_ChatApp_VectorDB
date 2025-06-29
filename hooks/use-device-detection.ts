"use client"

import { useState, useEffect } from 'react'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

interface DeviceInfo {
  type: DeviceType
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
  screenHeight: number
  isTouchDevice: boolean
  isPortrait: boolean
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 1024,
    screenHeight: 768,
    isTouchDevice: false,
    isPortrait: false,
  })

  useEffect(() => {
    const detectDevice = () => {
      if (typeof window === 'undefined') return

      const width = window.innerWidth
      const height = window.innerHeight
      const isPortrait = height > width
      
      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0 || 
                           (navigator as any).msMaxTouchPoints > 0

      // User agent based detection (fallback)
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent)

      // Screen size based detection (primary)
      let type: DeviceType = 'desktop'
      
      if (width <= 768) {
        // Mobile: 0-768px
        type = 'mobile'
      } else if (width <= 1024) {
        // Tablet: 769-1024px, but also check for touch and user agent
        type = (isTouchDevice || isTabletUA) ? 'tablet' : 'desktop'
      } else {
        // Desktop: 1025px+, but mobile devices in landscape might be wider
        type = (isMobileUA && isTouchDevice) ? 'tablet' : 'desktop'
      }

      const newDeviceInfo: DeviceInfo = {
        type,
        isMobile: type === 'mobile',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        screenWidth: width,
        screenHeight: height,
        isTouchDevice,
        isPortrait,
      }

      setDeviceInfo(newDeviceInfo)
    }

    // Initial detection
    detectDevice()

    // Listen for resize events
    window.addEventListener('resize', detectDevice)
    window.addEventListener('orientationchange', detectDevice)

    // Cleanup
    return () => {
      window.removeEventListener('resize', detectDevice)
      window.removeEventListener('orientationchange', detectDevice)
    }
  }, [])

  return deviceInfo
}

// Utility hook for simple mobile detection
export function useIsMobile(): boolean {
  const { isMobile } = useDeviceDetection()
  return isMobile
}

// Utility hook for responsive breakpoints
export function useResponsiveBreakpoint() {
  const { screenWidth } = useDeviceDetection()
  
  return {
    isSm: screenWidth >= 640,   // sm: 640px
    isMd: screenWidth >= 768,   // md: 768px  
    isLg: screenWidth >= 1024,  // lg: 1024px
    isXl: screenWidth >= 1280,  // xl: 1280px
    is2Xl: screenWidth >= 1536, // 2xl: 1536px
  }
} 
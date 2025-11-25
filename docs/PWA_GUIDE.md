# QuantumPDF PWA Guide

> **Complete guide to Progressive Web App implementation and capabilities**
> **Last Updated: November 2025 | Version 3.0.0**

---

## Table of Contents

1. [Overview](#overview)
2. [PWA Features](#pwa-features)
3. [Installation](#installation)
4. [Offline Capabilities](#offline-capabilities)
5. [Service Worker](#service-worker)
6. [Caching Strategies](#caching-strategies)
7. [App Manifest](#app-manifest)
8. [Testing](#testing)

---

## Overview

QuantumPDF is a fully-functional Progressive Web App that can be installed on desktop and mobile devices, providing a native-like experience with offline capabilities.

### PWA Score

| Criterion | Status | Details |
|-----------|--------|---------|
| Installable | ✅ | Full manifest with icons |
| Offline Support | ⚠️ Partial | Core UI cached, API requires network |
| Fast Loading | ✅ | Optimized bundle, lazy loading |
| HTTPS | ✅ | Required for deployment |
| Responsive | ✅ | Mobile-first design |
| App-like Feel | ✅ | Standalone display mode |

---

## PWA Features

### Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| App Installation | ✅ | Install on desktop/mobile |
| Home Screen | ✅ | Launch from home screen |
| Standalone Mode | ✅ | Full-screen app experience |
| Splash Screen | ✅ | Custom loading screen |
| Offline Shell | ✅ | UI available offline |
| Service Worker | ✅ | Background caching |
| Push Notifications | 🔄 Planned | Future enhancement |
| Background Sync | 🔄 Planned | Future enhancement |

### Platform Support

| Platform | Install | Offline | Performance |
|----------|---------|---------|-------------|
| Chrome (Desktop) | ✅ | ✅ | Excellent |
| Chrome (Android) | ✅ | ✅ | Excellent |
| Edge | ✅ | ✅ | Excellent |
| Safari (iOS) | ✅ | ⚠️ Limited | Good |
| Safari (macOS) | ⚠️ Limited | ⚠️ Limited | Good |
| Firefox | ⚠️ Limited | ✅ | Good |

---

## Installation

### Desktop (Chrome/Edge)

1. Visit the app URL
2. Look for the install icon in the address bar
3. Click "Install" when prompted
4. App appears in applications/start menu

### Mobile (Android)

1. Visit the app URL in Chrome
2. Tap the "Add to Home Screen" banner
3. Or tap menu (⋮) → "Install App"
4. App icon appears on home screen

### Mobile (iOS)

1. Visit the app URL in Safari
2. Tap Share button (□↑)
3. Tap "Add to Home Screen"
4. Name the app and tap "Add"

### Programmatic Install Prompt

```typescript
// components/pwa-install-prompt.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('PWA installed')
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <Button onClick={handleInstall} variant="outline" size="sm">
      <Download className="w-4 h-4 mr-2" />
      Install App
    </Button>
  )
}
```

---

## Offline Capabilities

### What Works Offline

| Feature | Offline | Notes |
|---------|---------|-------|
| App Shell (UI) | ✅ | Fully cached |
| Static Assets | ✅ | CSS, JS, images |
| Previously Loaded Docs | ✅ | Cached in IndexedDB |
| New Document Upload | ❌ | Requires AI API |
| Chat/Query | ❌ | Requires AI API |
| Vector Search | ⚠️ | Local only if using in-memory |

### Offline Detection

```typescript
// hooks/use-online-status.ts
import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Usage
function App() {
  const isOnline = useOnlineStatus()
  
  return (
    <div>
      {!isOnline && (
        <Banner variant="warning">
          You're offline. Some features may be limited.
        </Banner>
      )}
    </div>
  )
}
```

---

## Service Worker

### Registration

```typescript
// components/service-worker-registration.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope)
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  // New content available
                  showUpdateNotification()
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('SW registration failed:', error)
        })
    }
  }, [])

  return null
}
```

### Service Worker Implementation

```javascript
// public/sw.js
const CACHE_NAME = 'quantumpdf-v3.0.0'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API requests (need fresh data)
  if (url.pathname.startsWith('/api/')) return

  // Network first for HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/'))
    )
    return
  }

  // Cache first for static assets
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request))
    )
    return
  }

  // Network first, cache fallback for others
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
```

---

## Caching Strategies

### Strategy Overview

| Resource Type | Strategy | Reason |
|---------------|----------|--------|
| App Shell | Cache First | Fast loading, rarely changes |
| Static Assets | Cache First | Images, fonts, CSS |
| HTML Pages | Network First | Fresh content preferred |
| API Responses | Network Only | Requires fresh data |
| Documents | IndexedDB | Large files, structured storage |

### next-pwa Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        }
      }
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 1 week
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    }
  ]
})

module.exports = withPWA({
  // Next.js config
})
```

---

## App Manifest

### manifest.json

```json
{
  "name": "QuantumPDF - AI Document Analysis",
  "short_name": "QuantumPDF",
  "description": "AI-powered document analysis with RAG, multimodal extraction, and specialized agents",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["productivity", "utilities"],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "shortcuts": [
    {
      "name": "New Chat",
      "short_name": "Chat",
      "url": "/?action=chat",
      "icons": [{ "src": "/icons/chat-icon.png", "sizes": "96x96" }]
    },
    {
      "name": "Upload Document",
      "short_name": "Upload",
      "url": "/?action=upload",
      "icons": [{ "src": "/icons/upload-icon.png", "sizes": "96x96" }]
    }
  ],
  "related_applications": [],
  "prefer_related_applications": false
}
```

### Metadata in Layout

```typescript
// app/layout.tsx
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'QuantumPDF - AI Document Analysis',
  description: 'AI-powered document analysis with RAG, multimodal extraction, and specialized agents',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuantumPDF'
  },
  formatDetection: {
    telephone: false
  }
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
}
```

---

## Testing

### Lighthouse PWA Audit

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run PWA audit
lighthouse http://localhost:3000 --only-categories=pwa --view

# Generate JSON report
lighthouse http://localhost:3000 --output=json --output-path=./pwa-report.json
```

### Manual Testing Checklist

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Installation | Click install button | App installs successfully |
| Offline Load | Disable network, reload | App shell loads |
| Update Detection | Deploy new version | Update notification shown |
| Home Screen | Add to home screen | App icon appears |
| Standalone Mode | Launch from icon | No browser UI |
| Theme Color | Launch app | Status bar matches theme |

### Automated Testing

```typescript
// __tests__/pwa.test.ts
describe('PWA', () => {
  it('should have valid manifest', async () => {
    const response = await fetch('/manifest.json')
    const manifest = await response.json()
    
    expect(manifest.name).toBeDefined()
    expect(manifest.short_name).toBeDefined()
    expect(manifest.icons).toHaveLength(8)
    expect(manifest.display).toBe('standalone')
  })
  
  it('should register service worker', async () => {
    const registration = await navigator.serviceWorker.ready
    expect(registration.active).toBeTruthy()
  })
  
  it('should cache static assets', async () => {
    const cache = await caches.open('quantumpdf-v3.0.0')
    const keys = await cache.keys()
    
    expect(keys.length).toBeGreaterThan(0)
  })
})
```

### Browser DevTools

1. **Chrome DevTools**
   - Application → Manifest (verify manifest)
   - Application → Service Workers (verify registration)
   - Application → Cache Storage (verify caching)
   - Lighthouse → Generate Report → PWA

2. **Edge DevTools**
   - Same as Chrome (Chromium-based)

3. **Firefox DevTools**
   - Storage → Cache Storage
   - Application → Manifest

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Install button not showing | HTTPS required | Deploy to HTTPS |
| Offline not working | SW not registered | Check console for errors |
| Old version cached | SW not updated | Clear cache, hard refresh |
| iOS PWA issues | Safari limitations | Use meta tags |

### Debug Commands

```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log(regs))

// Clear all caches
caches.keys().then(keys => 
  keys.forEach(key => caches.delete(key))
)

// Force update service worker
navigator.serviceWorker.ready
  .then(reg => reg.update())
```

---

**Generated**: November 2025  
**Project**: QuantumPDF ChatApp v3.0.0

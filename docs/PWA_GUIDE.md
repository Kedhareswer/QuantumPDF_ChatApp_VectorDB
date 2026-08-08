# QuantumPDF PWA Guide

> **Complete guide to Progressive Web App implementation and capabilities**
> **Last updated: August 2026**

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

The live component is `components/pwa-install-prompt.tsx`. It captures the
`beforeinstallprompt` event, renders a dismissible install card, hides itself
once the app is installed (`appinstalled` / `display-mode: standalone`), and
suppresses re-prompting for 7 days after a dismissal (persisted in
`localStorage` under `pwa-prompt-dismissed`). Logging goes through
`lib/logger.ts` (`logger.debug`), not `console.log`.

```typescript
// components/pwa-install-prompt.tsx (condensed)
'use client'

import { logger } from '@/lib/logger'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'pwa-prompt-dismissed'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    logger.debug(`User ${outcome} the install prompt`)
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (!showInstallPrompt) return null

  // Renders a styled install/dismiss card (see source for full JSX).
  return (/* ... */ null)
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

> **Reference snippet** — this repo does not currently ship a dedicated
> `use-online-status` hook; the pattern below shows how online/offline state
> can be tracked if you add one.

```typescript
// Reference pattern (not a file in this repo)
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

> The live `components/service-worker-registration.tsx` registers the worker
> **only in production** (`process.env.NODE_ENV === 'production'`), logs via
> `lib/logger.ts` (`logger.debug`), re-checks for updates hourly, and prompts the
> user to reload when a new worker is installed (posting `SKIP_WAITING`). The
> condensed snippet below omits the production gate for clarity.

```typescript
// components/service-worker-registration.tsx (condensed)
'use client'

import { logger } from '@/lib/logger'
import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          logger.debug('Service Worker registered:', registration)

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

> The snippet below is a simplified illustration of the caching strategies. The
> live worker at `public/sw.js` uses `CACHE_VERSION = 'v0.1.0'` (matching the
> `package.json` version), separate install-time precache and runtime caches,
> cache-first for static assets (icons, screenshots, JS/CSS/fonts), network-first
> for `/api/`, `/huggingface/`, and `/vector-db/`, stale-while-revalidate for
> HTML, and an `/offline.html` fallback.

```javascript
// public/sw.js (simplified illustration)
const CACHE_NAME = 'quantumpdf-v0.1.0'
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png'
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

### Runtime Caching Reference

> **Note:** QuantumPDF does **not** use the `next-pwa` package. The service worker is hand-written and lives at `public/sw.js`, and the build config is `next.config.mjs` (Next.js 16 / Turbopack). The snippet below is a reference for the runtime-caching intent; the equivalent live logic is implemented directly in `public/sw.js`.

```javascript
// Reference only — not used in this repo (no next-pwa dependency)
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

The manifest is **not** a static `public/manifest.webmanifest` file — it is generated
by the Next.js metadata route `app/manifest.ts` (typed as
`MetadataRoute.Manifest`) and served at `/manifest.webmanifest`. The generated
output looks like this:

```typescript
// app/manifest.ts (abridged)
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QuantumPDF ChatApp - AI-Powered PDF Analysis',
    short_name: 'QuantumPDF',
    description:
      'Chat with your documents using AI. Ask questions, get instant answers with citations. Supports PDFs, Word docs, Excel files. Free document analysis with GPT-4, Claude, and 19+ AI models.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    scope: '/',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['productivity', 'business', 'education', 'utilities'],
    display_override: ['window-controls-overlay', 'standalone', 'fullscreen'],
    screenshots: [
      { src: '/screenshot-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'QuantumPDF ChatApp Desktop View' },
      { src: '/screenshot-narrow.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow', label: 'QuantumPDF ChatApp Mobile View' }
    ],
    icons: [
      { src: '/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: '/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
    ],
    shortcuts: [
      { name: 'Upload PDF', short_name: 'Upload', description: 'Upload a new PDF document for analysis', url: '/?action=upload', icons: [{ src: '/upload-icon.png', sizes: '96x96' }] },
      { name: 'New Chat', short_name: 'Chat', description: 'Start a new conversation with your documents', url: '/?action=chat', icons: [{ src: '/chat-icon.png', sizes: '96x96' }] }
    ],
    related_applications: [],
    prefer_related_applications: false
  }
}
```

> Dedicated maskable icons (`/icon-192-maskable.png`, `/icon-512-maskable.png`)
> are separate entries with `purpose: 'maskable'`; the regular icons use
> `purpose: 'any'`. Icon files live at the public root (e.g. `/icon-192.png`),
> **not** under `/icons/`.

### Metadata in Layout

```typescript
// app/layout.tsx (abridged)
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://quantumpdf-chatapp.vercel.app'),
  title: {
    default: 'QuantumPDF ChatApp - AI-Powered PDF Analysis & Document Intelligence',
    template: '%s | QuantumPDF ChatApp'
  },
  description:
    'Chat with your documents using AI. Ask questions, get instant answers with citations. Supports PDFs, Word docs, Excel files. Free document analysis tool with GPT-4, Claude, and 19+ AI models.',
  applicationName: 'QuantumPDF ChatApp',
  formatDetection: { email: false, address: false, telephone: false }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
}
```

> Next.js auto-injects the `<link rel="manifest">` from `app/manifest.ts`, so
> `metadata.manifest` is not set explicitly. `themeColor` is a media-query array
> (light `#ffffff` / dark `#000000`), not the single `#6366f1` value some older
> docs referenced.

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

> The Next.js metadata route serves the manifest at `/manifest.webmanifest`
> (not `/manifest.webmanifest`), the install-time cache is named `quantumpdf-v0.1.0`,
> and `app/manifest.ts` declares 13 icon entries.

```typescript
// __tests__/pwa.test.ts (illustrative)
describe('PWA', () => {
  it('should have valid manifest', async () => {
    const response = await fetch('/manifest.webmanifest')
    const manifest = await response.json()

    expect(manifest.name).toBeDefined()
    expect(manifest.short_name).toBeDefined()
    expect(manifest.icons.length).toBeGreaterThan(0)
    expect(manifest.display).toBe('standalone')
  })

  it('should register service worker', async () => {
    const registration = await navigator.serviceWorker.ready
    expect(registration.active).toBeTruthy()
  })

  it('should cache static assets', async () => {
    const cache = await caches.open('quantumpdf-v0.1.0')
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

**Generated**: June 2026  
**Project**: QuantumPDF ChatApp v0.1.0

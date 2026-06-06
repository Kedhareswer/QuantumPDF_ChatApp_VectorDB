# QuantumPDF PWA

> **Progressive Web App capabilities for QuantumPDF**
> **Last Updated: June 2026**

---

## Overview

QuantumPDF is a fully installable Progressive Web App (PWA) that provides a native-like experience for AI-powered document analysis.

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| ✅ Installable | Complete | Install on desktop/mobile |
| ✅ Offline Shell | Complete | UI available offline |
| ✅ Responsive | Complete | Mobile-first design |
| ✅ Fast Loading | Complete | Optimized bundle |
| ⚠️ Offline Data | Partial | Cached documents work |
| 🔄 Push Notifications | Planned | Future enhancement |

## Quick Install

### Desktop (Chrome/Edge)
1. Visit app URL
2. Click install icon (⊕) in address bar
3. Click "Install"

### Mobile (Android)
1. Open in Chrome
2. Tap "Add to Home Screen" banner
3. Or: Menu → Install App

### Mobile (iOS)
1. Open in Safari
2. Tap Share (□↑)
3. Tap "Add to Home Screen"

## Documentation

- [Full PWA Guide](docs/PWA_GUIDE.md)
- [Implementation Details](docs/PWA_IMPLEMENTATION_SUMMARY.md)
- [Testing Guide](docs/PWA_TESTING_GUIDE.md)

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **PWA Library**: None — custom service worker registered by `components/service-worker-registration.tsx`
- **Service Worker**: Custom (`public/sw.js`, hand-written cache strategies)
- **Storage**: Cache API + IndexedDB

## Browser Support

| Browser | Install | Offline |
|---------|---------|---------|
| Chrome 80+ | ✅ | ✅ |
| Edge 80+ | ✅ | ✅ |
| Firefox 67+ | ⚠️ | ✅ |
| Safari 14+ | ⚠️ | ⚠️ |

## Configuration

### Manifest Location
```
app/manifest.ts
```
(Next.js `MetadataRoute.Manifest` route — served at `/manifest.webmanifest`)

### Service Worker
```
public/sw.js
```

### Key Components
```
components/
├── pwa-install-prompt.tsx
└── service-worker-registration.tsx
```

## Development

```bash
# PWA disabled in development by default
npm run dev

# Build with PWA enabled
npm run build
npm start
```

## Testing

```bash
# Run Lighthouse PWA audit
npx lighthouse http://localhost:3000 --only-categories=pwa

# Open DevTools → Application for manual testing
```

---

For complete documentation, see [docs/PWA_GUIDE.md](docs/PWA_GUIDE.md)

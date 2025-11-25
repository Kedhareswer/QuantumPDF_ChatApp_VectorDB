# QuantumPDF PWA

> **Progressive Web App capabilities for QuantumPDF**
> **Last Updated: November 2025 | Version 3.0.0**

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

- **Framework**: Next.js 15
- **PWA Library**: next-pwa
- **Service Worker**: Custom + Workbox
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
app/manifest.json
```

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

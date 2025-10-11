# Progressive Web App (PWA) Guide

## Overview

QuantumPDF ChatApp is now a fully-featured **Progressive Web App (PWA)**, allowing users to install it on their mobile devices and use it like a native app with offline capabilities.

## What is a PWA?

A Progressive Web App is a web application that uses modern web capabilities to provide a user experience similar to native apps. Key benefits include:

- **Installable**: Add to home screen on mobile devices
- **Offline Support**: Works without internet connection
- **Fast Loading**: Cached resources load instantly
- **Native Feel**: Full-screen experience without browser UI
- **Auto-Updates**: Always get the latest version
- **Responsive**: Works on any device size

## Features

### 🚀 Installation

Users can install QuantumPDF ChatApp on their devices:

- **Android**: Chrome will prompt to "Add to Home Screen"
- **iOS**: Safari > Share > "Add to Home Screen"
- **Desktop**: Chrome/Edge will show an install button in the address bar

### 📡 Offline Functionality

The app continues to work offline with the following capabilities:

- View previously loaded documents
- Browse chat history
- Access cached PDF files
- Review previous analysis results

When offline, users see a friendly offline page with available features.

### 🔄 Automatic Updates

The service worker checks for updates hourly and prompts users when a new version is available.

### 💾 Intelligent Caching

Three caching strategies are employed:

1. **Cache-First**: Static assets (JS, CSS, fonts) for instant loading
2. **Network-First**: API calls for fresh data
3. **Stale-While-Revalidate**: HTML pages for best balance

## Implementation Details

### Files Structure

```
public/
├── sw.js                    # Service worker for offline support
├── offline.html             # Offline fallback page
├── browserconfig.xml        # Microsoft PWA configuration
├── manifest.json            # PWA manifest (auto-generated)
├── icon-*.png              # PWA icons (multiple sizes)
└── favicon-*.png           # Favicon icons

app/
├── manifest.ts             # Manifest configuration
└── layout.tsx              # PWA meta tags

components/
├── service-worker-registration.tsx  # SW registration logic
├── pwa-install-prompt.tsx          # Install prompt UI
└── client-layout.tsx               # Main layout with PWA components
```

### Manifest Configuration

The PWA manifest (`app/manifest.ts`) includes:

- App name and short name
- Description
- Theme colors
- Display mode (standalone)
- Icons in multiple sizes (72, 96, 128, 144, 152, 192, 384, 512)
- Shortcuts for quick actions
- Categories and orientation

### Service Worker

The service worker (`public/sw.js`) provides:

- **Offline Support**: Caches essential resources
- **Background Sync**: Syncs data when connection restored
- **Push Notifications**: (Optional) Notify users of updates
- **Cache Management**: Automatic cleanup of old caches

### Installation Prompt

A custom install prompt (`components/pwa-install-prompt.tsx`) appears when:

- The app meets PWA criteria
- User hasn't dismissed it recently (7 days)
- App is not already installed

## Icons

### Required Sizes

PWA icons are available in the following sizes:

| Size | Purpose |
|------|---------|
| 72x72 | Small tile |
| 96x96 | Shortcuts |
| 128x128 | Standard |
| 144x144 | MS Tile |
| 152x152 | iOS |
| 192x192 | Standard PWA |
| 384x384 | Large |
| 512x512 | Splash screen |

### Maskable Icons

Maskable icons (192x192 and 512x512) ensure the icon looks good on all Android devices with different shapes.

### Generating Icons

To create your own icons:

```bash
# 1. Place your logo.png (minimum 512x512) in the public folder
# 2. Install sharp for image processing
npm install --save-dev sharp

# 3. Generate all icon sizes
node scripts/generate-pwa-icons.js
```

Or use the simple SVG generator:

```bash
node scripts/create-pwa-icons.js
```

Then convert the generated SVGs to PNGs using an online tool like [Convertio](https://convertio.co/svg-png/).

## Testing PWA Features

### Development

PWA features (especially service workers) are disabled in development mode. To test:

```bash
# 1. Build the production version
npm run build

# 2. Start production server
npm start

# 3. Open in browser
# Chrome: http://localhost:3000
```

### Production

Deploy to a hosting service with HTTPS:

- Vercel (recommended)
- Netlify
- AWS Amplify
- Google Cloud Platform

**Note**: PWAs require HTTPS to work (except on localhost).

### Testing Checklist

- [ ] App installs on mobile
- [ ] Offline page displays when disconnected
- [ ] Install prompt appears
- [ ] App works in standalone mode
- [ ] Service worker registers successfully
- [ ] Updates are detected and applied
- [ ] Icons display correctly

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Install | ✅ | ✅ | ✅* | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Offline | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ⚠️ | ✅ |

*Safari has limited install support on iOS

## Configuration

### Customize Manifest

Edit `app/manifest.ts` to customize:

- App name and description
- Theme colors
- App categories
- Shortcuts
- Screenshots

### Customize Service Worker

Edit `public/sw.js` to:

- Change cache version
- Add/remove cached resources
- Modify caching strategies
- Add custom sync logic

### Customize Install Prompt

Edit `components/pwa-install-prompt.tsx` to:

- Change prompt design
- Modify timing/frequency
- Add custom messages

## Advanced Features

### Background Sync

The service worker supports background sync for offline actions:

```typescript
// Trigger a sync when online
if ('sync' in registration) {
  registration.sync.register('sync-documents')
}
```

### Push Notifications (Optional)

Enable push notifications by:

1. Setting up a push service (Firebase, OneSignal)
2. Requesting permission from users
3. Handling push events in service worker

### Shortcuts

App shortcuts appear in the install menu:

- **Upload PDF**: Quick access to document upload
- **New Chat**: Start a new conversation

Edit shortcuts in `app/manifest.ts`.

## Performance

### Metrics

- **First Load**: ~2-3s (uncached)
- **Subsequent Loads**: <500ms (cached)
- **Offline Load**: <200ms (fully cached)

### Optimization

- Assets are cached on first visit
- Critical resources are precached
- Non-critical resources load on demand
- Cache is automatically cleaned

## Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Ensure HTTPS is enabled (or using localhost)
3. Verify `sw.js` is in the `public` folder
4. Clear browser cache and retry

### Install Prompt Not Showing

1. Check PWA criteria in Chrome DevTools (Application > Manifest)
2. Ensure all required icons are present
3. Verify manifest.json is valid
4. Check if prompt was recently dismissed

### Offline Page Not Displaying

1. Verify `offline.html` is in `public` folder
2. Check service worker cache configuration
3. Test with Chrome DevTools offline mode

### Icons Not Displaying

1. Ensure all icon files exist in `public` folder
2. Check file names match manifest.ts
3. Verify icon sizes are correct
4. Clear cache and reload

## Best Practices

### Do's

- ✅ Test on real devices
- ✅ Provide meaningful offline experience
- ✅ Keep service worker cache small
- ✅ Update cache version when deploying
- ✅ Handle errors gracefully

### Don'ts

- ❌ Cache sensitive user data
- ❌ Make offline experience identical to online
- ❌ Cache large media files unnecessarily
- ❌ Ignore service worker errors
- ❌ Cache API responses indefinitely

## Debugging

### Chrome DevTools

1. **Application Tab**
   - View manifest
   - Inspect service worker
   - Check cache storage
   - Simulate offline mode

2. **Lighthouse**
   - Run PWA audit
   - Check performance
   - View recommendations

3. **Network Tab**
   - Monitor cache hits
   - Check service worker responses

### Console Commands

```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistrations()

// Unregister service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => r.unregister())
})

// Clear all caches
caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
```

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Support

For PWA-related issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review browser console errors
3. Test in Chrome DevTools
4. File an issue on GitHub

## Future Enhancements

Planned PWA features:

- [ ] Share Target API (share PDFs to app)
- [ ] File Handling API (open PDFs with app)
- [ ] Periodic Background Sync
- [ ] Advanced caching strategies
- [ ] Web Push notifications
- [ ] Badge API for unread counts

---

**Last Updated**: 2025-10-11

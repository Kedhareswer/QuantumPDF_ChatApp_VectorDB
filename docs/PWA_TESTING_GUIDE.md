# PWA Testing Guide

## Quick Start Testing

Follow these steps to test the PWA functionality:

### Step 1: Build for Production

PWA features only work in production mode due to service worker requirements.

```bash
# Navigate to project directory
cd QuantumPDF_ChatApp_VectorDB

# Build the production version
pnpm build

# Start the production server
pnpm start
```

The app should now be running at `http://localhost:3000`

### Step 2: Test in Chrome DevTools

1. Open Chrome and navigate to `http://localhost:3000`
2. Open DevTools (F12 or Right-click → Inspect)
3. Go to the **Application** tab

#### Check Manifest
- **Manifest** section (left sidebar)
- Verify all fields are correct:
  - ✅ Name: "QuantumPDF ChatApp - AI-Powered PDF Analysis"
  - ✅ Short name: "QuantumPDF"
  - ✅ Start URL: "/"
  - ✅ Display: "standalone"
  - ✅ Icons: All sizes present

#### Check Service Worker
- **Service Workers** section (left sidebar)
- Verify service worker is registered:
  - ✅ Status: "activated and is running"
  - ✅ Source: sw.js
  - Click "Update" to test updates
  - Click "Unregister" to test fresh installation

#### Check Cache Storage
- **Cache Storage** section (left sidebar)
- Verify caches exist:
  - ✅ `quantumpdf-v1.0.0` (main cache)
  - ✅ Cached files: /, offline.html, icons, etc.

### Step 3: Test Install Prompt

#### Desktop (Chrome/Edge)

1. Look for the install icon (➕) in the address bar
2. Click it to see the install dialog
3. Click "Install"
4. App should open in a standalone window
5. Check Start Menu/Applications for app icon

**Alternative method:**
- Click the three-dot menu (⋮)
- Look for "Install QuantumPDF ChatApp"

#### Mobile Simulation (Chrome DevTools)

1. Toggle device toolbar (Ctrl+Shift+M)
2. Select a mobile device (e.g., iPhone 12 Pro)
3. Refresh the page
4. Look for install banner at bottom
5. Test install flow

### Step 4: Test Offline Functionality

#### Method 1: Chrome DevTools

1. Go to **Application** → **Service Workers**
2. Check "Offline" checkbox
3. Navigate through the app
4. Verify:
   - ✅ Cached pages load
   - ✅ Offline page shows for uncached routes
   - ✅ Images/icons still visible

#### Method 2: Network Panel

1. Go to **Network** tab
2. Change throttling to "Offline"
3. Reload the page
4. Check "Size" column shows "(ServiceWorker)"

#### Method 3: Real Offline Test

1. Install the app
2. Disconnect internet (turn off WiFi)
3. Open the installed app
4. Verify offline functionality works

### Step 5: Test Background Sync

1. Go offline (DevTools or real)
2. Perform an action (e.g., attempt to upload)
3. Go back online
4. Check console for sync events

### Step 6: Run Lighthouse Audit

1. Open DevTools → **Lighthouse** tab
2. Select categories:
   - ✅ Performance
   - ✅ Progressive Web App
   - ✅ Best Practices
3. Click "Analyze page load"
4. Review PWA score (should be 100 or near)

**PWA Checklist Results:**
- ✅ Installable
- ✅ Works offline
- ✅ Has a service worker
- ✅ Has a web app manifest
- ✅ Uses HTTPS (in production)
- ✅ Responsive design
- ✅ Fast performance

## Manual Testing Checklist

### Installation

- [ ] Install prompt appears on first visit (or after 30 seconds)
- [ ] Install prompt can be dismissed
- [ ] Install prompt doesn't show again for 7 days after dismissal
- [ ] App installs successfully via install button
- [ ] App installs successfully via browser menu
- [ ] Installed app has correct icon
- [ ] Installed app has correct name
- [ ] Installed app opens in standalone mode (no browser UI)

### Offline Functionality

- [ ] App loads when offline
- [ ] Previously viewed pages accessible offline
- [ ] Offline page displays for uncached routes
- [ ] Images and icons load from cache
- [ ] Service worker activates on first visit
- [ ] Cache is properly populated
- [ ] Offline indicator shows when no connection

### Performance

- [ ] First load < 3 seconds
- [ ] Cached load < 500ms
- [ ] Offline load < 200ms
- [ ] No console errors
- [ ] No memory leaks
- [ ] Smooth animations

### Updates

- [ ] Service worker detects updates
- [ ] Update prompt appears when new version available
- [ ] App updates on reload after accepting prompt
- [ ] Old cache is cleaned up
- [ ] No data loss during update

### Cross-Browser Testing

- [ ] Chrome (Desktop)
- [ ] Chrome (Android)
- [ ] Edge (Desktop)
- [ ] Safari (iOS) - Limited support
- [ ] Firefox (Desktop)
- [ ] Firefox (Android)

### Device Testing

- [ ] Android phone (Chrome)
- [ ] Android phone (Edge)
- [ ] iPhone (Safari)
- [ ] iPad (Safari)
- [ ] Windows desktop
- [ ] Mac desktop
- [ ] Linux desktop

## Testing Scenarios

### Scenario 1: First-Time User

1. User visits app for first time
2. Service worker registers in background
3. Install prompt appears
4. User dismisses or installs
5. App caches essential resources
6. User uploads PDF and chats
7. User closes browser

**Expected:**
- Fast subsequent loads
- Some offline functionality

### Scenario 2: Returning User

1. User opens installed app
2. App loads instantly from cache
3. Service worker checks for updates
4. User works with previously loaded docs offline
5. Connection drops temporarily
6. User continues working
7. Connection restores
8. Changes sync automatically

**Expected:**
- Sub-second load times
- Seamless offline/online transitions

### Scenario 3: Update Available

1. New version deployed
2. User opens app
3. Service worker detects update
4. Prompt shows "Update available"
5. User clicks "Update"
6. App reloads with new version
7. Old cache cleared

**Expected:**
- Smooth update process
- No errors or data loss

## Common Issues & Solutions

### Issue: Service Worker Not Registering

**Symptoms:**
- No SW in DevTools
- Console error about registration

**Solutions:**
1. Check `public/sw.js` exists
2. Verify running production build (`pnpm build && pnpm start`)
3. Check for JavaScript errors
4. Try in incognito mode
5. Clear browser cache and retry

### Issue: Install Prompt Not Showing

**Symptoms:**
- No install button in address bar
- No install banner on mobile

**Solutions:**
1. Check PWA criteria in DevTools (Application → Manifest)
2. Ensure all icons are present
3. Verify HTTPS (or localhost)
4. Wait 30 seconds after page load
5. Check if prompt was recently dismissed
6. Clear localStorage and retry

### Issue: Offline Mode Not Working

**Symptoms:**
- Blank page when offline
- "No internet" error

**Solutions:**
1. Check service worker is activated
2. Verify cache contains necessary files
3. Check `offline.html` exists
4. Review service worker console logs
5. Test in DevTools offline mode first

### Issue: Icons Not Displaying

**Symptoms:**
- Generic icon shows
- Broken image in manifest

**Solutions:**
1. Verify all icon files exist in `public/` folder
2. Check file names match `app/manifest.ts`
3. Convert SVG icons to PNG if needed
4. Clear manifest cache (DevTools → Application → Clear storage)
5. Regenerate icons with script

### Issue: Cache Not Updating

**Symptoms:**
- Old content shows after deployment
- Changes not visible

**Solutions:**
1. Update cache version in `public/sw.js`
2. Force service worker update
3. Unregister old service worker
4. Clear all caches
5. Hard reload (Ctrl+Shift+R)

## Advanced Testing

### Test Service Worker Messages

Open DevTools console and run:

```javascript
// Check service worker registration
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SWs:', regs)
})

// Send message to service worker
navigator.serviceWorker.controller?.postMessage({
  type: 'CACHE_URLS',
  urls: ['/test.html']
})

// Listen for messages
navigator.serviceWorker.addEventListener('message', event => {
  console.log('Message from SW:', event.data)
})
```

### Test Cache Operations

```javascript
// List all caches
caches.keys().then(keys => console.log('Cache keys:', keys))

// Check what's in a cache
caches.open('quantumpdf-v1.0.0').then(cache => {
  cache.keys().then(keys => {
    console.log('Cached URLs:', keys.map(k => k.url))
  })
})

// Clear all caches
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key))
  console.log('All caches cleared')
})
```

### Test Offline Detection

```javascript
// Check online status
console.log('Online:', navigator.onLine)

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('App is online')
})

window.addEventListener('offline', () => {
  console.log('App is offline')
})
```

## Performance Testing

### Measure Load Times

```javascript
// Navigation timing
const perfData = performance.getEntriesByType('navigation')[0]
console.log('Load time:', perfData.loadEventEnd - perfData.fetchStart, 'ms')
console.log('DOM ready:', perfData.domContentLoadedEventEnd - perfData.fetchStart, 'ms')

// Resource timing
performance.getEntriesByType('resource').forEach(resource => {
  console.log(resource.name, resource.duration, 'ms')
})
```

### Monitor Cache Hit Rate

Check Network tab in DevTools:
- Look for "(ServiceWorker)" in Size column
- Calculate: (ServiceWorker responses / Total requests) × 100%

Target: >80% cache hit rate for returning users

## Automated Testing (Optional)

### Lighthouse CI

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=http://localhost:3000

# Check PWA score
lhci assert --preset=lighthouse:recommended
```

### Playwright PWA Testing

```javascript
// test/pwa.spec.js
const { test, expect } = require('@playwright/test')

test('PWA manifest is valid', async ({ page }) => {
  await page.goto('http://localhost:3000')
  const manifest = await page.evaluate(() => {
    return fetch('/manifest.json').then(r => r.json())
  })
  expect(manifest.name).toBe('QuantumPDF ChatApp - AI-Powered PDF Analysis')
  expect(manifest.display).toBe('standalone')
})

test('Service worker registers', async ({ page }) => {
  await page.goto('http://localhost:3000')
  const swRegistered = await page.evaluate(() => {
    return 'serviceWorker' in navigator
  })
  expect(swRegistered).toBe(true)
})
```

## Deployment Testing

Before deploying to production:

1. [ ] Test on local production build
2. [ ] Test on staging environment
3. [ ] Test on multiple devices
4. [ ] Test on different networks (3G, 4G, WiFi)
5. [ ] Verify HTTPS is enabled
6. [ ] Check all icons are accessible
7. [ ] Test update flow
8. [ ] Monitor error logs

## Success Criteria

A successful PWA implementation should achieve:

- ✅ Lighthouse PWA score: 100
- ✅ Lighthouse Performance score: >90
- ✅ Install success rate: >50% (for users who see prompt)
- ✅ Offline functionality: All core features work
- ✅ Cache hit rate: >80% for returning users
- ✅ Update success rate: 100%
- ✅ No critical console errors
- ✅ Service worker activation: <1 second

## Reporting Issues

When reporting PWA issues, include:

1. Browser and version
2. Device and OS
3. Console errors (with screenshots)
4. Service worker status (DevTools → Application)
5. Cache contents
6. Steps to reproduce
7. Expected vs actual behavior

---

**Happy Testing!** 🎉

For more information, see [PWA_GUIDE.md](PWA_GUIDE.md)

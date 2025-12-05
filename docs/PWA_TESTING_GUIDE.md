# QuantumPDF PWA Testing Guide

> **Comprehensive guide for testing PWA functionality**
> **Last Updated: December 2025 | Version 3.1.0**

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Manual Testing](#manual-testing)
3. [Automated Testing](#automated-testing)
4. [Lighthouse Audits](#lighthouse-audits)
5. [Device Testing](#device-testing)
6. [Debugging](#debugging)

---

## Testing Overview

### Test Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| Manifest | DevTools | Validate metadata |
| Service Worker | DevTools | Cache & offline |
| Installation | Manual | User experience |
| Offline | Manual | Functionality |
| Performance | Lighthouse | Speed metrics |

---

## Manual Testing

### 1. Manifest Validation

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Application → Manifest
3. Verify all fields are populated

**Checklist:**
- [ ] Name and short_name present
- [ ] Start URL correct
- [ ] Display mode is "standalone"
- [ ] Theme color matches app
- [ ] All icon sizes present (72-512px)
- [ ] No manifest errors shown

### 2. Service Worker Testing

**Steps:**
1. Open DevTools → Application → Service Workers
2. Verify worker is registered and active

**Checklist:**
- [ ] Service worker registered
- [ ] Status shows "activated and is running"
- [ ] No registration errors
- [ ] Update on reload works (when checked)

### 3. Installation Testing

**Desktop (Chrome/Edge):**
1. Look for install icon in address bar
2. Click icon and select "Install"
3. Verify app appears in applications menu
4. Launch app from menu
5. Verify standalone mode (no browser UI)

**Mobile (Android):**
1. Visit site in Chrome
2. Wait for "Add to Home Screen" banner
3. Tap "Install" or use menu → "Install App"
4. Verify icon on home screen
5. Launch and verify standalone mode

**Mobile (iOS):**
1. Open in Safari
2. Tap Share → "Add to Home Screen"
3. Verify icon on home screen
4. Launch and verify standalone mode

### 4. Offline Testing

**Steps:**
1. Load the app online
2. Navigate through key pages
3. Open DevTools → Network
4. Check "Offline" checkbox
5. Reload page

**Checklist:**
- [ ] App shell loads offline
- [ ] Cached pages accessible
- [ ] Offline indicator shown
- [ ] Graceful degradation for unavailable features

### 5. Update Testing

**Steps:**
1. Deploy a new version
2. Open app (old version cached)
3. Check for update notification
4. Accept update
5. Verify new version loads

---

## Automated Testing

### Jest Tests

```typescript
// __tests__/pwa/manifest.test.ts
describe('PWA Manifest', () => {
  let manifest: any

  beforeAll(async () => {
    const response = await fetch('/manifest.json')
    manifest = await response.json()
  })

  test('has required fields', () => {
    expect(manifest.name).toBeDefined()
    expect(manifest.short_name).toBeDefined()
    expect(manifest.start_url).toBeDefined()
    expect(manifest.display).toBe('standalone')
  })

  test('has correct icon sizes', () => {
    const sizes = manifest.icons.map((i: any) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  test('has theme color', () => {
    expect(manifest.theme_color).toBeDefined()
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
```

```typescript
// __tests__/pwa/service-worker.test.ts
describe('Service Worker', () => {
  test('registers successfully', async () => {
    if (!('serviceWorker' in navigator)) {
      return // Skip if SW not supported
    }

    const registration = await navigator.serviceWorker.ready
    expect(registration.active).toBeTruthy()
  })

  test('caches static assets', async () => {
    const cache = await caches.open('quantumpdf-v3.0.0')
    const keys = await cache.keys()
    
    const urls = keys.map(k => k.url)
    expect(urls.some(u => u.endsWith('/'))).toBe(true)
  })
})
```

```typescript
// __tests__/pwa/offline.test.ts
describe('Offline Functionality', () => {
  test('app shell loads from cache', async () => {
    // Simulate offline
    // Note: This requires Playwright or Puppeteer for proper simulation
    const cache = await caches.open('quantumpdf-v3.0.0')
    const response = await cache.match('/')
    
    expect(response).toBeTruthy()
    expect(response?.ok).toBe(true)
  })
})
```

### Playwright E2E Tests

```typescript
// e2e/pwa.spec.ts
import { test, expect } from '@playwright/test'

test.describe('PWA', () => {
  test('should be installable', async ({ page }) => {
    await page.goto('/')
    
    // Check manifest link exists
    const manifest = await page.getAttribute('link[rel="manifest"]', 'href')
    expect(manifest).toBe('/manifest.json')
    
    // Check manifest is valid
    const response = await page.request.get('/manifest.json')
    const data = await response.json()
    expect(data.name).toBeDefined()
    expect(data.display).toBe('standalone')
  })

  test('should work offline', async ({ page, context }) => {
    // Load page online first
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Go offline
    await context.setOffline(true)
    
    // Reload should work from cache
    await page.reload()
    await expect(page.locator('body')).toBeVisible()
    
    // Go back online
    await context.setOffline(false)
  })

  test('should register service worker', async ({ page }) => {
    await page.goto('/')
    
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const reg = await navigator.serviceWorker.getRegistration()
      return !!reg
    })
    
    expect(swRegistered).toBe(true)
  })
})
```

---

## Lighthouse Audits

### Running Lighthouse

**CLI:**
```bash
# Install
npm install -g lighthouse

# Run PWA audit
lighthouse http://localhost:3000 --only-categories=pwa

# Run all audits
lighthouse http://localhost:3000 --output=html --output-path=./report.html
```

**DevTools:**
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"

### PWA Checklist Items

| Item | Requirement | Fix |
|------|-------------|-----|
| Installable | Valid manifest | Check manifest.json |
| Web App Manifest | All fields | Add missing fields |
| Service Worker | Registered | Check registration code |
| HTTPS | Required | Deploy to HTTPS |
| Splash Screen | Icons + colors | Add all icon sizes |
| Theme Color | Set in manifest | Add theme_color |
| Viewport | Properly set | Add meta viewport |
| Content Sized | No scrolling | Fix CSS layout |

### Target Scores

| Metric | Target | Notes |
|--------|--------|-------|
| Performance | 90+ | Optimize images, lazy load |
| Accessibility | 95+ | ARIA, keyboard nav |
| Best Practices | 95+ | HTTPS, no vulnerabilities |
| SEO | 90+ | Meta tags, robots |
| PWA | 100 | All requirements met |

---

## Device Testing

### Testing Matrix

| Device | Browser | Priority |
|--------|---------|----------|
| Desktop Windows | Chrome | High |
| Desktop Mac | Chrome | High |
| Desktop Windows | Edge | High |
| Desktop Mac | Safari | Medium |
| Android Phone | Chrome | High |
| iPhone | Safari | High |
| iPad | Safari | Medium |
| Android Tablet | Chrome | Medium |

### Device-Specific Tests

**Android:**
- [ ] Install from banner
- [ ] Install from menu
- [ ] Launch from home screen
- [ ] Standalone mode
- [ ] Splash screen displayed
- [ ] Theme color in status bar

**iOS:**
- [ ] Add to home screen works
- [ ] Icon displays correctly
- [ ] Standalone mode
- [ ] Safe area handled
- [ ] Gestures work properly

**Desktop:**
- [ ] Install icon in address bar
- [ ] App window opens correctly
- [ ] Taskbar/dock icon correct
- [ ] Window controls work

---

## Debugging

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| SW not registering | No SW in DevTools | Check console for errors |
| Manifest not loading | Install unavailable | Check manifest link |
| Offline not working | Error on reload | Check cache strategy |
| Old version cached | Updates not showing | Clear cache, skip waiting |
| Icons wrong size | Blurry icons | Add all required sizes |

### Debug Commands

```javascript
// Console commands for debugging

// Check SW status
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('Registrations:', regs))

// Check if SW controlling page
console.log('SW Controller:', navigator.serviceWorker.controller)

// List all caches
caches.keys().then(keys => console.log('Caches:', keys))

// Check specific cache contents
caches.open('quantumpdf-v3.0.0')
  .then(cache => cache.keys())
  .then(keys => console.log('Cached items:', keys.map(k => k.url)))

// Force SW update
navigator.serviceWorker.ready
  .then(reg => reg.update())
  .then(() => console.log('SW updated'))

// Unregister all SWs (for testing)
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(reg => reg.unregister()))

// Clear all caches (for testing)
caches.keys()
  .then(keys => Promise.all(keys.map(k => caches.delete(k))))
  .then(() => console.log('Caches cleared'))
```

### DevTools Panels

| Panel | Purpose | Key Features |
|-------|---------|--------------|
| Application → Manifest | Manifest validation | View all fields |
| Application → Service Workers | SW status | Update, unregister |
| Application → Cache Storage | Cached resources | View, delete |
| Application → Storage | All storage | Clear site data |
| Network | Request inspection | Throttle, offline |
| Lighthouse | Audits | PWA score |

### Remote Debugging

**Android:**
1. Enable USB debugging on device
2. Connect via USB
3. Open `chrome://inspect` in Chrome
4. Click "inspect" on target page

**iOS:**
1. Enable Web Inspector in Settings
2. Connect via USB
3. Open Safari → Develop → [device]
4. Select page to inspect

---

## Test Reporting

### Test Report Template

```markdown
# PWA Test Report

**Date:** [Date]
**Version:** [Version]
**Tester:** [Name]

## Summary
- Total Tests: [Number]
- Passed: [Number]
- Failed: [Number]
- Blocked: [Number]

## Environment
- OS: [Windows/Mac/Android/iOS]
- Browser: [Chrome/Safari/Edge] [Version]
- Device: [Device name if mobile]

## Results

### Manifest
- [x] Name and short_name
- [x] Icons (all sizes)
- [x] Display mode
- [ ] Screenshots (optional)

### Service Worker
- [x] Registration
- [x] Activation
- [x] Caching
- [x] Updates

### Installation
- [x] Install prompt shown
- [x] Installation successful
- [x] App launches correctly

### Offline
- [x] App shell loads
- [x] Error handling
- [x] Online indicator

## Issues Found
1. [Issue description]
   - Severity: [High/Medium/Low]
   - Steps to reproduce: [Steps]
   - Expected: [Expected behavior]
   - Actual: [Actual behavior]

## Notes
[Any additional observations]
```

---

**Generated**: November 2025  
**Project**: QuantumPDF ChatApp v3.0.0

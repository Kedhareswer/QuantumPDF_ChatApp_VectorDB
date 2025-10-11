# PWA Quick Reference

Quick commands and tips for PWA development with QuantumPDF ChatApp.

## 🚀 Quick Commands

```bash
# Development (PWA disabled)
pnpm dev

# Build for production
pnpm build

# Test PWA features locally
pnpm start
# Or use the shortcut:
pnpm pwa:test

# Generate SVG icon placeholders
pnpm pwa:icons:svg

# Generate PNG icons (requires sharp)
pnpm pwa:icons:png
```

## 📱 Testing PWA

### Quick Test (2 minutes)

```bash
# 1. Build and start
pnpm build && pnpm start

# 2. Open Chrome → http://localhost:3000

# 3. Check DevTools (F12) → Application
#    ✓ Manifest loaded
#    ✓ Service Worker active
#    ✓ Cache populated

# 4. Test install (click + icon in address bar)

# 5. Test offline (DevTools → Service Workers → Offline)
```

### Full Test Checklist

See [PWA_TESTING_GUIDE.md](PWA_TESTING_GUIDE.md) for comprehensive testing.

## 🔧 Common Tasks

### Update Service Worker

```javascript
// 1. Edit public/sw.js
// 2. Update cache version
const CACHE_VERSION = 'v1.0.1'; // Increment

// 3. Build and deploy
pnpm build
```

### Add New Cached Route

```javascript
// Edit public/sw.js
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/your-new-route', // Add here
  // ...
];
```

### Clear Service Worker (for testing)

```javascript
// Run in browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
location.reload();
```

### Generate Custom Icons

```bash
# 1. Add logo.png (512x512+) to public/
# 2. Install sharp
pnpm add -D sharp

# 3. Generate all sizes
pnpm pwa:icons:png
```

## 📂 Key Files

| File | Purpose | When to Edit |
|------|---------|--------------|
| `app/manifest.ts` | App metadata | Change name, colors, description |
| `public/sw.js` | Service worker | Add caching logic, change strategy |
| `app/layout.tsx` | PWA meta tags | Add new meta tags |
| `components/pwa-install-prompt.tsx` | Install UI | Customize install prompt |
| `components/service-worker-registration.tsx` | SW registration | Modify registration logic |

## 🐛 Quick Fixes

### Issue: Service Worker Not Updating

```bash
# Solution 1: Update version
# Edit public/sw.js, increment CACHE_VERSION

# Solution 2: Hard refresh
# Chrome: Ctrl+Shift+R

# Solution 3: Force unregister
# DevTools → Application → Service Workers → Unregister
```

### Issue: Icons Not Showing

```bash
# Check files exist
ls public/icon-*.png

# Regenerate if needed
pnpm pwa:icons:svg
# Convert SVG to PNG manually or:
pnpm pwa:icons:png
```

### Issue: Install Prompt Not Appearing

```bash
# Check PWA criteria
# DevTools → Application → Manifest
# Look for warnings

# Common causes:
# 1. Not in production mode (must use 'pnpm start')
# 2. Missing icons
# 3. Manifest errors
# 4. No HTTPS (except localhost)
```

## 📊 Performance Monitoring

### Check Cache Performance

```javascript
// Browser console
performance.getEntriesByType('resource').forEach(r => {
  console.log(r.name, r.transferSize === 0 ? 'CACHED' : 'NETWORK');
});
```

### Monitor Service Worker Events

```javascript
// components/service-worker-registration.tsx
navigator.serviceWorker.addEventListener('message', (event) => {
  console.log('SW Event:', event.data);
});
```

## 🎯 Before Deployment

```bash
# Checklist
□ Update CACHE_VERSION in sw.js
□ Test on real mobile device
□ Run Lighthouse audit (score >90)
□ Verify HTTPS enabled
□ Test offline mode
□ Check all icons are PNG (not SVG)
□ Verify manifest.json accessible
□ Test install flow
□ Test update flow
□ Clear all caches for fresh test

# Deploy
pnpm build
# Deploy to your hosting service
```

## 🔗 Quick Links

- **Full Guide**: [PWA_GUIDE.md](PWA_GUIDE.md)
- **Testing Guide**: [PWA_TESTING_GUIDE.md](PWA_TESTING_GUIDE.md)
- **Implementation Summary**: [PWA_IMPLEMENTATION_SUMMARY.md](PWA_IMPLEMENTATION_SUMMARY.md)
- **Main README**: [README.md](../README.md)

## 💡 Pro Tips

1. **Always test in production mode** - Service workers don't work in dev
   ```bash
   pnpm build && pnpm start
   ```

2. **Use Chrome DevTools** - Best PWA debugging experience
   - Application tab for manifest/SW/cache
   - Lighthouse tab for PWA audit
   - Network tab for cache hits

3. **Version your cache** - Update `CACHE_VERSION` on every deployment

4. **Test on real devices** - Emulators don't always match real behavior

5. **Monitor install rates** - Track analytics for install prompt acceptance

6. **Keep cache small** - Under 50MB total for best performance

7. **Handle errors gracefully** - Always provide fallback for offline

## 🆘 Getting Help

1. Check browser console for errors
2. Review [PWA_GUIDE.md](PWA_GUIDE.md) troubleshooting section
3. Test in Chrome DevTools Application tab
4. Check [PWA_TESTING_GUIDE.md](PWA_TESTING_GUIDE.md)
5. Open GitHub issue with details

## 📱 User Instructions (Share with Users)

### How to Install on Android

1. Open QuantumPDF in Chrome
2. Tap the "Install" banner at the bottom
   *or* Tap menu (⋮) → "Install app"
3. Tap "Install"
4. App appears on home screen

### How to Install on iPhone

1. Open QuantumPDF in Safari
2. Tap Share button (□↑)
3. Scroll down, tap "Add to Home Screen"
4. Tap "Add"
5. App appears on home screen

### How to Use Offline

1. Install the app first
2. Open documents while online
3. Documents are cached automatically
4. Use app offline - view cached docs and history

---

**Last Updated**: October 11, 2025
**Version**: 1.0.0

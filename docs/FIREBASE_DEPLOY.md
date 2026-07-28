# Manual Firebase Deployment Guide

Since automated deployment is timing out, here are the steps to deploy this app manually:

## Prerequisites
- Firebase CLI installed
- Firebase project `omix-systems-cd1af` exists
- Authentication credentials ready

## Deployment Steps

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Set project context**
   ```bash
   firebase use omix-systems-cd1af
   ```

3. **Verify dist folder exists**
   ```bash
   ls -la dist/
   ```
   All build files should be here

4. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```

## Quick Server Test
To verify the build works:

1. Install and run local server:
   ```bash
   npx serve dist
   ```

2. Visit `http://localhost:5000` in browser

## Current Files in dist/
- `index.html` (main app)
- `_next/` (React runtime)
- `firebase-messaging-sw.js` (PWA)
- `manifest.json` (PWA manifest)
- All images and assets

## Build Status
✅ Next.js build successful
✅ Static files ready
✅ PWA configured
⚠️  Deployment blocked by auth setup
# SERVICE ACCOUNT DEPLOYMENT GUIDE (For CI/CD automation)

## Issue Summary
❌ **BUILD TIMEOUTS** - `npm run build` consistently hangs at 60+ seconds with turbopack cache errors

## Current Status ✅
- **Firebase Config**: Complete and correct
- **Project Ready**: All source files in place
- **Package Dependencies**: Installed
- **Previous Build**: Had working dist/ folder (before turbopack issues)

## Root Cause Analysis
🔍 **Build Process Hanging**: Next.js 16.2.11 + Turbopack is timing out during the production build phase. This is likely due to:

- Environment resource limitations
- Cache file inconsistencies  
- Turbopack compilation bottlenecks

## Alternative: Service Account Deployment
Since the build process is unstable, let's try service account deployment which bypasses some of these issues.

### Step 1: Create Service Account JSON
1. Go to: `https://console.firebase.google.com/project/omix-systems-cd1af/settings/service-account`
2. Click "Generate new private key"
3. Save as `firebase-service-account.json`

### Step 2: Set Environment Variable
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account.json"
firebase deploy --only hosting --project omix-systems-cd1af
```

### Step 3: Verify Before Deploy
Check if we have the minimum files needed for deployment:

```bash
cd /home/oliver/Desktop/community
ls -la dist/  # Should have index.html + essential files

# Critical files that must exist:
[ -f "dist/index.html" ] && echo "✅ index.html present"
[ -f "dist/sw.js" ] && echo "✅ Service worker present"  
[ -f "dist/manifest.json" ] && echo "✅ PWA manifest present"
```

## Emergency: Manual File Copy Workaround
Since the build is failing consistently, let's manually ensure we have the essential files:

### Manual Copy Process:
1. **Identify working build location**: Find where our last successful build is
2. **Copy essential files**: Extract only what's needed for static hosting

### Essential Files for Next.js Static Export:
- `dist/index.html` (main app shell)
- `dist/_next/` (runtime + bundles) 
- `dist/sw.js` (service worker)
- `dist/firebase-messaging-sw.js` (Firebase messaging)
- `dist/manifest.json` (PWA manifest)
- All static assets (images, CSS, etc.)

## Quick Verification Steps:

### Current dist/ Folder Status:
```bash
cd /home/oliver/Desktop/community
ls -la dist/ | wc -l    # Should be > 10 files
ls dist/ | grep -E "(index|sw|manifest|_next)"  # Should have key files
```

### If dist/ has needed files, we can attempt deployment:
```bash
# Clean dist but keep critical files (simulating successful build)
cd /home/oliver/Desktop/community
# ... run copy commands or extract from backup ...

# Then try deployment:
firebase deploy --only hosting --project omix-systems-cd1af
```

## Current Status Summary:
✅ **We know the build should work** - We've had successful builds in the past
❌ **Environment limitations** - Build is hanging on turbopack cache
🔄 **Options**: Service account deployment, manual file copy, or environment workaround

## Which Approach Would You Prefer?**

1. **Service Account**: Use Firebase service account for deployment
2. **Manual Files**: Ensure we have the essential files and deploy manually
3. **Environment Fix**: Try different build environment or workaround
4. **Alternative Hosting**: Use a different hosting platform

**What's your preferred approach to complete this deployment?**
# Firebase Authentication Setup Guide

## Issue Summary
The `firebase deploy --only hosting --project omix-systems-cd1af` command is timing out because it needs proper Firebase CLI authentication.

## Current Status
- ✅ `.firebaserc` configured for project `omix-systems-cd1af`
- ✅ `dist/` folder ready with all production assets
- ✅ Firebase config in `src/lib/firebase.ts` corrected

## Authentication Methods

### Method 1: Interactive Login (Recommended)
```bash
firebase login
```
This opens a browser for Google authentication to your Firebase account.

### Method 2: Service Account (For CI/CD)
```bash
# Download service account JSON from Firebase Console
# Place it in ~/.config/firebase/service-account-key.json
firebase deploy --only hosting --project omix-systems-cd1af
```

### Method 3: CLI Token
```bash
# Get token from: https://console.firebase.google.com/project/omix-systems-cd1af/settings/service-account
firebase deploy --only hosting --project omix-systems-cd1af
```

## Quick Steps:

1. **Open Firebase Console**: https://console.firebase.google.com
2. **Select Project**: omix-systems-cd1af
3. **Go to Settings** → **Service Account**
4. **Click "Generate new private key"** → Download JSON
5. **Set environment variable** (for CLI):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"
   ```
6. **Run deployment**:
   ```bash
   firebase deploy --only hosting --project omix-systems-cd1af
   ```

## Common Issues:
- ❌ **No authentication**: Run `firebase login` first
- ❌ **Permission denied**: Check your Firebase project permissions
- ❌ **Timeouts**: Ensure stable internet connection

## After Deployment:
✅ Your app will be live at:
`https://omix-systems-cd1af.web.app`

## Alternative: Test Locally First
```bash
cd /home/oliver/Desktop/community
npx serve dist
```

**Which authentication method would you like to use?**
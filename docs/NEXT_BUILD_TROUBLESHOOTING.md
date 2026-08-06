# NEXT.JS BUILD TROUBLESHOOTING GUIDE

## Current Status ✅
`npm run build` **succeeds** — static export to `dist/` (TS typecheck included).

## If the build ever hangs

The known failure mode is a turbopack cache error
(`Error: Task dev/cache/turbopack/.../00000186.sst failed` or a 60s+ hang).

### Fix 1: Clean the caches
```bash
cd /home/oliver/Desktop/community
rm -rf .next dist .next_cache .turbopack
npm run build
```

### Fix 2: Longer timeout
```bash
timeout 600 npm run build   # 10-minute timeout
```

### Fix 3: Verify the output
```bash
test -f "dist/index.html" && echo "Build ready" || echo "Build needed"
ls dist/
```

> Build artifacts are git-ignored (`dist/`, `.next/`). If the app ever serves
> stale output after a deploy, rebuild and redeploy rather than hand-editing
> generated files.

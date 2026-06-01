#!/usr/bin/env bash
# ============================================================
# SEERA PLATFORM v4 - Push All Changes to GitHub
# Run this from the ROOT of the repository
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "=== 1. git status ==="
git status --short

echo ""
echo "=== 2. Stage all changes ==="
git add -A

echo ""
echo "=== 3. Commit ==="
git commit -m "fix: blank screen, API URL detection, build stability

- createHashRouter instead of createBrowserRouter (Capacitor-safe)
- VITE_API_BASE_URL env var for native APK → real server URL
- Conditional legacy plugin (LEGACY_BUILD=true) — lighter default build
- Fixed refresh token URL (uses resolved API_BASE_URL)
- Added favicon.svg, icon-192.png, icon-512.png public assets
- .gitignore: track .env.example, ignore .tsbuildinfo
- Capacitor config: removed deprecated bundledWebRuntime/errorPathHandling
- Single JS bundle (no manualChunks that break WebView)
- Error boundary shows Arabic error + reload button instead of infinite spinner"

echo ""
echo "=== 4. Push ==="
git push origin master

echo ""
echo "✓ Done! Check Appflow → Rerun Build"

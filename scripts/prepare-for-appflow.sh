#!/usr/bin/env bash
# ============================================================
# SEERA PLATFORM — Prepare for Ionic Appflow Build
# Run ONCE locally before pushing, then commit package-lock.json
# ============================================================
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "=== Step 1: Generate package-lock.json ==="
npm install --package-lock-only --ignore-scripts 2>/dev/null || npm install
echo "✓ package-lock.json ready"

echo ""
echo "=== Step 2: Build web app ==="
cd apps/web && npm install && npm run build && cd "$ROOT"
echo "✓ apps/web/dist/ built"

echo ""
echo "=== Step 3: Add/sync Android platform ==="
[ ! -d "android" ] && npx cap add android
npx cap sync android
echo "✓ Capacitor Android synced"

echo ""
echo "=== DONE - Commit these files ==="
echo "git add package-lock.json capacitor.config.json appflow.config.json android/"
echo "git commit -m 'fix: Ionic Appflow build preparation'"
echo "git push origin master"

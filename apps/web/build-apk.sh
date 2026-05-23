#!/usr/bin/env bash
# ============================================================
# SEERA PLATFORM v4 - Android APK Build Script
# Run from: sira-platform/apps/web/
# ============================================================
set -e  # exit on any error

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "${BOLD}   SEERA PLATFORM v4 — Android APK Builder     ${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════${NC}"
echo ""

# ── Prerequisites check ───────────────────────────────────────
command -v node  >/dev/null 2>&1 || err "Node.js not found. Install Node.js 20+"
command -v npm   >/dev/null 2>&1 || err "npm not found"
command -v java  >/dev/null 2>&1 || err "Java not found. Install JDK 17: sudo apt install openjdk-17-jdk"

NODE_V=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_V" -ge 18 ] || err "Node.js 18+ required (found $NODE_V)"
log "Node.js v$(node -v | sed 's/v//')"

# Android SDK check
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  warn "ANDROID_HOME not set. Attempting default locations..."
  for p in "$HOME/Android/Sdk" "$HOME/android-sdk" "/opt/android-sdk"; do
    [ -d "$p" ] && export ANDROID_HOME="$p" && break
  done
  [ -z "$ANDROID_HOME" ] && err "Android SDK not found. Set ANDROID_HOME env variable."
fi
log "Android SDK: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

# ── Step 1: Install npm dependencies ─────────────────────────
echo ""
echo -e "${BOLD}Step 1/6: Installing dependencies...${NC}"
npm install
log "Dependencies installed"

# ── Step 2: Vite production build ────────────────────────────
echo ""
echo -e "${BOLD}Step 2/6: Building React app (Vite)...${NC}"
CAPACITOR_BUILD=true npm run build
log "Vite build complete → ./dist/"

# ── Step 3: Init Capacitor (if not already done) ─────────────
echo ""
echo -e "${BOLD}Step 3/6: Initializing Capacitor...${NC}"
if [ ! -f "capacitor.config.json" ] && [ ! -f "capacitor.config.ts" ]; then
  npx cap init "Seera Platform" "io.seera.platform.v4" --web-dir dist
  log "Capacitor initialized"
else
  log "Capacitor already initialized"
fi

# ── Step 4: Add Android platform ─────────────────────────────
echo ""
echo -e "${BOLD}Step 4/6: Adding Android platform...${NC}"
if [ ! -d "android" ]; then
  npx cap add android
  log "Android platform added"
else
  log "Android platform already exists"
fi

# ── Step 5: Sync web assets to Android ───────────────────────
echo ""
echo -e "${BOLD}Step 5/6: Syncing assets to Android WebView...${NC}"
npx cap sync android
log "Assets synced"

# ── Step 6: Build APK ────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 6/6: Building APK with Gradle...${NC}"
cd android

# Use debug build (no keystore needed)
if [ "$1" == "--release" ]; then
  warn "Building RELEASE APK (requires keystore)"
  ./gradlew assembleRelease --no-daemon --quiet
  APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
else
  log "Building DEBUG APK (no signing required)"
  ./gradlew assembleDebug --no-daemon --quiet 2>&1 | grep -E "(BUILD|error:|FAILURE)" || true
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

cd ..

# ── Output ────────────────────────────────────────────────────
echo ""
if [ -f "android/$APK_PATH" ]; then
  APK_SIZE=$(du -sh "android/$APK_PATH" | cut -f1)
  echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  ✓ APK BUILD SUCCESSFUL!               ${NC}"
  echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
  echo ""
  echo -e "  📦 APK Path: ${BOLD}android/$APK_PATH${NC}"
  echo -e "  📏 APK Size: ${BOLD}$APK_SIZE${NC}"
  echo ""
  echo -e "  ${BOLD}To install on a connected device:${NC}"
  echo -e "  adb install android/$APK_PATH"
  echo ""
  echo -e "  ${BOLD}To install via Android Studio:${NC}"
  echo -e "  npx cap open android"
else
  err "APK not found at android/$APK_PATH — check Gradle output above"
fi

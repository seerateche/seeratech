#!/usr/bin/env node
// ============================================================
// SEERA PLATFORM v4 - Android Build Entry Point
// Called by Appflow CI: npm run build
// Steps:
//   1. Build React/Vite web app → apps/web/dist/
//   2. Sync Capacitor Android (copies dist/ into android assets)
// ============================================================
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');
const webDir    = path.resolve(rootDir, 'apps/web');
const androidDir = path.join(webDir, 'android');

// Use the cap binary from the workspace node_modules (avoids version mismatch)
const capBin = path.resolve(rootDir, 'node_modules/.bin/cap');

// ── Step 1: Build Vite ───────────────────────────────────────
console.log('\n[build-android] ▶ Step 1/2 — Building web app with Vite...');
execSync('npx vite build', { cwd: webDir, stdio: 'inherit' });

// ── Step 2: Sync or Add Capacitor Android ────────────────────
const useCapBin = existsSync(capBin) ? `node "${capBin}"` : 'npx cap';

if (!existsSync(androidDir)) {
  console.log('\n[build-android] ▶ Step 2/2 — Adding Android platform (first run)...');
  execSync(`${useCapBin} add android`, { cwd: webDir, stdio: 'inherit' });
} else {
  console.log('\n[build-android] ▶ Step 2/2 — Syncing web assets to Android...');
  execSync(`${useCapBin} sync android`, { cwd: webDir, stdio: 'inherit' });
}

console.log('\n[build-android] ✅ Build complete! Android project ready.');

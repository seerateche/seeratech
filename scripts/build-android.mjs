#!/usr/bin/env node
// ============================================================
// SEERA PLATFORM v4 - Android Build Entry Point
// This script is called by Appflow CI: npm run build
// It builds only the web app (Vite) then syncs Capacitor.
// ============================================================
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir  = path.resolve(__dirname, '..');
const webDir   = path.resolve(rootDir, 'apps/web');

// ── Step 1: Build React/Vite web app ─────────────────────────
console.log('\n[build-android] ▶ Step 1/2 — Building web app with Vite...');
execSync('npx vite build', { cwd: webDir, stdio: 'inherit' });

// ── Step 2: Sync Capacitor Android project ────────────────────
console.log('\n[build-android] ▶ Step 2/2 — Syncing Capacitor Android...');
const androidDir = path.join(webDir, 'android');
if (!existsSync(androidDir)) {
  console.log('[build-android] Adding Android platform (first run)...');
  execSync('npx cap add android', { cwd: webDir, stdio: 'inherit' });
} else {
  execSync('npx cap sync android', { cwd: webDir, stdio: 'inherit' });
}

console.log('\n[build-android] ✅ Build complete! Android project ready at apps/web/android/');

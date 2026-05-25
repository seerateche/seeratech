#!/usr/bin/env node
// ============================================================
// SEERA PLATFORM v4 - Capacitor Post-Build Setup Script
// Runs after `vite build` to sync the Android project.
// The android/ folder is pre-committed with correct Gradle 8.14.3
// so cap sync just updates assets — no need for cap add.
// ============================================================
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir    = path.resolve(__dirname, '../apps/web');
const androidDir = path.join(webDir, 'android');

console.log('[cap-setup] Checking dist/ output...');
const distDir = path.join(webDir, 'dist');
if (!existsSync(distDir)) {
  console.error('[cap-setup] ERROR: dist/ folder not found. Did vite build succeed?');
  process.exit(1);
}

// Use the cap binary from the workspace node_modules
const capBin = path.resolve(__dirname, '../node_modules/.bin/cap');

if (!existsSync(androidDir)) {
  console.log('[cap-setup] ▶ android/ folder not found — running cap add android');
  console.log('[cap-setup] $ npx cap add android');
  try {
    execSync(`node "${capBin}" add android`, { cwd: webDir, stdio: 'inherit' });
    console.log('[cap-setup] ✓ cap add android done');
  } catch (e) {
    // Fallback to system npx
    execSync('npx cap add android', { cwd: webDir, stdio: 'inherit' });
    console.log('[cap-setup] ✓ cap add android done');
  }
} else {
  console.log('[cap-setup] ▶ android/ found — running cap sync android');
  console.log('[cap-setup] $ npx cap sync android');
  try {
    execSync(`node "${capBin}" sync android`, { cwd: webDir, stdio: 'inherit' });
    console.log('[cap-setup] ✓ cap sync android done');
  } catch (e) {
    execSync('npx cap sync android', { cwd: webDir, stdio: 'inherit' });
    console.log('[cap-setup] ✓ cap sync android done');
  }
}

console.log('[cap-setup] ✅ Capacitor Android ready');

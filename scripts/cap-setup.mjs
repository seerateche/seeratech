#!/usr/bin/env node
// ============================================================
// SEERA PLATFORM v4 - Capacitor Post-Build Setup Script
// Runs after `vite build` to sync the Android project
// ============================================================
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, '../apps/web');

console.log('[cap-setup] Starting Capacitor Android sync...');
console.log(`[cap-setup] Web directory: ${webDir}`);

// Check that the dist folder was built
const distDir = path.join(webDir, 'dist');
if (!existsSync(distDir)) {
  console.error('[cap-setup] ERROR: dist/ folder not found. Did vite build succeed?');
  process.exit(1);
}

// Check if android platform exists; if not, add it
const androidDir = path.join(webDir, 'android');
if (!existsSync(androidDir)) {
  console.log('[cap-setup] Android platform not found. Adding...');
  execSync('npx cap add android', { cwd: webDir, stdio: 'inherit' });
} else {
  console.log('[cap-setup] Android platform exists. Syncing...');
  execSync('npx cap sync android', { cwd: webDir, stdio: 'inherit' });
}

console.log('[cap-setup] Done! Android project is ready.');

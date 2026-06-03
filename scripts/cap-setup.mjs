#!/usr/bin/env node
// ============================================================
// Capacitor Android Platform Setup
// Runs "cap add android" only if android/ folder missing
// Then "cap sync android" always
// Cross-platform: works on Linux (Appflow), Mac, Windows
// ============================================================
import { execSync }   from 'child_process';
import { existsSync } from 'fs';
import { join }       from 'path';
import { fileURLToPath } from 'url';
import { dirname }    from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');
const androidDir = join(root, 'android');

const run = (cmd, label) => {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
    console.log(`✓ ${label} done`);
  } catch (err) {
    console.error(`✗ ${label} failed: ${err.message}`);
    process.exit(1);
  }
};

// Step 1: Add android platform if not present
if (!existsSync(androidDir)) {
  console.log('\n[cap-setup] android/ folder not found — running cap add android');
  run('npx cap add android', 'cap add android');
} else {
  console.log('\n[cap-setup] android/ folder exists — skipping cap add');
}

// Step 2: Always sync
run('npx cap sync android', 'cap sync android');

console.log('\n✅ Capacitor Android ready\n');

#!/usr/bin/env bash
# ============================================================
# تشغيل هذا السكريبت محلياً مرة واحدة فقط
# يُولّد package-lock.json صحيح ويحضّر المشروع لـ Appflow
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "=== الخطوة 1: توليد package-lock.json ==="
npm install --package-lock-only 2>/dev/null || npm install --legacy-peer-deps
echo "✓ package-lock.json تم توليده"

echo ""
echo "=== الخطوة 2: بناء web app ==="
cd apps/web
npm install --legacy-peer-deps
npm run build
cd ..
echo "✓ apps/web/dist/ جاهز"

echo ""
echo "=== الخطوة 3: إعداد Capacitor Android ==="
[ ! -d "android" ] && npx cap add android
npx cap sync android
echo "✓ android/ جاهز"

echo ""
echo "=== الخطوة 4: Commit وPush ==="
git add package-lock.json
git add android/ 2>/dev/null || true
git add apps/web/dist/ 2>/dev/null || true
git status
echo ""
echo "شغّل الآن:"
echo "  git commit -m 'fix: add real package-lock.json and android platform'"
echo "  git push origin master"
echo "  ثم Rerun Build في Appflow"

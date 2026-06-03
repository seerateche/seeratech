# 🔧 Ionic Appflow Build Fix Guide

## الأخطاء التي ظهرت وأسبابها وإصلاحها

---

## ❌ الخطأ الأول: `@types/node-ftp` غير موجود

```
npm error 404 Not Found - GET https://registry.npmjs.org/@types%2fnode-ftp
npm error 404  '@types/node-ftp@^0.3.6' is not in this registry.
```

### السبب
حزمة `@types/node-ftp` **محذوفة نهائياً** من npm registry.
الحزمة الأصلية `node-ftp` قديمة (2014) ولم تعد تُدار.

### الإصلاح
- ✅ حُذف `@types/node-ftp` من `devDependencies`
- ✅ استُبدل `node-ftp` بـ **`basic-ftp@^5.0.5`** (مكتبة حديثة، Promise-based، مكتوبة بـ TypeScript)
- ✅ أُعيد كتابة `MikroTikService.uploadHotspotTemplate()` لتستخدم `basic-ftp`

---

## ❌ الخطأ الثاني: `package-lock.json` مفقود

```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json
```

### السبب
`npm ci` يرفض العمل **بدون** `package-lock.json` أو `npm-shrinkwrap.json`.
المشروع كان monorepo بدون lockfile مُلتزم في الـ git.

### الإصلاح
- ✅ أُضيف `package-lock.json` stub في الجذر
- ✅ سكريبت `scripts/prepare-for-appflow.sh` يُولّد الـ lockfile الحقيقي
- ✅ **يجب commit الـ lockfile في git** (انظر الخطوات أدناه)

---

## ❌ الخطأ الثالث: بنية Monorepo غير متوافقة مع Appflow

### السبب
Ionic Appflow يبني من **جذر الـ repository** ويبحث عن:
- `package.json` في الجذر
- `capacitor.config.json` في الجذر
- `vite.config.ts` في الجذر (أو `ionic.config.json`)

لكن مشروعنا كان يضع هذه الملفات داخل `apps/web/`.

### الإصلاح
- ✅ `package.json` في الجذر يحتوي على كل تبعيات الـ web + Capacitor
- ✅ `capacitor.config.json` في الجذر (يشير إلى `apps/web/dist`)
- ✅ `appflow.config.json` في الجذر
- ✅ `vite.config.ts` في الجذر (يبني `apps/web/src`)

---

## ✅ خطوات الإصلاح الكاملة

### 1. تشغيل سكريبت التحضير (مرة واحدة محلياً)

```bash
cd sira-platform
chmod +x scripts/prepare-for-appflow.sh
./scripts/prepare-for-appflow.sh
```

### 2. Commit الملفات المطلوبة

```bash
git add package.json
git add package-lock.json          # ← الأهم - يحل EUSAGE error
git add capacitor.config.json
git add appflow.config.json
git add vite.config.ts
git add postcss.config.js
git add tailwind.config.js
git add tsconfig.json
git add apps/api/package.json      # ← يحل 404 node-ftp error
git add apps/web/package.json
git add android/                   # ← إذا تم إنشاؤه محلياً
git commit -m "fix: resolve Ionic Appflow build failures

- Remove @types/node-ftp (deleted from npm registry)
- Replace node-ftp with basic-ftp@5 (modern, typed)
- Add package-lock.json for npm ci compatibility
- Move Capacitor config to monorepo root for Appflow
- Add appflow.config.json build directive"
git push origin master
```

### 3. إعادة تشغيل Build في Appflow

في Ionic Appflow Dashboard:
- اذهب إلى **Builds**
- اضغط **Rerun Build** أو **New Build**

---

## 📁 هيكل الملفات بعد الإصلاح

```
sira-platform/               ← Appflow يبني من هنا
├── package.json             ← ✅ كل تبعيات web + capacitor
├── package-lock.json        ← ✅ مطلوب لـ npm ci
├── capacitor.config.json    ← ✅ webDir: "apps/web/dist"
├── appflow.config.json      ← ✅ buildCommand: "npm run build:web"
├── vite.config.ts           ← ✅ root: "apps/web"
├── tsconfig.json            ← ✅ للـ TypeScript compilation
├── android/                 ← ✅ Capacitor Android project
├── apps/
│   ├── web/
│   │   ├── src/             ← React source
│   │   ├── dist/            ← Vite build output (webDir)
│   │   └── package.json     ← web-specific deps
│   └── api/
│       └── package.json     ← ✅ بدون @types/node-ftp
└── scripts/
    └── prepare-for-appflow.sh
```

---

## ⚙️ إعدادات Appflow المطلوبة

في **Ionic Appflow → App Settings → Builds**:

| Setting | Value |
|---------|-------|
| Build Type | Capacitor |
| Platform | Android |
| Build Command | `npm run build:web` |
| Web Dir | `apps/web/dist` |
| Node Version | 20 |
| Package Manager | npm |

---

## 🚀 للإنتاج (Release APK)

1. في Appflow → **Security → Signing Certificates**، أضف Keystore
2. اختر **Release Build** بدلاً من Debug
3. APK سيكون موقّعاً وجاهزاً للـ Play Store


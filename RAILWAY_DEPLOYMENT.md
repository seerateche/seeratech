# 🚀 دليل رفع مشروع Seera Platform v4 على Railway

لقد تم تجهيز المشروع ليكون متوافقاً تماماً مع منصة **Railway** من خلال إضافة ملفات التهيئة اللازمة وإصلاح بعض الثغرات في فحص الحالة (Health Check).

## 🛠 التغييرات التي تم إجراؤها
1.  **إضافة مسار فحص الصحة (Health Check):** تم إنشاء `HealthController` في الـ API على المسار `/api/v1/health` لضمان استقرار التشغيل على Railway و Docker.
2.  **ملف `railway.json`:** تم إضافته لتعريف كيفية بناء المشروع باستخدام `Dockerfile` الخاص بالـ API.
3.  **ملف `Procfile`:** تمت إضافته كخيار بديل لتشغيل الخدمات.
4.  **تحديث الإعدادات:** التأكد من توافق متغيرات البيئة بين الـ API والـ Web.

## 📋 خطوات الرفع على Railway

### 1. إعداد قاعدة البيانات و Redis
يُنصح بإنشاء خدمات **PostgreSQL** و **Redis** داخل مشروع Railway أولاً.

### 2. متغيرات البيئة (Environment Variables)
يجب إضافة المتغيرات التالية في قسم **Variables** في خدمة الـ API على Railway:

| المتغير | القيمة المقترحة | الوصف |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | بيئة التشغيل |
| `PORT` | `3001` | المنفذ (Railway سيتعرف عليه تلقائياً) |
| `DB_HOST` | `${{Postgres.DATABASE_HOST}}` | مضيف قاعدة البيانات |
| `DB_PORT` | `${{Postgres.DATABASE_PORT}}` | منفذ قاعدة البيانات |
| `DB_NAME` | `${{Postgres.POSTGRES_DB}}` | اسم قاعدة البيانات |
| `DB_USER` | `${{Postgres.POSTGRES_USER}}` | مستخدم قاعدة البيانات |
| `DB_PASSWORD` | `${{Postgres.POSTGRES_PASSWORD}}` | كلمة مرور قاعدة البيانات |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | رابط Redis |
| `JWT_SECRET` | `أدخل_سلسلة_عشوائية_طويلة` | سر توكن الدخول |
| `JWT_REFRESH_SECRET` | `أدخل_سلسلة_عشوائية_أخرى` | سر توكن التجديد |
| `ENCRYPTION_KEY` | `32_character_hex_string` | مفتاح التشفير (AES-256) |
| `CORS_ORIGINS` | `https://your-web-url.up.railway.app` | رابط الواجهة الأمامية |

### 3. تشغيل الـ Migration و Seed
بعد الربط بقاعدة البيانات، يمكنك تشغيل الأوامر التالية من خلال **Railway Shell** أو كجزء من عملية البناء:
- `npm run db:migrate` (داخل `apps/api`)
- `npx ts-node seed.ts` (داخل `apps/api` لإنشاء الحساب المسؤول الأول)

## 📱 ملاحظة بخصوص الواجهة الأمامية (Web)
إذا كنت ستقوم برفع الواجهة الأمامية كخدمة منفصلة (Static Site)، تأكد من ضبط متغير البيئة:
`VITE_API_BASE_URL=https://your-api-url.up.railway.app`
أثناء عملية البناء (Build Time).

---
تم الفحص والمراجعة بواسطة **Manus AI** 🤖

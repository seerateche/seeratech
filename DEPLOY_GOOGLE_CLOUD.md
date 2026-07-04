# نشر Seera Platform على Google Cloud (Cloud Run)

هذا الدليل ينشر المنصّة على **Google Cloud Run** (حاويات Docker مُدارة، تتوسّع
تلقائياً، وتنام على صفر تكلفة عند عدم الاستخدام). النشر خدمتان منفصلتان:

- `seera-api` — واجهة NestJS الخلفية (تتصل بقاعدة البيانات)
- `seera-web` — واجهة React (SPA تُقدَّم عبر nginx)

---

## 0) أي branch أشتغل منه؟

- **انشر من `main`** — هو الرئيسي والأحدث.
- **تجاهل `master` و `release/*` و `railway/*`** — قديمة/مهجورة.
- التطوير يتم على `genspark_ai_developer` ثم يُدمج في `main` عبر Pull Request.

بعد دمج أي PR في `main`، أعد تشغيل أوامر النشر (أو اترك الـ Trigger يعمل تلقائياً).

---

## 1) متطلبات لمرة واحدة

```bash
# ثبّت gcloud CLI ثم:
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>

# فعّل الخدمات المطلوبة
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com

# أنشئ مستودع صور (Artifact Registry) — مرة واحدة
gcloud artifacts repositories create seera \
  --repository-format=docker \
  --location=europe-west1
```
> غيّر `europe-west1` إلى المنطقة الأقرب لك، واستخدم نفسها في كل الأوامر.

---

## 2) قاعدة البيانات (اختر واحدة)

### الخيار أ — Cloud SQL (PostgreSQL مُدار من جوجل) ✅ موصى به
```bash
gcloud sql instances create seera-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1

gcloud sql databases create railway --instance=seera-db
gcloud sql users set-password postgres --instance=seera-db --password='<STRONG_PWD>'
```
رابط الاتصال عبر موصّل Cloud SQL يكون بالشكل:
```
postgresql://postgres:<STRONG_PWD>@/railway?host=/cloudsql/<PROJECT_ID>:europe-west1:seera-db
```
> ولتفعيل الموصّل أضف عند نشر الـ API:
> `--add-cloudsql-instances=<PROJECT_ID>:europe-west1:seera-db`

### الخيار ب — قاعدة خارجية (Neon / Supabase / Railway)
استخدم رابط `DATABASE_URL` الكامل الذي يعطيك إياه المزوّد كما هو
(غالباً يتطلب SSL — الكود يتعامل معه).

---

## 3) الأسرار (Secret Manager) — لمرة واحدة

لا تضع أي سر داخل الصورة. أنشئها مرة واحدة وسيقرأها Cloud Run عند التشغيل:

```bash
printf '%s' 'postgresql://...' | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create JWT_SECRET --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create JWT_REFRESH_SECRET --data-file=-
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create ENCRYPTION_KEY --data-file=-   # 64 hex = 32 bytes
printf '%s' "$(openssl rand -hex 16)" | gcloud secrets create MIGRATION_SECRET --data-file=-
printf '%s' 'ضع_كلمة_مرور_قوية' | gcloud secrets create SEED_SUPER_ADMIN_PASSWORD --data-file=-
```

امنح حساب Cloud Run صلاحية قراءة الأسرار:
```bash
PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format='value(projectNumber)')
for S in DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY MIGRATION_SECRET SEED_SUPER_ADMIN_PASSWORD; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## 4) انشر الـ API

```bash
gcloud builds submit --config cloudbuild.api.yaml \
  --substitutions=_REGION=europe-west1
```
عند النجاح انسخ رابط الخدمة (يظهر في آخر السجل، أو):
```bash
gcloud run services describe seera-api --region=europe-west1 --format='value(status.url)'
```
تحقّق من الصحة:
```
GET  https://seera-api-xxxx.a.run.app/api/v1/health          → 200
GET  https://seera-api-xxxx.a.run.app/api/v1/auth/debug?secret=<MIGRATION_SECRET>
```
إن لم تُنشأ الجداول تلقائياً:
```
POST https://seera-api-xxxx.a.run.app/api/v1/auth/run-migrations
Body: {"secret":"<MIGRATION_SECRET>"}
```

---

## 5) انشر الـ Web (بعد الـ API)

مرّر رابط الـ API المنشور (يُدمج في حزمة الواجهة وقت البناء):
```bash
gcloud builds submit --config cloudbuild.web.yaml \
  --substitutions=_REGION=europe-west1,_API_URL=https://seera-api-xxxx.a.run.app
```
ثم اربط CORS: أضف رابط الـ Web إلى سر/متغير `CORS_ORIGINS` في الـ API
(أو اتركه — `*.run.app` مسموح تلقائياً في منطق CORS، لكن تحديده أفضل أمنياً).

---

## 6) تسجيل الدخول الأول

```
Email:    superadmin@seera.local
Password: (قيمة SEED_SUPER_ADMIN_PASSWORD التي ضبطتها في الخطوة 3)
```
> **مهم:** غيّر كلمة المرور بعد أول تسجيل دخول.

---

## 7) النشر التلقائي (اختياري — Trigger على `main`)

```bash
# API
gcloud builds triggers create github \
  --name=seera-api-main \
  --repo-name=seeratech --repo-owner=seerateche \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.api.yaml

# Web (عدّل _API_URL لرابط الـ API الثابت)
gcloud builds triggers create github \
  --name=seera-web-main \
  --repo-name=seeratech --repo-owner=seerateche \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.web.yaml \
  --substitutions=_API_URL=https://seera-api-xxxx.a.run.app
```
بعد ذلك كل دمج في `main` ينشر تلقائياً.

---

## ملخص سريع

| العنصر | القيمة |
|--------|--------|
| Branch للنشر | `main` |
| منصة النشر | Cloud Run (خدمتان: `seera-api` + `seera-web`) |
| منفذ الحاويات | `8080` (يحقنه Cloud Run) |
| الأسرار | Secret Manager (لا شيء داخل الصورة) |
| قاعدة البيانات | Cloud SQL أو رابط خارجي عبر `DATABASE_URL` |
| مسار فحص صحة الـ API | `/api/v1/health` |
| إنشاء الجداول يدوياً | `POST /api/v1/auth/run-migrations` |

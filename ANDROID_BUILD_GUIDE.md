# 📱 Seera Platform — دليل بناء APK الأندرويد

## المتطلبات المسبقة

### 1. Java JDK 17
```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk -y
java -version   # يجب أن تظهر: openjdk 17.x.x

# macOS (Homebrew)
brew install openjdk@17
```

### 2. Android SDK + Build Tools
**الطريقة الأسهل:** ثبّت [Android Studio](https://developer.android.com/studio) — يأتي مع كل شيء.

**أو بدون Android Studio:**
```bash
# تحميل Command Line Tools فقط من:
# https://developer.android.com/studio#command-tools

# بعد التثبيت، أضف للـ .bashrc أو .zshrc:
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/build-tools/34.0.0

# ثبّت المكونات المطلوبة:
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

### 3. Node.js 20+
```bash
# Using NVM (recommended)
nvm install 20
nvm use 20
```

---

## بناء الـ APK (خطوة بخطوة)

### الطريقة السريعة (سكريبت تلقائي)
```bash
cd sira-platform/apps/web
chmod +x build-apk.sh
./build-apk.sh
```

### الطريقة اليدوية

#### الخطوة 1: تثبيت الحزم
```bash
cd sira-platform/apps/web
npm install
```

#### الخطوة 2: بناء React مع Vite
```bash
CAPACITOR_BUILD=true npm run build
# النتيجة: مجلد dist/ جاهز للنقل إلى Android
```

#### الخطوة 3: تهيئة Capacitor
```bash
# تهيئة لأول مرة فقط
npx cap init "Seera Platform" "io.seera.platform.v4" --web-dir dist
```

#### الخطوة 4: إضافة منصة Android
```bash
npx cap add android
# ينشئ مجلد android/ كامل مع مشروع Gradle
```

#### الخطوة 5: مزامنة ملفات الويب
```bash
npx cap sync android
# ينسخ dist/ داخل Android WebView
```

#### الخطوة 6: بناء APK للاختبار (Debug)
```bash
cd android
./gradlew assembleDebug --no-daemon
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ربط الـ APK بالسيرفر

### في التطوير (شبكة محلية)
عدّل `capacitor.config.ts` وأضف IP السيرفر:
```typescript
server: {
  url: 'http://192.168.1.100:3001',  // IP جهاز الـ Backend
  cleartext: true,
}
```
ثم:
```bash
npm run build:cap   # يبني ويزامن تلقائياً
```

### في الإنتاج (Production APK)
الـ APK يتصل بـ URL ثابت. عدّل `src/utils/api.ts`:
```typescript
// بدلاً من proxy
const baseURL = 'https://api.seera.yourdomain.com/api/v1';
```
ثم ابنِ مرة أخرى:
```bash
CAPACITOR_BUILD=true npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

---

## تثبيت APK على الجهاز

### عبر ADB (USB)
```bash
# تفعيل USB Debugging على الهاتف أولاً
adb devices               # تأكد من ظهور الجهاز
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### عبر Android Studio
```bash
npx cap open android
# يفتح Android Studio → Run ▶ على جهازك
```

### توزيع APK مباشرة
انسخ الملف `app-debug.apk` وأرسله للمستخدم.  
يحتاج المستخدم تفعيل "**تثبيت من مصادر غير معروفة**" في إعدادات الهاتف.

---

## بناء Release APK (للإنتاج)

### 1. إنشاء Keystore
```bash
keytool -genkey -v \
  -keystore seera-release.keystore \
  -alias seera \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### 2. إعداد التوقيع
أضف لـ `android/app/build.gradle`:
```groovy
android {
    signingConfigs {
        release {
            storeFile file("../../seera-release.keystore")
            storePassword "YOUR_KEYSTORE_PASSWORD"
            keyAlias "seera"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
}
```

### 3. البناء
```bash
./build-apk.sh --release
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## هيكل المشروع بعد إضافة Capacitor

```
apps/web/
├── src/                    # React source
├── dist/                   # Vite build output
├── android/                # Native Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── assets/www/ # dist/ يُنسخ هنا
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── capacitor.config.ts     # Capacitor settings
├── build-apk.sh            # Build script
└── package.json
```

---

## مشاكل شائعة وحلولها

| المشكلة | الحل |
|---------|------|
| `SDK location not found` | أضف `local.properties` في `android/` مع: `sdk.dir=/path/to/Android/Sdk` |
| شاشة بيضاء في التطبيق | تأكد أن `webDir: 'dist'` في `capacitor.config.ts` وأن Vite بنى بنجاح |
| `CLEARTEXT not permitted` | أضف في `capacitor.config.ts`: `android: { allowMixedContent: true }` |
| الخط العربي لا يظهر | Capacitor WebView يدعم الخطوط المدمجة — تأكد من استخدام Google Fonts |
| الـ API لا يُستجيب | تأكد أن الجهاز والسيرفر على نفس الشبكة (Wi-Fi) أو استخدم HTTPS |

---

## الأوامر السريعة

```bash
# بناء كامل (Vite + Sync)
npm run build:cap

# فتح Android Studio
npm run cap:open

# تشغيل مباشر على جهاز متصل
npm run cap:run

# فقط مزامنة بدون بناء
npm run cap:sync
```

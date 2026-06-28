# ============================================================
# SEERA PLATFORM v4 - Web Dockerfile
# ============================================================

FROM node:20-alpine AS builder

# VITE_API_BASE_URL injection
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

COPY package.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build
RUN npm install --workspace=apps/web --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── Nginx stage ───────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# نسخ الملف الأساسي مباشرة (بدون استخدام الـ template الخطير)
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# تحديد البورت الافتراضي
ENV PORT=80
EXPOSE 80

# فحص الصحة
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://localhost:${PORT}/healthz" || exit 1

# تعديل البورت ديناميكياً باستخدام sed (آمن جداً) وتشغيل السيرفر
CMD /bin/sh -c "sed -i 's/listen 80;/listen '${PORT}';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 1. نسخ ملفات التشغيل الأساسية
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

# 2. 🔥 (التعديل الجذري) نسخ الحزم المشتركة وملفات بناء قاعدة البيانات
COPY --from=builder /app/packages/shared /app/packages/shared
COPY --from=builder /app/apps/api/drizzle ./drizzle
COPY --from=builder /app/apps/api/drizzle.config.ts ./
COPY --from=builder /app/apps/api/seed.ts ./
COPY --from=builder /app/apps/api/src ./src
COPY --from=builder /app/apps/api/tsconfig.json ./

# 3. حل مشكلة الـ EACCES للمسارات
RUN mkdir -p /tmp/streams /tmp/uploads && \
    chown -R node:node /tmp

EXPOSE 3001

# 4. بناء الجداول + حقن الحسابات + تشغيل السيرفر (تلقائياً)
CMD ["sh", "-c", "npx drizzle-kit push:pg && npx ts-node seed.ts && node dist/main.js"]

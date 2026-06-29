# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

# تثبيت أدوات البناء الأساسية
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 1) نسخ ملفات المشروع الأساسية فقط للبدء
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# 2) تنظيف وتثبيت نظيف تماماً بدون الاعتماد على أي ملفات محلية
RUN npm cache clean --force
RUN npm install --legacy-peer-deps

# 3) نسخ باقي كود المصدر
COPY . .

# 4) بناء المشروع
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# 5) حذف المكتبات غير الضرورية (dev dependencies)
RUN npm prune --omit=dev --workspace=apps/api --legacy-peer-deps

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# تثبيت أداة wget للـ Healthcheck
RUN apk add --no-cache wget

# نسخ النواتج فقط
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/drizzle ./drizzle

ENV MIGRATIONS_DIR=/app/drizzle

RUN mkdir -p /tmp/streams /tmp/uploads && chown -R node:node /tmp
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/v1/health" || exit 1

CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]

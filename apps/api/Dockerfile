# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

# تثبيت أدوات البناء الأساسية
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 1) نسخ ملفات المشروع الأساسية فقط للبدء
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
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
RUN npm prune --omit=dev --legacy-peer-deps

# 6) Replace workspace symlink with actual files
RUN rm -rf /app/node_modules/@sira/shared \
    && mkdir -p /app/node_modules/@sira/shared \
    && cp -R /app/packages/shared/dist /app/node_modules/@sira/shared/dist \
    && cp /app/packages/shared/package.json /app/node_modules/@sira/shared/package.json

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# تثبيت أداة wget للـ Healthcheck
RUN apk add --no-cache wget

# نسخ النواتج فقط
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/drizzle ./drizzle

ENV MIGRATIONS_DIR=/app/drizzle

RUN mkdir -p /tmp/streams /tmp/uploads && chown -R node:node /tmp
USER node

# Cloud Run injects PORT (default 8080) and routes traffic to it. main.ts
# reads process.env.PORT, so we default it here and expose the same value.
ENV PORT=8080
EXPOSE 8080

# NOTE: no Docker HEALTHCHECK here on purpose. Cloud Run performs its own
# startup/liveness probe against the injected $PORT. A second internal
# HEALTHCHECK on a hard-coded port can conflict.

# Startup: run DB migrations + seed, THEN start the API — but use ";" (not "&&")
# so the API ALWAYS boots even if migrations fail. This is critical: if the API
# never starts, the platform's startup probe fails and the container is killed
# before any tables can be created. If migrate fails, the app still comes up and
# the tables can be created on demand via POST /api/v1/auth/run-migrations.
# The migrate step is time-boxed so a hanging DB connection can't block boot.
CMD ["sh", "-c", "timeout 60 node dist/database/migrate.js ; node dist/main.js"]

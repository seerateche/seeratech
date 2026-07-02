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

# 5) Skip npm prune to prevent deleting workspace dependencies

# 6) Replace workspace symlink with actual files
RUN rm -rf /app/node_modules/@sira/shared \
    && mkdir -p /app/node_modules/@sira/shared \
    && cp -R /app/packages/shared/dist /app/node_modules/@sira/shared/dist \
    && cp /app/packages/shared/package.json /app/node_modules/@sira/shared/package.json

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app/apps/api
ENV NODE_ENV=production

# تثبيت أداة wget للـ Healthcheck
RUN apk add --no-cache wget

# نسخ النواتج فقط
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/drizzle ./drizzle

# Copy the un-hoisted node_modules if it exists (using a wildcard so it doesn't fail if it doesn't exist)
COPY --from=builder /app/apps/api/node_module[s] ./node_modules

ENV MIGRATIONS_DIR=/app/apps/api/drizzle

RUN mkdir -p /tmp/streams /tmp/uploads && chown -R node:node /tmp
USER node

EXPOSE 3001

# NOTE: no Docker HEALTHCHECK here on purpose.
# Railway performs its OWN external healthcheck (railway.json → healthcheckPath
# = /api/v1/health) against the runtime $PORT it injects. A second internal
# HEALTHCHECK on a hard-coded port can conflict and mark the deploy unhealthy.

# Startup: run DB migrations + seed, THEN start the API — but use ";" (not "&&")
# so the API ALWAYS boots even if migrations fail. This is critical: if the API
# never starts, Railway's healthcheck fails and the container is killed before
# any tables can be created. If migrate fails, the app still comes up and the
# tables can be created on demand via POST /api/v1/auth/run-migrations.
# The migrate step is also time-boxed so a hanging DB connection can't block boot.
CMD ["sh", "-c", "timeout 60 node dist/database/migrate.js ; node dist/main.js"]

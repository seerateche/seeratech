# ============================================================
# SEERA PLATFORM v4 - API Dockerfile (Multi-stage, Production-safe)
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 1) انقل كل الملفات الأول عشان الـ npm يشوف الـ package.json والملفات كلها
COPY . .

# Install native build deps
RUN apk add --no-cache python3 make g++

# 2) تسطيب المكتبات (استخدمنا install بدل ci عشان مشاكل الـ lockfile)
RUN npm install --legacy-peer-deps

# 3) ابني المشروع (تأكد إن Workspace مضبوطة في الـ package.json الرئيسي)
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# 4) تنظيف المكتبات غير الضرورية
RUN npm prune --omit=dev --workspace=apps/api --legacy-peer-deps

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Runtime deps only
RUN apk add --no-cache wget

# Copy built JS output
COPY --from=builder /app/apps/api/dist ./dist

# Copy production node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json

# Copy Drizzle SQL migration files
COPY --from=builder /app/apps/api/drizzle ./drizzle

# Path where the migrator looks for .sql files
ENV MIGRATIONS_DIR=/app/drizzle

# Create writable runtime directories
RUN mkdir -p /tmp/streams /tmp/uploads && chown -R node:node /tmp

# Run as non-root for security
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/v1/health" || exit 1

CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]

# ============================================================
# SEERA PLATFORM v4 - API Dockerfile
# ============================================================
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

# Runtime deps (wget for healthcheck)
RUN apk add --no-cache wget

# 🔥 1. تثبيت أداة tsx لتشغيل السكريبت مباشرة في بيئة الإنتاج
RUN npm install -g tsx

# 2. Copy built app + dependencies
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

# 🔥 3. نسخ مجلد src و tsconfig عشان السيرفر يلاقي ملف migrate.ts
COPY --from=builder /app/apps/api/src ./src
COPY --from=builder /app/apps/api/tsconfig.json ./

# 4. Copy Drizzle migration SQL files for programmatic migrator
COPY --from=builder /app/apps/api/drizzle ./drizzle

# Tell the migration script where to find the SQL files
ENV MIGRATIONS_DIR=/app/drizzle

# 5. Create runtime directories with correct permissions
RUN mkdir -p /tmp/streams /tmp/uploads && \
    chown -R node:node /tmp

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s \
  --start-period=60s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/v1/health" || exit 1

# 🔥 6. تشغيل ملف الداتا بيز بـ tsx ثم تشغيل السيرفر الرئيسي
CMD ["sh", "-c", "tsx src/database/migrate.ts && node dist/main.js"]

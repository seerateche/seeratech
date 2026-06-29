# ============================================================
# SEERA PLATFORM v4 - API Dockerfile (Multi-stage, Production-safe)
# Build context: repository root
#   docker build -f apps/api/Dockerfile .
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install native build deps (needed by some npm packages)
RUN apk add --no-cache python3 make g++

# 1) Install ALL dependencies using root workspace config

RUN npm ci --legacy-peer-deps

# 2) Copy source files
COPY apps/api ./apps/api

# 3) #    This compiles migrate.ts → dist/database/migrate.js
#    and main.ts → dist/main.js via nest build
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# 4) Prune dev dependencies for production
RUN npm prune --omit=dev --workspace=apps/api --legacy-peer-deps

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Runtime deps only
RUN apk add --no-cache wget

# Copy built JS output (includes dist/database/migrate.js)
COPY --from=builder /app/apps/api/dist ./dist

# Copy production node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json

# Copy Drizzle SQL migration files (read at runtime by the migrator)
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

# Step 1: node dist/database/migrate.js — runs migrations + seed (no ts-node, no tsx, no drizzle-kit CLI)
# Step 2: node dist/main.js             — starts NestJS application
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]

# ============================================================
# SEERA PLATFORM v4 - API Dockerfile (Multi-stage)
# Build context MUST be the repository root:
#   docker build -f apps/api/Dockerfile .
# (Railway sets this automatically when "dockerfilePath" points here.)
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build deps (native modules + ffmpeg for media tooling)
RUN apk add --no-cache python3 make g++ ffmpeg

# 1) Build the shared package first. The API depends on it via
#    "@sira/shared": "file:../../packages/shared", which npm turns into a
#    symlink. We build its dist here so the symlink target is valid.
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY packages/shared/src ./packages/shared/src
RUN cd packages/shared \
    && npm install --no-audit --no-fund \
    && npm run build

# 2) Install API dependencies (manifests first for better layer caching).
#    The root package.json is deliberately NOT installed here: its
#    `postinstall` runs `cap add android`, which is irrelevant to (and
#    breaks) a server-only build.
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/package-lock.json ./apps/api/package-lock.json
RUN cd apps/api \
    && npm install --no-audit --no-fund --legacy-peer-deps

# 3) Copy API source and build it.
COPY apps/api/ ./apps/api/
RUN cd apps/api && npm run build

# 4) Prune dev dependencies to slim down node_modules for production.
RUN cd apps/api && npm prune --omit=dev --legacy-peer-deps

# 5) Replace the @sira/shared symlink with a REAL copy so the production
#    stage does not depend on a relative symlink target. This makes
#    `require("@sira/shared")` resolve directly inside node_modules.
RUN rm -rf /app/apps/api/node_modules/@sira/shared \
    && mkdir -p /app/apps/api/node_modules/@sira/shared \
    && cp -R /app/packages/shared/dist /app/apps/api/node_modules/@sira/shared/dist \
    && cp /app/packages/shared/package.json /app/apps/api/node_modules/@sira/shared/package.json

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Runtime deps only (ffmpeg for media, wget/curl for healthcheck)
RUN apk add --no-cache ffmpeg wget curl

# Copy the built API + its production node_modules (with real @sira/shared).
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json

# Create required runtime directories
RUN mkdir -p /app/streams /app/uploads && chmod 755 /app/streams /app/uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S sira -u 1001 \
    && chown -R sira:nodejs /app
USER sira

# Railway provides $PORT; the app falls back to 3001 locally.
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/v1/health" || exit 1

CMD ["node", "dist/main.js"]

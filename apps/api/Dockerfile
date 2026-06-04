# ============================================================
# SEERA PLATFORM v4 - API Dockerfile (Multi-stage)
# ============================================================

# ── Stage 1: Builder ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ ffmpeg

# Copy workspace files
COPY package.json ./
# Railway often doesn't have a root lockfile if it's not generated, 
# so we'll use npm install which will create one if needed.
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all deps using the workspace feature
RUN npm install --workspace=apps/api --workspace=packages/shared

# Build shared package first
RUN cd packages/shared && npx tsc --declaration --outDir dist 2>/dev/null || true

# Build API
RUN cd apps/api && npm run build

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache ffmpeg wget curl

# Copy built artifacts and necessary package files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
# Instead of relying on a potentially missing lockfile, we'll just install production deps
# Since we are in a flat structure now, we need to make sure shared package is handled or bundled.
# For NestJS, usually the dist contains what's needed, but let's copy the node_modules 
# from builder to be safe, or just install them.
COPY --from=builder /app/node_modules ./node_modules

# Create required directories
RUN mkdir -p /app/streams /app/uploads && chmod 755 /app/streams /app/uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S sira -u 1001
RUN chown -R sira:nodejs /app
USER sira

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/main.js"]

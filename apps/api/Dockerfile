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
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all deps
RUN npm install --workspace=apps/api --workspace=packages/shared

# Build shared package first
RUN cd packages/shared && npx tsc --declaration --outDir dist 2>/dev/null || true

# Build API
RUN cd apps/api && npm run build

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache ffmpeg wget curl

# Copy built artifacts and package files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/package-lock.json ./package-lock.json

# Install production dependencies cleanly (non-workspace layout)
RUN npm ci --omit=dev

# Create required directories
RUN mkdir -p /app/streams /app/uploads && chmod 755 /app/streams /app/uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S sira -u 1001
RUN chown -R sira:nodejs /app
USER sira

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/main.js"]

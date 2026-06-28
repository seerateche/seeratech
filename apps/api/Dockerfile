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

# 1. Copy built app + dependencies
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

# 2. Copy Drizzle migration SQL files for programmatic migrator
COPY --from=builder /app/apps/api/drizzle ./drizzle

# Tell the migration script where to find the SQL files
ENV MIGRATIONS_DIR=/app/drizzle

# 3. Create runtime directories with correct permissions
RUN mkdir -p /tmp/streams /tmp/uploads && \
    chown -R node:node /tmp

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/v1/health" || exit 1

# Run programmatic migrations + seed THEN start the NestJS app.
# No drizzle-kit CLI, no ts-node, no interactive prompts.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]

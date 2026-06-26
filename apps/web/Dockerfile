# ============================================================
# SEERA PLATFORM v4 - Web Dockerfile
# ============================================================

FROM node:20-alpine AS builder

# Use VITE_API_BASE_URL as per the code in src/utils/api.ts
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

# Copy root workspace config first (npm workspaces needs these)
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build
RUN npm install --workspace=apps/web --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── Nginx stage ───────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# Copy as a template — envsubst replaces ${API_UPSTREAM} at runtime
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template

# Default API_UPSTREAM for Railway private networking.
# Override via Railway Variables or docker-compose environment.
ENV API_UPSTREAM=api.railway.internal:3001

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:80 || exit 1

# nginx:alpine's docker-entrypoint auto-runs envsubst on /etc/nginx/templates/
CMD ["nginx", "-g", "daemon off;"]


# ============================================================
# SEERA PLATFORM v4 - Web Dockerfile
# ============================================================

FROM node:20-alpine AS builder

# Inject API URL at build time so Vite can embed it in the bundle
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

# Copy workspace manifests (root + shared + web) for better layer caching
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install and build
RUN npm install --workspace=apps/web --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── Nginx production stage ────────────────────────────────
FROM nginx:alpine

# Copy built SPA assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config (includes /healthz endpoint for Railway)
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Railway healthcheck hits /healthz which nginx answers with 200 OK
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

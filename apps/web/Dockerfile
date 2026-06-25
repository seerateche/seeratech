# ============================================================
# SEERA PLATFORM v4 - Web Dockerfile
# ============================================================

FROM node:20-alpine AS builder

# Use VITE_API_BASE_URL as per the code in src/utils/api.ts
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

COPY package.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build
RUN npm install --workspace=apps/web --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── Nginx stage ───────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Use a templated config so nginx listens on Railway's injected $PORT.
# nginx:alpine auto-processes templates in /etc/nginx/templates/*.template
# via envsubst at container start, writing the result to /etc/nginx/conf.d/.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template

# Default for local/docker runs; Railway overrides PORT at runtime.
ENV PORT=80
EXPOSE 80

# Health check hits the lightweight /healthz endpoint on the active port.
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://localhost:${PORT}/healthz" || exit 1

CMD ["nginx", "-g", "daemon off;"]

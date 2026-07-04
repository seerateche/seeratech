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

# Copy nginx TEMPLATE. At container start we substitute ${PORT} (Cloud Run
# injects PORT=8080; local/other default to 80) then launch nginx. This is
# required for Cloud Run, which routes traffic to the port it chooses.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template

# Default port when the platform does not inject one.
ENV PORT=8080
EXPOSE 8080

# Render the template with the runtime $PORT, then run nginx in the foreground.
# (nginx:alpine ships /docker-entrypoint.d scripts that run envsubst on
# /etc/nginx/templates/*.template, but we do it explicitly to be port-safe.)
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

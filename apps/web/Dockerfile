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
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]

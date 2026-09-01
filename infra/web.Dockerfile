# Brewbook web — Vite build, then nginx serving the static bundle only. All data comes from the
# API through oauth2-proxy; nginx never proxies anything itself.
FROM node:22-alpine AS build
WORKDIR /app
COPY services/web/package.json services/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY services/web ./
RUN npm run build

FROM nginx:1.27-alpine
# nginx's image renders /etc/nginx/templates/*.template with envsubst at start, which is how $PORT
# (injected by Railway) reaches the listen directive.
COPY infra/web.nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

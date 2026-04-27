# ===== BUILD FRONTEND =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app

ENV VITE_API_URL=""

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ===== BUILD BACKEND =====
FROM node:20-alpine AS backend-builder
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ .
RUN npx prisma generate
RUN npx tsc

# ===== RUNTIME =====
FROM node:20-alpine
RUN apk add --no-cache nginx supervisor

# Nginx
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Backend
WORKDIR /app/server
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/prisma ./prisma
COPY server/package.json ./

# Supervisord para rodar Nginx + Node juntos
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisord.conf"]

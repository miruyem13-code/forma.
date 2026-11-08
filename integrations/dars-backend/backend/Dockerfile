FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci
COPY backend ./backend
RUN npm run db:generate
RUN npm prune --omit=dev
ENV NODE_ENV=production
WORKDIR /app/backend
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]

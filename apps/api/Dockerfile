# API do Portal Raphael Lima (Fastify + Prisma) para Railway, Render ou Fly.io.
# Contexto do build: apps/api. As migrações rodam antes de cada deploy (railway.json).
FROM node:22-bookworm-slim

# git: a Engenharia faz clone raso dos repositórios em .repos
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.27.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production TZ=America/Sao_Paulo HOST=0.0.0.0
EXPOSE 3333
CMD ["node", "dist/server.js"]

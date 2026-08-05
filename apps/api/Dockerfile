# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma no Alpine (musl) precisa do OpenSSL para detectar/rodar o query engine.
RUN apk add --no-cache openssl

# Instala TODAS as dependências do monorepo (workspaces) — install simples e robusto.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install

# Copia o restante do código (node_modules/dist ficam de fora via .dockerignore)
COPY . .

# Gera o Prisma Client e compila a API
RUN npm run api:prisma:generate
RUN npm run api:build

# ─── Runtime stage ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Copia dependências resolvidas + artefatos de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3333

# Aplica migrações (obrigatório) e sobe a API. O seed é best-effort: nunca
# bloqueia o start — se falhar, apenas loga e a aplicação sobe mesmo assim.
CMD ["sh", "-c", "npx prisma migrate deploy && (npx ts-node --transpile-only prisma/seed.ts || echo '[boot] seed falhou, seguindo') && node dist/main.js"]

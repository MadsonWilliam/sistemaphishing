# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma no Alpine (musl) precisa do OpenSSL para detectar/rodar o query engine.
RUN apk add --no-cache openssl

# Instala TODAS as dependências do monorepo (workspaces) — install simples e robusto.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm install

# Copia o restante do código (node_modules/dist ficam de fora via .dockerignore)
COPY . .

# Gera o Prisma Client e compila API + front (SPA)
RUN npm run api:prisma:generate
RUN npm run web:build
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
# Build do front (servido pelo NestJS na mesma origem)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/api
EXPOSE 3333

# Migrate bloqueia (falha de migração deve barrar o boot); o seed é best-effort
# (nunca derruba a API). ts-node --transpile-only para ser leve no boot.
CMD ["sh", "-c", "npx prisma migrate deploy && (npx ts-node --transpile-only prisma/seed.ts || echo '[boot] seed falhou, seguindo') && node dist/main.js"]

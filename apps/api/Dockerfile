# ─── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependências usando o lockfile do monorepo
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace @phish/api --include-workspace-root

# Copia o código e gera o Prisma Client + build
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app/apps/api
ENV NODE_ENV=production

# Copia node_modules já resolvidos e artefatos de build
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 3333

# Aplica migrações, garante o super admin (idempotente) e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/main.js"]

# Sistema de Simulação de Phishing (SaaS)

Plataforma de **simulação de phishing e conscientização** para empresas. Dispara
campanhas de e-mail simuladas aos funcionários, registra quem clica/abre anexo/
submete formulário e gera relatórios executivos com boas práticas e evolução.

> ⚖️ **Uso autorizado apenas.** Nenhuma campanha roda sem uma autorização
> (`AuthorizationConsent`) aceita e vigente da empresa-alvo. A página de captura
> **nunca** armazena senhas reais — vira um momento educativo.

## Stack

- **API:** NestJS 10 + TypeScript, JWT (access + refresh), RBAC 3 papéis
- **Banco:** PostgreSQL via Prisma
- **Fila (Sprint 1+):** Redis + BullMQ
- **Frontend (Sprint 4+):** React + Vite + ECharts
- **Deploy:** Docker / EasyPanel

## Estrutura

```
apps/
  api/            # backend NestJS
    prisma/       # schema + migrações + seed
    src/
      auth/       # login, refresh, RBAC
      companies/  # tenants
      common/     # guards, decorators
      health/     # /api/health
docker-compose.yml
```

## Rodando localmente

Pré-requisitos: Node 18.18+ (recomendado 20 LTS) e um PostgreSQL acessível.

```bash
# 1. Instalar dependências (na raiz do monorepo)
npm install

# 2. Configurar ambiente
cp .env.example .env   # edite os segredos e a DATABASE_URL

# 3. Gerar o Prisma Client e aplicar o schema
npm run api:prisma:generate
cd apps/api && npx prisma migrate dev --name init && cd ../..

# 4. Criar o super admin
npm run api:seed

# 5. Subir a API em modo dev
npm run api:dev
# API: http://localhost:3333/api  |  Health: http://localhost:3333/api/health
```

Com Docker (sobe Postgres + Redis + API):

```bash
docker compose up --build
```

## Deploy no EasyPanel

1. Crie um serviço **App** apontando para este repositório (GitHub) ou envie o zip.
2. Build via `apps/api/Dockerfile` (contexto = raiz do repo).
3. Configure as variáveis de ambiente (veja `.env.example`), com a `DATABASE_URL`
   do Postgres já existente no EasyPanel.
4. A porta interna é **3333**. As migrações rodam sozinhas no start
   (`prisma migrate deploy`).
5. Após o primeiro deploy, rode o seed uma vez: `npm run seed` no console do serviço.

## Endpoints (Sprint 0)

| Método | Rota | Acesso |
|---|---|---|
| GET  | `/api/health` | público |
| POST | `/api/auth/login` | público |
| POST | `/api/auth/refresh` | público |
| POST | `/api/auth/logout` | autenticado |
| GET  | `/api/auth/me` | autenticado |
| POST | `/api/auth/change-password` | autenticado |
| POST | `/api/companies` | SUPER_ADMIN |
| GET  | `/api/companies` | SUPER_ADMIN |
| GET  | `/api/companies/:id` | dono da empresa ou SUPER_ADMIN |
| POST | `/api/sending-domains` | SUPER_ADMIN |
| GET  | `/api/sending-domains` | SUPER_ADMIN |
| PATCH | `/api/sending-domains/:id` | SUPER_ADMIN |
| DELETE | `/api/sending-domains/:id` | SUPER_ADMIN |
| DELETE | `/api/sending-domains/:id/identities/:identityId` | SUPER_ADMIN |
| POST | `/api/sending-domains/:id/verify` | SUPER_ADMIN |
| POST | `/api/sending-domains/:id/identities` | SUPER_ADMIN |
| GET  | `/api/sending-domains/:id/identities` | SUPER_ADMIN |
| POST | `/api/sending-domains/:id/test` | SUPER_ADMIN |
| POST | `/api/outbox/drip-test` | SUPER_ADMIN |
| GET  | `/api/outbox` | SUPER_ADMIN |
| GET  | `/api/outbox/stats` | SUPER_ADMIN |

## Roadmap

- **Sprint 0:** fundação — auth, RBAC, tenants, health, Docker ✅
- **Sprint 1 (atual):** domínios de e-mail (SMTP plugável por domínio, credenciais
  cifradas AES-256-GCM), identidades de remetente, outbox no Postgres com
  agendador gota-a-gota (jitter + retry/backoff), sem Redis ✅
- **Sprint 2:** tokens únicos, tracking, landing educativa configurável
- **Sprint 3:** editor de e-mail + biblioteca de templates por setor
- **Sprint 4:** dashboard interativa (cross-filter, tempo real)
- **Sprint 5:** relatórios executivos + boas práticas + evolução
- **Sprint 6:** landing page comercial + captação de leads
- **Sprint 7:** hardening (LGPD, RLS, auditoria, entregabilidade)

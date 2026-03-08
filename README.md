# CRM JJSul — Atendimento por Setores

MVP funcional de um **CRM interno para empresa de transportes**, com:

- autenticação com email/senha
- recuperação de senha por email (Supabase Auth)
- RBAC por papel (atendente, gerente, admin)
- isolamento de dados por setor (departamento)
- inbox de conversas com timeline
- dashboard com métricas operacionais
- automações de lembrete com fila (BullMQ + Redis)

---

## 1) Arquitetura do projeto

### Visão geral

Arquitetura em camadas dentro de um monolito Next.js:

1. **UI (App Router + React)**
   - páginas de login, dashboard, conversas, clientes, usuários, setores e automações.
2. **API (Route Handlers)**
   - autenticação, CRUDs e métricas.
3. **Domínio/Serviços**
   - RBAC, sessão, logging de ações, scheduler de lembretes.
4. **Persistência**
   - PostgreSQL via Prisma ORM.
5. **Fila assíncrona**
   - Redis + BullMQ + worker dedicado para envio de lembretes.

### Fluxo principal

1. Usuário autentica em `/api/auth/login` (credenciais validadas via Supabase Auth + sessão HTTP-only para RBAC interno).
2. Middleware protege rotas privadas.
3. APIs aplicam regras RBAC por papel e setor.
4. Ao mudar status da conversa para um gatilho (ex.: `QUOTE_SENT`), o sistema cria `ReminderLog` e agenda job na fila.
5. Worker processa o job, valida status atual e publica mensagem automática na timeline.

---

## 2) Estrutura de pastas

```bash
.
├── docker-compose.yml
├── prisma
│   ├── schema.prisma
│   └── seed.ts
├── src
│   ├── app
│   │   ├── (auth)
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (protected)
│   │   │   ├── automations/page.tsx
│   │   │   ├── conversations/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── departments/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api
│   │   │   ├── auth/*
│   │   │   ├── automations/*
│   │   │   ├── conversations/*
│   │   │   ├── customers/*
│   │   │   ├── dashboard/metrics/*
│   │   │   ├── departments/*
│   │   │   └── users/*
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── auth/*
│   │   ├── automations/*
│   │   ├── conversations/*
│   │   ├── customers/*
│   │   ├── departments/*
│   │   ├── layout/*
│   │   ├── users/*
│   │   └── common/*
│   ├── lib
│   │   ├── activity-log.ts
│   │   ├── api-auth.ts
│   │   ├── auth.ts
│   │   ├── constants.ts
│   │   ├── current-user.ts
│   │   ├── env.ts
│   │   ├── http.ts
│   │   ├── prisma.ts
│   │   ├── queue.ts
│   │   ├── rbac.ts
│   │   ├── reminders.ts
│   │   ├── session.ts
│   │   ├── supabase.ts
│   │   └── supabase-browser.ts
│   └── workers
│       └── reminder-worker.ts
├── middleware.ts
└── package.json
```

---

## 3) Schema do banco (Prisma/PostgreSQL)

Arquivo completo: `prisma/schema.prisma`

### Entidades principais

- **User**
  - `id`, `name`, `email`, `authUserId`, `role`, `departmentId`, timestamps
- **Department**
  - `id`, `name`, timestamps
- **Customer**
  - `id`, `name`, `phone`, `email`, `company`, `notes`, timestamps
- **Conversation**
  - `id`, `customerId`, `departmentId`, `assignedToId`, `status`, `createdAt`, `lastMessageAt`
- **Message**
  - `id`, `conversationId`, `senderId`, `senderType`, `content`, `createdAt`
- **AutomationRule**
  - `id`, `triggerStatus`, `delayHours`, `messageTemplate`, `isActive`, `departmentId`
- **ReminderLog**
  - `id`, `conversationId`, `ruleId`, `scheduledFor`, `sentAt`, `status`

### Entidades de suporte

- **ActivityLog** (auditoria/log de ações)

### Enums

- `Role`: `ATTENDANT | MANAGER | ADMIN`
- `ConversationStatus`: `OPEN | WAITING | CLOSED | QUOTE_SENT`
- `SenderType`: `USER | SYSTEM`

---

## 4) Principais endpoints

### Auth

- `POST /api/auth/login` — login
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — sessão atual
- `POST /api/auth/forgot-password` — envia fluxo de recuperação do Supabase
- `POST /api/auth/reset-password` — endpoint informativo (reset é concluído via Supabase)

### Departamentos

- `GET /api/departments` — lista setores (escopo por perfil)
- `POST /api/departments` — cria setor (admin)
- `PUT /api/departments/:id` — atualiza setor (admin)
- `DELETE /api/departments/:id` — remove setor (admin)

### Usuários

- `GET /api/users` — lista usuários (escopo por perfil)
- `POST /api/users` — cria usuário (admin)
- `PUT /api/users/:id` — atualiza usuário (admin)

### Clientes

- `GET /api/customers` — lista clientes
- `POST /api/customers` — cria cliente
- `GET /api/customers/:id` — detalha cliente
- `PUT /api/customers/:id` — edita cliente

### Conversas

- `GET /api/conversations` — inbox por setor/RBAC
- `POST /api/conversations` — abre atendimento
- `GET /api/conversations/:id` — detalhe com timeline
- `PATCH /api/conversations/:id` — atualiza status/responsável/setor
- `POST /api/conversations/:id/messages` — envia mensagem

### Automações

- `GET /api/automations` — lista regras
- `POST /api/automations` — cria regra (manager/admin)
- `PATCH /api/automations/:id` — atualiza regra
- `DELETE /api/automations/:id` — remove regra

### Dashboard

- `GET /api/dashboard/metrics`
  - atendimentos abertos
  - atendimentos por setor
  - tempo médio de resposta
  - clientes ativos

---

## 5) Exemplos de componentes

### Inbox estilo CRM

- `src/components/conversations/inbox.tsx`
  - painel esquerdo com lista de conversas
  - painel direito com timeline e envio de resposta
  - alteração de status com disparo de automação via API

### Layout com sidebar por papel

- `src/components/layout/sidebar.tsx`
  - navegação por módulos
  - controle de links extras para admin
  - sessão do usuário + logout

### Gestão de entidades

- `src/components/customers/customers-manager.tsx`
- `src/components/users/users-manager.tsx`
- `src/components/departments/departments-manager.tsx`
- `src/components/automations/automations-manager.tsx`

---

## 6) Instruções de execução

## Pré-requisitos

- Node.js 20+
- Docker (recomendado para Postgres + Redis)

### 1. Instalar dependências

```bash
npm install
```

### 2. Subir infraestrutura local

```bash
docker compose up -d
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Configure no `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Banco de dados (schema + seed)

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

> A seed cria os usuários no banco interno (RBAC), mas **não cria credenciais no Supabase Auth**.
> Crie os mesmos emails no Supabase (Dashboard > Authentication > Users) ou via endpoint de criação de usuários (admin) na aplicação.

### 5. Rodar app web

```bash
npm run dev
```

Aplicação: `http://localhost:3000`

### 6. Rodar worker de automação (em outro terminal)

```bash
npm run worker
```

---

## Usuários seed (MVP - RBAC interno)

- **Admin**
  - `admin@jjsul.com`
- **Gerente (Vendas)**
  - `gerente.vendas@jjsul.com`
- **Atendente (Vendas)**
  - `atendente.vendas@jjsul.com`

As senhas passam a ser gerenciadas pelo **Supabase Auth**.

---

## Observações de evolução

- Integrar provedor real de email/SMS/WhatsApp para notificações.
- Adicionar testes E2E (Playwright) e observabilidade (Sentry/OpenTelemetry).
- Evoluir métricas com histórico temporal e SLA por setor.


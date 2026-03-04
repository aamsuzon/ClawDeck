# ClawDeck

Local-first Mission Control UI for PicoClaw.

ClawDeck helps non-CLI users operate PicoClaw through a visual dashboard with safe controls.

## Core Features

1. Gateway health and workspace status dashboard
2. Session timeline viewer (messages + tool calls)
3. No-CLI action panel (agent message + cron controls)
4. Config Studio with secret-masked safe view
5. High-risk action confirmation for restart/config updates

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Zod validation
- Node bridge routes for PicoClaw CLI/file adapters

## Requirements

1. Windows machine with PicoClaw installed (`C:\picoclaw\picoclaw.exe`)
2. PicoClaw workspace in `C:\Users\<you>\.picoclaw\workspace`
3. Node.js 20+

## Local Run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Implemented Bridge APIs

1. `GET /api/bridge/health`
2. `GET /api/bridge/sessions`
3. `GET /api/bridge/sessions/:id`
4. `GET /api/bridge/cron`
5. `POST /api/bridge/cron`
6. `PATCH /api/bridge/cron/:id`
7. `POST /api/bridge/agent/message`
8. `GET /api/bridge/config/safe`
9. `PUT /api/bridge/config/safe`
10. `GET /api/bridge/gateway`
11. `POST /api/bridge/gateway`

## Security Notes

1. Bridge executes CLI through `execFile` with strict argument paths.
2. Config response is redacted for secret-like keys.
3. High-risk operations require explicit UI confirmation.

## Planning Files

- `00_MASTER_PLAN.md`
- `01_PRODUCT_SPEC.md`
- `02_SYSTEM_ARCHITECTURE.md`
- `03_IMPLEMENTATION_BACKLOG.md`
- `04_TEST_ACCEPTANCE_PLAN.md`
- `05_RELEASE_RUNBOOK.md`
- `06_GITHUB_GROWTH_PLAYBOOK_PUBLIC.md`
- `07_DECISION_LOG.md`
- `08_RISK_REGISTER.md`

Private strategy docs are stored in `.private/` and are ignored by git.

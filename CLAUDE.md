# CLAUDE.md — VapeHard Minsk

Telegram Mini App shop + grammY bot. pnpm workspaces + Turborepo. Full spec: `claude-code-prompt.md` (outside repo) → summarized in `docs/`.

## Commands

```bash
pnpm install
pnpm db:up                 # Postgres + MinIO for local dev (docker-compose.dev.yml)
pnpm --filter @vapehard/db migrate:dev   # create/apply migration (dev only)
pnpm --filter @vapehard/db seed
pnpm dev                   # all apps (turbo)
pnpm lint | pnpm typecheck | pnpm test | pnpm build
docker compose up --build  # full stack
```

## Folder map

- `apps/api` Hono API: `src/routes` (HTTP only) → `src/services` (logic, deps injected) → Prisma.
- `apps/bot` grammY bot + outbox worker. Texts in `src/messages.ru.ts`.
- `apps/web` React Mini App. `src/app` (router, providers), `src/features/*`, `src/shared/{ui,lib}`.
- `packages/shared` zod schemas, DTO types, constants, pure domain functions (no I/O).
- `packages/db` Prisma schema, migrations, seed, client.
- `packages/config` tsconfig / eslint / prettier presets.
- `docker/` Dockerfiles + Caddyfile. `docs/` plan, assumptions, progress, ADRs.

## Code rules

- TS strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No `any`, no `@ts-ignore`, no `!` without a comment.
- Money = integer kopecks (`*Minor`). Never floats.
- Server is the authority for price, stock, role, promo validity. Client values are display only.
- Multi-step writes in one transaction. Side effects (Telegram) only via `OutboxMessage`.
- Time and randomness are injected into services.
- Logs via `pino`, never `console.log`. Never log tokens or full `initData`.
- User-facing text Russian; code, comments, docs, commits English. Conventional Commits.
- Feature folders, not type folders. No abstraction before the third repeat.
- Local imports in Node packages use `.js` extensions (NodeNext).

## Never do

- Never `prisma db push` outside local experiments. Migrations only.
- Never store business data in `localStorage` (cart only).
- Never commit secrets or the original prototype HTML.
- Never call Telegram from API handlers.
- Never mark a phase done while lint/typecheck/test are red.
- Do not upgrade TypeScript past 6.0.x or ESLint past 9.x until typescript-eslint / jsx-a11y support them.

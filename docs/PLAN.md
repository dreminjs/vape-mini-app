# Plan

Source of truth: `claude-code-prompt.md` (build prompt) and `docs/prototype/NOTES.md`.

## Phases

| #   | Phase          | Output                                                                                             |
| --- | -------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Foundation     | pnpm + Turborepo, shared configs, CLAUDE.md, ESLint/Prettier/Husky, CI skeleton, `packages/shared` |
| 2   | Database       | Prisma schema, first migration, seed, `docker-compose.dev.yml`                                     |
| 3   | API core       | Hono app, errors, logging, health, `initData` auth, admin guard, catalog, config                   |
| 4   | Orders         | cart validate, checkout transaction, idempotency, status machine, outbox                           |
| 5   | Roulette       | state + spin, cooldown under concurrency, rewards                                                  |
| 6   | Admin API      | product CRUD, variants, stock ledger, audit log, analytics, presigned upload                       |
| 7   | Bot            | commands, webhook/polling, outbox worker                                                           |
| 8   | Web foundation | Vite, Tailwind tokens, router, query client, API client, Telegram + mock, age gate                 |
| 9   | Web customer   | catalog, product, cart, checkout, orders, roulette, profile                                        |
| 10  | Web admin      | stock, product form, orders, finance, odds                                                         |
| 11  | Docker         | Dockerfiles, Caddy edge, migrate + minio-init jobs                                                 |
| 12  | Polish         | README, ADRs, a11y, bundle size                                                                    |

## Risks

- **Slow internet** on the dev machine: large installs and Docker pulls may fail. Mitigation: install in background, retry.
- **Concurrency tests** need a real Postgres. Mitigation: integration tests run against `docker-compose.dev.yml` DB (separate test database), skipped with a clear message when DB is not reachable.
- **Presigned URLs through a proxy**: host must match. Mitigation: two S3 endpoints (internal / public), see ADR.
- **Telegram requires HTTPS** for Mini Apps. Mitigation: Caddy in prod, tunnel in dev, browser mock for UI work.
- **Library API drift** (Prisma 6/7, React Router 7, Tailwind 4, grammY). Mitigation: check docs before use.

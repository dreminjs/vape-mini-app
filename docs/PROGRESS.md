# Progress

## Done

- Phase 1 — Foundation: pnpm 12 + Turborepo, shared configs, CLAUDE.md, ESLint/Prettier/Husky/commitlint, CI, `packages/shared` (100% coverage).
- Phase 2 — Database: Prisma 7 schema, migrations (CHECK stock >= 0, order numbers from 1001), seed, dev compose (Postgres + Chainguard MinIO).
- Phases 3–6 — API: Hono app, initData auth, admin guard, catalog, cart validate, checkout transaction, idempotency, status machine, cancel/restock, roulette with row lock, admin CRUD, stock ledger, audit log, analytics, presigned POST. 48 integration tests on real Postgres (incl. races).
- Phase 7 — Bot: commands, webhook/polling, outbox worker (SKIP LOCKED, backoff, no retry on 403). 11 tests.
- Phases 8–10 — Web: Mini App customer + admin UI, Telegram integration with dev mock, RTL + MSW tests (7), initial JS 173 KB gzip.
- Phase 11 — Docker: multi-stage Dockerfiles (`pnpm deploy`, non-root, digest-pinned bases), Caddy edge with CSP/HSTS, migrate + MinIO init jobs, full compose.
- Phase 12 — README, ADRs 0001–0007.

## Test totals

shared 41 · db 3 · api 48 · bot 11 · web 7 = **110 tests**. lint / typecheck / build green.

## Known limitations

- Rate limiting is in-memory: correct for one API instance only.
- A real Telegram run (bot token, domain, HTTPS) was not done in this environment; the manual smoke test in the README must be run by the owner.
- `INIT_DATA_MAX_AGE_SECONDS` (1 h): a Mini App left open longer gets 401 and must be reopened.
- MinIO comes from Chainguard images (official images were removed); MinIO upstream is archived.
- Deleting a variant also deletes its stock ledger rows (order items keep their snapshot).
- TypeScript pinned to 6.0.x and ESLint to 9.x (peer ranges of typescript-eslint and jsx-a11y).

## Backlog

- Image thumbnails with `sharp` (currently the original image is served).
- Playwright E2E for the checkout flow with the Telegram mock.
- Redis (or Postgres) store for rate limits when scaling the API horizontally.
- Admin UI for roulette prizes (now read-only; change weights in the DB).
- Customer-facing order cancellation (now admin only).
- Coverage reporting for service-layer code in CI.
- Consider Garage/SeaweedFS instead of MinIO long-term.

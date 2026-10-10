# Progress

## Done

- Phase 1 — Foundation: pnpm 12 + Turborepo, shared configs, CLAUDE.md, ESLint/Prettier/Husky/commitlint, CI, `packages/shared` (100% coverage).
- Phase 2 — Database: Prisma 7 schema, migrations (CHECK stock >= 0, order numbers from 1001), seed, dev compose (Postgres + Chainguard MinIO).
- Phases 3–6 — API: Hono app, initData auth, admin guard, catalog, cart validate, checkout transaction, idempotency, status machine, cancel/restock, roulette with row lock, admin CRUD, stock ledger, audit log, analytics, presigned POST. 48 integration tests on real Postgres (incl. races).
- Phase 7 — Bot: commands, webhook/polling, outbox worker (SKIP LOCKED, backoff, no retry on 403). 11 tests.
- Phases 8–10 — Web: Mini App customer + admin UI, Telegram integration with dev mock, RTL + MSW tests (7), initial JS 173 KB gzip.

## Test totals

shared 41 · db 3 · api 48 · bot 11 · web 7 = **110 tests**, all green. lint / typecheck / build green.

## Next

- Phase 11 — Docker (Dockerfiles, Caddy edge, full compose).
- Phase 12 — README, ADRs, polish.

## Known issues

- TypeScript pinned to 6.0.x and ESLint to 9.x (peer ranges of typescript-eslint and jsx-a11y).

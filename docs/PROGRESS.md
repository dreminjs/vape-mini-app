# Progress

## Done

- Phase 1 — Foundation: pnpm 12 + Turborepo, shared configs, CLAUDE.md, ESLint/Prettier/Husky/commitlint, CI, `packages/shared` (100% coverage).
- Phase 2 — Database (code): Prisma 7 schema, init migration (generated offline + CHECK stock >= 0, order numbers from 1001), seed, dev compose.
- Phases 3–6 — API (code): Hono app, initData auth, admin guard, catalog, cart validate, checkout transaction, idempotency, status machine, cancel/restock, roulette with row lock, admin CRUD, stock ledger, audit log, analytics, presigned POST.

## Pending verification

- Integration tests (`apps/api/test`) and the migration were **not yet run**: Docker Desktop engine was down. Run `pnpm db:up` then `pnpm --filter @vapehard/api test`.

## Next

- Phase 7 — Bot.

## Known issues

- TypeScript pinned to 6.0.x and ESLint to 9.x (peer ranges of typescript-eslint and jsx-a11y).

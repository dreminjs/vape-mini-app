# Hono RPC for end-to-end types

Status: accepted (2026-10-10)

## Context

The web app needs typed API calls without a code generator.

## Decision

Use Hono route chaining and export `AppType` from `apps/api`. The web uses `hc<AppType>()`. The API package emits `.d.ts` files and the web imports only types from it (no server code in the bundle).

## Consequences

Request and response types stay in sync at compile time. Routes must be chained (`new Hono().get().post()`) to keep inference; errors are thrown, so only success bodies appear in the client types.

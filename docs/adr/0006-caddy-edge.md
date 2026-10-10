# Caddy as the edge

Status: accepted (2026-10-10)

## Context

Telegram requires HTTPS. We need static hosting, a reverse proxy and security headers with minimal config.

## Decision

One Caddy container serves the built web files, proxies `/api` to the API, `/telegram/webhook` to the bot, and `/media` to MinIO. It gets certificates automatically and sets HSTS, CSP (frame-ancestors allows telegram.org), and cache headers.

## Consequences

Only the edge publishes ports. One public domain means same-origin requests, so CORS stays closed.

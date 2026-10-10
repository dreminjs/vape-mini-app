# Transactional outbox for Telegram messages

Status: accepted (2026-10-10)

## Context

Order events must notify the manager and customers, but Telegram can be slow or down, and the API must not lose messages or block requests.

## Decision

The API writes an `OutboxMessage` row in the same DB transaction as the business change. A worker in `apps/bot` claims rows with `FOR UPDATE SKIP LOCKED`, sends them, and retries with exponential backoff. 403 (blocked bot) is not retried.

## Consequences

Notifications are at-least-once and never lost on API crashes. A message may be delayed by the poll interval (default 2 s).

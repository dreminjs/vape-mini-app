# `Authorization: tma <initData>` authentication

Status: accepted (2026-10-10)

## Context

Telegram Mini Apps get signed `initData` from Telegram. We need user identity without passwords.

## Decision

Every request sends `Authorization: tma <initDataRaw>`. The API checks the HMAC-SHA256 signature (key derived from the bot token, timing-safe compare) and `auth_date` age, then upserts the user. Admins are Telegram IDs from `ADMIN_TELEGRAM_IDS` plus the DB role.

## Consequences

No sessions, cookies or admin passwords. initData expires (default 1 h), so a long-open app may need to be reopened. In dev a Vite plugin signs fake initData on the server side, so the token never reaches the browser.

## Update 2026-10-10: admin password

On the owner's request, admin access is also granted by a password (`ADMIN_PASSWORD`, server env only) on top of Telegram auth: `POST /me/admin-login` sets a time-limited `User.adminUntil` (default 12 h). Constant-time compare, 5 attempts per 15 minutes. The Telegram identity is still required for every request, so the password alone is not enough to call the API.

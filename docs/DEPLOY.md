# Deployment and operations

## Production (Docker)

```bash
cp .env.example .env    # fill every value, set DOMAIN, BOT_MODE=webhook, strong passwords
docker compose up --build -d
```

Services: `postgres`, `minio`, `minio-bucket` + `minio-init` (one-shot bucket and policy), `migrate` (one-shot `prisma migrate deploy`, seed when `SEED=true`), `api`, `bot`, `edge` (Caddy). Only `edge` publishes ports 80/443. Caddy gets a Let's Encrypt certificate for `DOMAIN` automatically (DNS must point to the server first).

### Deploy to a VPS

1. Ubuntu 24.04 VPS with Docker Engine + Compose plugin. Open ports 80 and 443.
2. Point an A record (e.g. `shop.example.com`) to the server IP.
3. `git clone` the repo, create `.env` (see the table below), set `SEED=true` for the first start.
4. `docker compose up --build -d`, then check `docker compose ps` and `docker compose logs -f api bot`.
5. Set `SEED=false` afterwards (the seed is idempotent, but there is no need to run it again).

Update: `git pull && docker compose up --build -d`.

### Backups

```bash
# PostgreSQL
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > backup-$(date +%F).dump
# restore: docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean < backup.dump

# MinIO (product images): copy the volume
docker run --rm -v vapehard_minio-data:/data -v "$PWD":/backup alpine tar czf /backup/minio-$(date +%F).tgz -C /data .
```

Keep backups off the server (another disk or cloud storage).

## Telegram setup (BotFather)

1. `/newbot` → get the token → `BOT_TOKEN`.
2. `/mybots` → your bot → **Bot Settings → Menu Button** → URL `https://<DOMAIN>` (the bot also sets it on start).
3. Optional: **Configure Mini App** → enable and set the same URL (for direct links `t.me/<bot>/app`).
4. Admin access: open **Профиль → Вход для администратора** in the Mini App and enter `ADMIN_PASSWORD`. Optionally put permanent admins' Telegram IDs (e.g. from @userinfobot) into `ADMIN_TELEGRAM_IDS`.
5. Manager chat: the manager's user ID or a group ID (add the bot to the group) → `MANAGER_CHAT_ID`. The manager must start the bot once, otherwise Telegram blocks messages to them.

## Environment variables

| Variable                                                      | Used by        | Description                                                                 |
| ------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `DOMAIN`                                                      | edge, api, bot | Public domain, e.g. `shop.example.com`                                      |
| `WEB_APP_URL`                                                 | bot            | Mini App URL (HTTPS), usually `https://<DOMAIN>`                            |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`         | postgres       | Database credentials (compose builds `DATABASE_URL`)                        |
| `DATABASE_URL`                                                | dev apps       | Local connection string                                                     |
| `TEST_DATABASE_URL`                                           | tests          | Separate test database                                                      |
| `SEED`                                                        | migrate        | `true` loads categories, sample products, prizes                            |
| `BOT_TOKEN`                                                   | api, bot       | Bot token from BotFather (also the initData HMAC key)                       |
| `BOT_MODE`                                                    | bot            | `webhook` (prod) or `polling` (dev)                                         |
| `WEBHOOK_URL` / `WEBHOOK_SECRET`                              | bot            | Webhook URL and secret token (16–256 chars)                                 |
| `ADMIN_PASSWORD`                                              | api            | Admin panel password (min 10 chars). Anyone who enters it gets admin access |
| `ADMIN_SESSION_HOURS`                                         | api            | How long a password login lasts (default 12)                                |
| `ADMIN_TELEGRAM_IDS`                                          | api            | Optional: Telegram IDs that are always admins                               |
| `MANAGER_CHAT_ID`                                             | bot            | Chat for new-order notifications                                            |
| `MANAGER_USERNAME`                                            | api, bot       | Manager username without `@`                                                |
| `INIT_DATA_MAX_AGE_SECONDS`                                   | api            | Max initData age (default 3600)                                             |
| `REWARD_TTL_DAYS`                                             | api            | Roulette promo code lifetime (default 7)                                    |
| `S3_ENDPOINT` / `S3_PUBLIC_ENDPOINT`                          | api            | Internal MinIO URL / public URL for signing browser uploads                 |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, minio     | Storage settings (also MinIO root credentials)                              |
| `MEDIA_BASE_URL`                                              | api            | Public base for image URLs, `/media/<bucket>`                               |
| `ACME_EMAIL`                                                  | edge           | Email for Let's Encrypt                                                     |
| `LOG_LEVEL`                                                   | api, bot       | `info` by default                                                           |

## Manual smoke test

- [ ] Open the bot, `/start` shows the welcome text and the "Открыть магазин" button.
- [ ] The Mini App opens straight to the catalog with all products.
- [ ] Profile → admin password: a wrong password is rejected, the right one opens "Админка".
- [ ] Search and category chips work; the search term stays in the URL.
- [ ] Open a product, pick several variants with different quantities, add to cart.
- [ ] Spin the roulette; the promo code is applied in the cart; a second spin shows the countdown.
- [ ] Checkout asks "Мне есть 18 лет" once; totals match (discount, delivery); the success dialog opens the manager chat.
- [ ] The manager chat receives the new-order message with items, total and customer link.
- [ ] Admin changes the status → the customer gets a bot message.
- [ ] Admin stock shows reduced stock; cancelling the order restores it and frees the promo code.
- [ ] A non-admin user does not see "Админка" and gets 403 from `/api/v1/admin/*`.

## Troubleshooting

- **401 in the Mini App** — initData is older than `INIT_DATA_MAX_AGE_SECONDS`: close and reopen the app. Or `BOT_TOKEN` differs between bot and API.
- **Bot does not answer in prod** — check `docker compose logs bot`, `WEBHOOK_URL` must be `https://<DOMAIN>/telegram/webhook` and DNS must work.
- **Manager gets no messages** — the manager must `/start` the bot; check `OutboxMessage` rows with `status = 'FAILED'` and `lastError`.
- **Image upload fails** — `S3_PUBLIC_ENDPOINT` must be `https://<DOMAIN>/media` (prod) or `http://localhost:5173/media` (dev).
- **Certificate errors** — the domain must resolve to the server before the first start; see `docker compose logs edge`.
- **MinIO image pull fails** — official MinIO images were removed; see [ADR 0007](adr/0007-chainguard-minio.md).

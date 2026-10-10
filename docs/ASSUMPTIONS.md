# Assumptions

Decisions made where the build prompt is not explicit.

1. **Prototype file is not committed.** The original HTML contains a Supabase key and an admin password. `docs/prototype/NOTES.md` holds the extracted screens, texts, and rules instead.
2. **Currency**: all prices are BYN, stored in kopecks (`Int`). Seed prices from the prototype are whole BYN × 100.
3. **Reward TTL**: 7 days by default (`REWARD_TTL_DAYS`).
4. **Roulette cooldown**: 24 hours, counted from the last spin `createdAt` (server clock).
5. **Reward is auto-applied** in the cart after a spin: the client stores only the reward `code` in the cart store; the server re-validates it on validate/checkout.
6. **Gift rewards** ("Картридж в подарок", "XROS mini") give no money discount; the gift name is saved on the order and shown to the manager.
7. **Percent discount** applies to the items subtotal only (not to delivery). Fixed discount: `min(subtotal, amount)`.
8. **Order number** comes from a Postgres sequence starting at 1001, shown as `VH-1001`.
9. **Cancel** restores stock and frees the reward only when the reward is not expired.
10. **Contact username**: taken from verified `initData`. If the Telegram user has no username, the customer must type one (validated `^[A-Za-z0-9_]{5,32}$`).
11. **Admin role** is synced on every auth: user in `ADMIN_TELEGRAM_IDS` → `ADMIN`, otherwise role stays as in DB (a DB admin is not demoted automatically). Removing from env + manual DB change demotes.
12. **Age confirmation** is stored on the user (`ageConfirmedAt`). Admin routes do not require it.
13. **Category "🔥 Уценка"** is a real category (as in the prototype). The "Уценка" badge on cards shows when `oldPriceMinor` is set.
14. **Rate limits** use an in-memory store (single API instance). Good enough for one VPS; note in backlog.
15. **Integration tests** use the dev compose Postgres with a separate database `vape_test`.
16. **"Скидка" vs gift**: one reward per order.
17. **Images**: public read for `products/*` through `/media/<bucket>/products/...`. The web builds image URLs from `imageKey` + `/media/<bucket>/`.
18. **Bot plugins**: the throttler package is `@grammyjs/transformer-throttler` (the prompt's `@grammyjs/throttler` does not exist). `@grammyjs/hydrate` is not used: the bot never edits sent messages, and its context types break `webhookCallback`/`run` under `exactOptionalPropertyTypes`.
19. **Prize amounts**: FIXED prizes store kopecks (`500` = 5 BYN), PERCENT prizes store whole percent.
20. **Cancelled orders and rewards**: when a cancel frees a reward, the order's `rewardId` link is cleared (the unique link lets the reward be used once again); the order keeps its discount numbers.
21. **Deleted variants**: `OrderItem.variantId` becomes NULL (snapshot stays); their ledger rows are deleted with them.

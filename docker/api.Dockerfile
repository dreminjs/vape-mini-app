# syntax=docker/dockerfile:1
# Targets: `runtime` (API server, default) and `migrate` (one-shot prisma migrate deploy + seed).

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter "@vapehard/api..." build
# Self-contained folders with only production dependencies.
RUN pnpm --filter @vapehard/api deploy --prod /out/api \
 && pnpm --filter @vapehard/db deploy /out/db

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS migrate
ENV NODE_ENV=production PATH=/app/node_modules/.bin:$PATH
WORKDIR /app
COPY --from=build --chown=node:node /out/db /app
USER node
# SEED=true loads categories, sample products and roulette prizes (idempotent).
CMD ["sh", "-c", "prisma migrate deploy && if [ \"$SEED\" = \"true\" ]; then prisma db seed; fi"]

FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/readyz || exit 1
CMD ["node", "dist/server.js"]

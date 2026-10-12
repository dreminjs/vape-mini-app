FROM node:20-alpine AS builder
WORKDIR /app

# Устанавливаем pnpm (если вы используете npm или yarn, удалите эту строку и используйте их команды)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Копируем глобальные конфиги воркспейсов
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./

# Копируем исходники всех пакетов
COPY apps ./apps

# Устанавливаем зависимости для всего монорепозитория
RUN pnpm install --frozen-lockfile

# Собираем конкретное приложение
RUN pnpm --filter api build

FROM node:20-alpine AS runtime
WORKDIR /app

# Копируем собранное приложение и нужные модули из builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
CMD ["npm", "run", "start:prod"]

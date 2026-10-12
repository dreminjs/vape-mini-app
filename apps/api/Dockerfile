# ==========================================
# 1. СТАДИЯ СБОРКИ (Builder)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Включаем pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Копируем конфиги монорепозитория
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./

# Копируем исходный код приложений и общих пакетов.
# ВНИМАНИЕ: Если ваши общие пакеты лежат в папке `libs` вместо `packages`,
# измените слово `packages` на `libs` в строке ниже.
COPY apps ./apps
COPY packages ./packages

# Устанавливаем все зависимости монорепозитория
RUN pnpm install --frozen-lockfile

# Если вы используете Prisma внутри @vapehard/db, вам нужно сгенерировать клиент.
# Раскомментируйте и при необходимости поправьте команду под ваши скрипты:
# RUN pnpm --filter "@vapehard/db" run generate

# Собираем API и ВСЕ его зависимости (@vapehard/shared, db, config и т.д.)
# Троеточие (...) после api указывает pnpm собрать все пакеты, от которых зависит API.
RUN pnpm --filter api... run build

# Изолируем только production-зависимости API в отдельную папку
RUN pnpm deploy --filter api --prod /prod/api


# ==========================================
# 2. СТАДИЯ ВЫПОЛНЕНИЯ (Runtime)
# ==========================================
FROM node:20-alpine AS runtime
WORKDIR /app

# Устанавливаем production окружение
ENV NODE_ENV=production

# Копируем ТОЛЬКО готовое приложение и его прод-зависимости из builder'а
COPY --from=builder /prod/api ./

# Запускаем собранное API (убедитесь, что в apps/api/package.json есть скрипт start:prod)
CMD ["npm", "run", "start"]

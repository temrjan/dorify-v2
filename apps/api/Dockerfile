# Stage 1: Install all deps (monorepo-aware)
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @dorify/api

# Stage 2: Generate Prisma + Build TypeScript
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/ ./
COPY apps/api/ apps/api/
RUN cd apps/api && pnpm run prisma:generate && pnpm run build

# Stage 3: Production deps only
FROM node:22-alpine AS prod-deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @dorify/api --prod

# Stage 4: Minimal runtime image
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 dorify && adduser -u 1001 -G dorify -s /bin/sh -D dorify
WORKDIR /app

# Production node_modules
COPY --from=prod-deps --chown=dorify:dorify /app/node_modules ./node_modules
# Prisma generated client (from build stage where prisma:generate ran)
COPY --from=build --chown=dorify:dorify /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client ./node_modules/.prisma/client
# Compiled JS
COPY --from=build --chown=dorify:dorify /app/apps/api/dist ./dist
# Prisma schema (for migrations)
COPY --from=build --chown=dorify:dorify /app/apps/api/prisma ./prisma

USER dorify
EXPOSE 3001
CMD ["node", "dist/main.js"]

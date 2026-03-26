# Stage 1: Install deps + Build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json apps/bot/package.json
RUN pnpm install --frozen-lockfile --filter @dorify/bot --shamefully-hoist
COPY apps/bot/ apps/bot/
RUN cd apps/bot && pnpm build

# Stage 2: Minimal runtime
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 dorify && adduser -u 1001 -G dorify -s /bin/sh -D dorify
WORKDIR /app

COPY --from=build --chown=dorify:dorify /app/node_modules ./node_modules
COPY --from=build --chown=dorify:dorify /app/apps/bot/dist ./dist

USER dorify
EXPOSE 3002
CMD ["node", "dist/main.js"]

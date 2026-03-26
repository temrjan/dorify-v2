# Stage 1: Install deps + Build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @dorify/api
COPY apps/api/ apps/api/
RUN cd apps/api && pnpm run prisma:generate && pnpm run build

# Stage 2: Minimal runtime
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 dorify && adduser -u 1001 -G dorify -s /bin/sh -D dorify
WORKDIR /app

# Copy node_modules from build (includes all runtime deps)
COPY --from=build --chown=dorify:dorify /app/node_modules ./node_modules
# Prisma generated client
COPY --from=build --chown=dorify:dorify /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client ./node_modules/.prisma/client
# Compiled JS
COPY --from=build --chown=dorify:dorify /app/apps/api/dist ./dist
# Prisma schema
COPY --from=build --chown=dorify:dorify /app/apps/api/prisma ./prisma

USER dorify
EXPOSE 3001
CMD ["node", "dist/main.js"]

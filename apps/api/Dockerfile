# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run prisma:generate
RUN pnpm run build

# Stage 3: Production deps
FROM node:22-alpine AS prod-deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Stage 4: Runtime
FROM node:22-alpine AS runtime
RUN addgroup -g 1001 dorify && adduser -u 1001 -G dorify -s /bin/sh -D dorify
WORKDIR /app

COPY --from=prod-deps --chown=dorify:dorify /app/node_modules ./node_modules
COPY --from=build --chown=dorify:dorify /app/dist ./dist
COPY --from=build --chown=dorify:dorify /app/prisma ./prisma
COPY --from=build --chown=dorify:dorify /app/node_modules/.prisma ./node_modules/.prisma

USER dorify
EXPOSE 3001
CMD ["node", "dist/main.js"]

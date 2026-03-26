# Stage 1: Build
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @dorify/web
COPY apps/web/ apps/web/
RUN cd apps/web && pnpm build

# Stage 2: Serve
FROM nginx:alpine AS runtime
RUN addgroup -g 1001 dorify && adduser -u 1001 -G dorify -s /bin/sh -D dorify

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R dorify:dorify /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run

USER dorify
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

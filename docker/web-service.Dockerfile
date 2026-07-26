# syntax=docker/dockerfile:1
#
# Dockerfile for the Next.js frontend (apps/web). Build context is the repo
# root, same convention as docker/nest-service.Dockerfile:
#
#   docker build -f docker/web-service.Dockerfile .

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# ---- Prune the monorepo down to just what apps/web needs ----
FROM base AS pruner
WORKDIR /app
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
  npm install -g turbo@2.10.5
COPY . .
RUN turbo prune "@ai-notification/web" --docker

# ---- Install dependencies and build ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm turbo run build --filter="@ai-notification/web"

# ---- Runtime image ----
# Next.js standalone output doesn't include .next/static or public --
# those are copied in separately per Next's own documented convention.
FROM base AS runner
ENV NODE_ENV=production
# Docker auto-sets HOSTNAME to the container ID, and the standalone
# server binds to $HOSTNAME if set -- pin it to 0.0.0.0 so the server
# listens on all interfaces (loopback included) instead of only the
# container's own hostname/IP.
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
USER appuser
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "require('http').get({host:'localhost',port:process.env.PORT||3000,path:'/login'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]

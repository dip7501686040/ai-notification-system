# syntax=docker/dockerfile:1
#
# Shared Dockerfile for every NestJS service in this monorepo. Build context
# is the repo root, e.g.:
#
#   docker build -f docker/nest-service.Dockerfile \
#     --build-arg APP_NAME=@ai-notification/api-gateway \
#     --build-arg APP_DIR=api-gateway .
#
# APP_NAME must match the package.json "name" of an app under apps/*.
# APP_DIR must match that app's directory name under apps/.

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# ---- Prune the monorepo down to just what this app needs ----
FROM base AS pruner
ARG APP_NAME
WORKDIR /app
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
  npm install -g turbo@2.10.5
COPY . .
RUN turbo prune "${APP_NAME}" --docker

# ---- Install dependencies and build ----
FROM base AS installer
ARG APP_NAME
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter="${APP_NAME}..."

# ---- Runtime image ----
FROM base AS runner
ARG APP_DIR
ENV APP_DIR=${APP_DIR}
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser
COPY --from=installer /app .
USER appuser
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "require('http').get({host:'localhost',port:process.env.PORT||3000,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["sh", "-c", "node \"apps/$APP_DIR/dist/main.js\""]

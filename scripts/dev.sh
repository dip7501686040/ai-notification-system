#!/usr/bin/env bash
# Local development bootstrap: brings up the Docker-hosted infra (Postgres,
# RabbitMQ, Redis, the observability stack, the Stripe CLI webhook
# forwarder) and then runs all 13 app services natively, 2 at a time, so app
# code hot-reloads without a container rebuild. Wired up as `pnpm dev` (see
# package.json) -- run this instead of `turbo run dev` directly so infra is
# guaranteed to be up first and startup is staggered (this machine can't
# handle all 13 Nest+webpack+OTel processes launching at once -- see ENFILE
# history on this script).
set -euo pipefail

cd "$(dirname "$0")/.."

# stripe-cli is behind the "stripe" compose profile (see docker-compose.yml)
# and only does anything useful with STRIPE_SECRET_KEY set in .env --
# COMPOSE_PROFILES=stripe there is what actually activates it.
# ollama is skipped -- ai-service is configured to use the OpenAI API instead.
INFRA_SERVICES=(postgres pgadmin rabbitmq redis otel-collector jaeger prometheus loki cadvisor grafana stripe-cli)

echo "== Checking Docker =="
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not running -- launching Docker Desktop..."
  open -a Docker
  until docker info >/dev/null 2>&1; do
    sleep 2
  done
fi
echo "Docker is up."

echo "== Ensuring infra is up (postgres, rabbitmq, redis, observability stack, stripe-cli) =="
# `docker compose up -d` is idempotent -- already-running containers are left
# alone, only missing ones are (re)started. --wait blocks until each service
# with a healthcheck reports healthy (services without one just need to be
# running), so app services below don't race infra on startup.
#
# COMPOSE_PARALLEL_LIMIT=1 pulls/starts one service at a time -- a fresh
# machine pulling all ~12 images concurrently can saturate the connection
# and hit registry TLS handshake timeouts. The retry loop covers a one-off
# transient timeout on top of that.
export COMPOSE_PARALLEL_LIMIT=1
for attempt in 1 2 3; do
  if docker compose up -d --wait "${INFRA_SERVICES[@]}"; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "docker compose up failed after 3 attempts." >&2
    exit 1
  fi
  echo "docker compose up failed (attempt $attempt/3), retrying in 5s..."
  sleep 5
done

echo "Infra is up."

echo "== Applying pending Prisma migrations =="
# `prisma migrate deploy` is idempotent -- it checks which migrations are
# already applied and only runs the ones that aren't, so this is safe to
# run every time. Each service's own `dev` script now also runs this (see
# apps/*/package.json), but doing it here too means a fresh/reset Postgres
# volume gets migrated up front, with failures surfacing clearly before any
# of the 13 services start, instead of buried in one service's interleaved
# background output. channel-service has no database, so it's excluded.
PRISMA_SERVICES=(
  identity-service
  tenant-service
  event-service
  ai-service
  rule-engine-service
  notification-service
  template-service
  analytics-service
  audit-service
)
for svc in "${PRISMA_SERVICES[@]}"; do
  echo "  -> $svc"
  pnpm --filter "@ai-notification/$svc" exec prisma migrate deploy
done
echo "Migrations up to date."

echo "== Starting shared packages (tsc --watch, lightweight) =="
PACKAGES=(common config grpc logger rabbitmq telemetry)
pids=()
for pkg in "${PACKAGES[@]}"; do
  pnpm --filter "@ai-notification/$pkg" run dev &
  pids+=("$!")
done

# Starting all 13 at once (like `turbo run dev` does) is what caused the
# ENFILE crashes -- each is a full Nest+webpack+OTel process. 2 at a time
# keeps peak concurrent RAM/fd usage low regardless of how many total
# services end up running.
echo "== Starting all 13 app services locally, 2 at a time =="
APP_SERVICES=(
  identity-service
  tenant-service
  event-service
  ai-service
  rule-engine-service
  notification-service
  channel-service
  template-service
  analytics-service
  audit-service
  api-gateway
  web
  prediction-service
)

BATCH_SIZE=2
BATCH_DELAY_SECONDS=6

trap 'echo; echo "Stopping..."; kill "${pids[@]}" 2>/dev/null' INT TERM

for i in "${!APP_SERVICES[@]}"; do
  svc="${APP_SERVICES[$i]}"
  echo "  -> $svc"
  pnpm --filter "@ai-notification/$svc" run dev &
  pids+=("$!")

  if (( (i + 1) % BATCH_SIZE == 0 )); then
    sleep "$BATCH_DELAY_SECONDS"
  fi
done

wait

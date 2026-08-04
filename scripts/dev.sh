#!/usr/bin/env bash
# Local development bootstrap: brings up the Docker-hosted infra (Postgres,
# RabbitMQ, Redis, the observability stack, Ollama, the Stripe CLI webhook
# forwarder) and then runs all 13 app services natively via turbo, so app
# code hot-reloads without a container rebuild. Wired up as `pnpm dev` (see
# package.json) -- run this instead of `turbo run dev` directly so infra is
# guaranteed to be up first.
set -euo pipefail

cd "$(dirname "$0")/.."

# stripe-cli is behind the "stripe" compose profile (see docker-compose.yml)
# and only does anything useful with STRIPE_SECRET_KEY set in .env --
# COMPOSE_PROFILES=stripe there is what actually activates it.
INFRA_SERVICES=(postgres pgadmin rabbitmq redis otel-collector jaeger prometheus loki cadvisor grafana ollama stripe-cli)

echo "== Checking Docker =="
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not running -- launching Docker Desktop..."
  open -a Docker
  until docker info >/dev/null 2>&1; do
    sleep 2
  done
fi
echo "Docker is up."

echo "== Ensuring infra is up (postgres, rabbitmq, redis, ollama, observability stack, stripe-cli) =="
# `docker compose up -d` is idempotent -- already-running containers are left
# alone, only missing ones are (re)started. --wait blocks until each service
# with a healthcheck reports healthy (services without one just need to be
# running), so app services below don't race infra on startup.
docker compose up -d --wait "${INFRA_SERVICES[@]}"

# One-shot model puller -- exits after pulling, so it's excluded from --wait.
# ai-service handles a not-yet-pulled model as a graceful per-request failure.
docker compose up -d ollama-pull
echo "Infra is up."

echo "== Starting all 13 app services locally =="
exec pnpm turbo run dev

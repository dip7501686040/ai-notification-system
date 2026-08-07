#!/usr/bin/env bash
# Lighter-weight local dev bootstrap: skips the Docker infra checks and
# Prisma migrations that scripts/dev.sh does up front (assumes infra is
# already up from a previous `pnpm dev` run) and just (re)starts the shared
# packages' tsc --watch processes plus all 13 app services, staggered.
set -euo pipefail

cd "$(dirname "$0")/.."

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

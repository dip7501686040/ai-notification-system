#!/usr/bin/env bash
set -uo pipefail
KA=~/platform-infrastructure/envs/state/kubeconfig-ai-notification-floci
kap() { kubectl --kubeconfig "$KA" "$@"; }

echo "==================== host ===================="
uptime
echo "k6 still running?   $(pgrep -fl 'k6 run' || echo no)"
echo "caffeinate running? $(pgrep -fl caffeinate || echo no)"

echo; echo "==================== container CPU ===================="
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'floci' | sort
echo "--- configured --cpus cap per container ---"
for c in floci-eks-ai-notification-floci floci-eks-floci-backing-services floci-prometheus floci-grafana floci-jaeger floci-otel-collector floci floci-ecr-registry; do
  q=$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$c" 2>/dev/null)
  printf '  %-34s %s cores\n' "$c" "$(python3 -c "print(${q:-0}/1e9)")"
done

echo; echo "==================== app pods: CPU + restarts ===================="
kap top pods -n ai-notification --sort-by=cpu 2>/dev/null
echo "--- any not Running / restarting ---"
kap get pods -n ai-notification 2>/dev/null | awk 'NR==1 || $3!="Running" || $4+0>1'

echo; echo "==================== ArgoCD sync storm? ===================="
kap get applications -n argocd 2>/dev/null -o custom-columns='N:.metadata.name,SYNC:.status.sync.status,OP:.status.operationState.phase,H:.status.health.status'
docker logs --since 2m floci-argocd-application-controller 2>&1 | grep -c 'Syncing\|Comparing app state' | sed 's/^/  sync-ish log lines last 2m: /'

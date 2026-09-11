#!/usr/bin/env bash
# Phase 2 diagnosis snapshot -- run right after a load run aborts (pods may
# still be warm) OR while a run holds at its knee.
set -uo pipefail
KA=~/platform-infrastructure/envs/state/kubeconfig-ai-notification-floci
KB=~/platform-infrastructure/envs/state/kubeconfig-floci-backing-services
PROM="${PROM:-http://localhost:9094}"
kap() { kubectl --kubeconfig "$KA" "$@"; }
kbk() { kubectl --kubeconfig "$KB" "$@"; }
pq() { # promql instant query -> compact top-10
  curl -sG "$PROM/api/v1/query" --data-urlencode "query=$1" \
    | python3 -c '
import sys, json
r = json.load(sys.stdin).get("data", {}).get("result", [])
if not r:
    print("  (no data)")
else:
    for m in sorted(r, key=lambda x: -float(x["value"][1]))[:10]:
        lbl = m["metric"].get("pod") or m["metric"].get("container") or "?"
        print("  %-46s %.3f" % (lbl, float(m["value"][1])))
'
}

echo "==================== host ===================="
uptime
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'eks|floci\s|prometheus'

echo; echo "==================== app pods: CPU (cores) vs the 250m limit ===================="
kap top pods -n ai-notification --sort-by=cpu
echo "--- restarts / phase ---"
kap get pods -n ai-notification | awk 'NR==1 || $4>0 || $3!="Running"'

echo; echo "==================== CPU THROTTLING (throttled periods / total) -- >0.2 == hitting the limit ===================="
pq 'sum by (pod) (rate(container_cpu_cfs_throttled_periods_total{namespace="ai-notification"}[3m])) / sum by (pod) (rate(container_cpu_cfs_periods_total{namespace="ai-notification"}[3m]))'

echo; echo "==================== CPU used vs the 250m limit (ratio) ===================="
pq 'sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="ai-notification"}[3m])) / 0.25'

echo; echo "==================== mem working set / 256Mi limit ===================="
pq 'sum by (pod) (container_memory_working_set_bytes{namespace="ai-notification"}) / (256*1024*1024)'

echo; echo "==================== sync-path logs (last 10m, error-ish) ===================="
for d in api-gateway identity-service event-service rule-engine-service tenant-service; do
  echo "----- $d -----"
  kap logs -n ai-notification deploy/$d --tail=60 --since=10m 2>/dev/null \
    | grep -iE 'error|timeout|deadline_exceeded|econnrefused|econnreset|too many|pool|unavailable|ECANCELED|slow query|429|503' | tail -10
done

echo; echo "==================== Postgres ===================="
kbk exec -n backing-services statefulset/postgres -- psql -U postgres -tc \
  "select count(*) total, count(*) filter (where state='active') active, count(*) filter (where wait_event_type='Lock') locks from pg_stat_activity;" 2>&1
kbk exec -n backing-services statefulset/postgres -- psql -U postgres -tc "show max_connections;" 2>&1

echo; echo "==================== RabbitMQ queue depths ===================="
kbk exec -n backing-services statefulset/rabbitmq -- rabbitmqctl list_queues name messages consumers 2>&1 | grep -vE '^Timeout|^Listing' | awk '$2>0 || NR<=1'

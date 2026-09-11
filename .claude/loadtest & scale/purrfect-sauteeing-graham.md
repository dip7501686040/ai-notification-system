# Phase F — Load Test → Find This Host's Edge → Autoscale → Prove the Gain → Project to Real Scale

## Context

Phases C–E are done: observability + KEDA operator up (C), stack instrumented — `/metrics`, OTLP, RabbitMQ `rabbitmq_prometheus` per-queue depth (D), `ai-notification-system/loadtest/baseline.js` is the 1‑replica k6 baseline (E). **Phase F** reads that baseline, decides HPA vs KEDA per service, applies it via GitOps, and produces a portfolio write‑up of the scaling proof and the trade‑offs.

## Can this host hit the SRS targets? — No, and that's not the goal

`ai-notification-system/docs/SRS.md §2.11` sets **232 events/s average, 2315 events/s peak** as the "minimum architecture target". Those are **real‑infrastructure** targets and are **not reachable on this machine** (8 cores / 8 GB total; Docker VM = 5.3 GB already running 2 k3s nodes + Floci + ecr‑registry + 5 ArgoCD + 4 observability containers). The k3s control planes + Postgres/RabbitMQ/Redis + Prometheus/Grafana/Jaeger consume most of the RAM before a single app request is served.

**Phase F's actual goal:**
1. Measure **this host's** sustainable throughput for the main flow at 1 replica — the baseline edge.
2. Prove HPA/KEDA raises that ceiling by a **measured factor**, within the `maxReplicas` the box allows (2–3).
3. **Capacity math** — extrapolate the measured per‑replica throughput to the replica count / vCPU / RAM / node count + PgBouncer + identity‑cache that real prod needs to reach 232/s and 2315/s.
4. Document every trade‑off and edge case surfaced along the way.

Portfolio value = **the method + the analysis + the projection**, not a big local number.

## Hard constraints (discovered during exploration)

| Constraint | Consequence |
|---|---|
| All 13 services: `250m` CPU / `256Mi` mem limit, `replicaCount: 1`, no `autoscaling` flag in the chart | Edge is very close; single replica falls over in the low tens of req/s |
| Every authed request → gRPC `identity-service` (token validate + `user.findUnique`), often `tenant-service` | Shared auth hot path saturates before the endpoint's own target |
| Postgres `max_connections=100`, no pooling, Prisma default pool ≈ `2·nCPU+1`/replica, 9 DB‑owning services | Horizontal scale of a DB‑owning service hits `FATAL: too many clients` before CPU |
| ArgoCD `selfHeal: true` + `prune: true`, no `ignoreDifferences` | An HPA replica change is reverted to `1` on every self‑heal pass |
| Async handlers `nack(false,false)` on error — no requeue, no DLX | Under sustained overload the pipeline silently drops events |
| No `@nestjs/throttler` anywhere (except per‑API‑key on `X-API-Key`) | Load isn't artificially capped; also no edge load‑shedding exists |
| 8 core / 8 GB host, 2 k3s nodes + observability already resident | Unmanaged concurrency melts the host (seen: load 44). Everything below runs **strictly serial**. |
| `POST /events` → **400** unless an *enabled* rule matches `type` | `setup()` rule creation is mandatory; rule action needs `channel` + `target` |

## Resource discipline — do this before EVERY run (no concurrency, ever)

Time is not a constraint on this host; contention is. Give the app cluster priority, make everything else wait.

**1. Stop everything not under test:**
```
docker stop floci-argocd-redis floci-argocd-repo-server floci-argocd-application-controller \
            floci-argocd-applicationset-controller floci-argocd-server floci-jenkins
```
ArgoCD is only needed for the one‑time Phase‑3a GitOps commit; stop it again for the load runs — it does not affect the test.

**2. Scale out‑of‑flow app services to 0** (batches of 2–3, pause between — never all at once):
```
export KUBECONFIG=~/platform-infrastructure/envs/state/kubeconfig-ai-notification-floci
kubectl scale deploy web prediction-service -n ai-notification --replicas=0
# primary (sync-path) runs — also zero the async tail:
kubectl scale deploy ai-service notification-service channel-service -n ai-notification --replicas=0
kubectl scale deploy analytics-service audit-service template-service -n ai-notification --replicas=0
```
Sync‑path runs keep only: `api-gateway`, `identity-service`, `tenant-service`, `event-service`, `rule-engine-service`.

**3. Pin CPU priority to the app node** (pattern from `platform-infrastructure/scripts/cpu-priority.sh`):
```
docker update --cpus=5   floci-eks-ai-notification-floci
docker update --cpus=2   floci-eks-floci-backing-services
docker update --cpus=0.5 floci ; docker update --cpus=0.3 floci-ecr-registry
docker update --cpus=0.5 floci-prometheus ; docker update --cpus=0.5 floci-grafana
docker update --cpus=0.5 floci-jaeger ; docker update --cpus=0.5 floci-otel-collector
```
Or run `platform-infrastructure/scripts/cpu-watchdog.sh` in the background (enforces one‑cluster‑at‑a‑time priority automatically).

**4. k6 runs on the Mac host** (not a container) — it needs ~1 core. Budget: 8 cores → Docker VM ≤ ~6, k6 ~1, macOS ~1.

**5. Verify quiet before starting:** `uptime` 1‑min load < 2; `docker stats --no-stream` app node < 30 %.

**6. Bring services back in small batches only** (`--replicas` one/two at a time with a pause), or use `platform-infrastructure/scripts/safe-restart.sh`. If the box got hot between runs, run `safe-restart.sh` to reconcile.

## Observability — discover bottlenecks here first (keep only these running)

Order: **Grafana → Prometheus → Jaeger**. CLI only for what those can't show.

**Grafana** `:9093` (`admin` / `cat ~/platform-infrastructure/envs/state/grafana-admin-password.txt`) — import `ai-notification-system/infra/grafana/provisioning/dashboards/{platform-health,tenant-observability}.json` or build a Phase‑F board: gateway req‑rate / p95 / error‑rate **by route** (`gateway_requests_total`, `gateway_request_duration_ms`, `gateway_errors_total`); CPU per pod vs `250m`; mem per pod vs `256Mi`; CPU‑throttle ratio; replica count; `rabbitmq_queue_messages_ready` per queue.

**Prometheus** `:9094`:
```promql
rate(container_cpu_cfs_throttled_periods_total{namespace="ai-notification"}[1m]) / rate(container_cpu_cfs_periods_total{namespace="ai-notification"}[1m])   # throttling = hit the limit
container_memory_working_set_bytes{namespace="ai-notification"} / on(pod) kube_pod_container_resource_limits{resource="memory",namespace="ai-notification"}   # OOM risk
sum by (pod)(rate(container_cpu_usage_seconds_total{namespace="ai-notification"}[1m]))   # what HPA sees (vs the 50m request)
rabbitmq_queue_messages_ready                                                             # async backlog per queue
```
Verify api‑gateway `/metrics`: `curl http://<app-node-ip>:30964/metrics` (NodePort `local.api_gateway_metrics_node_port`). If empty → add `env.METRICS_PROMETHEUS_PORT: "9464"` to `platform-gitops/k8s/environments/local/values-api-gateway.yaml` and rebuild/redeploy; else read gateway metrics via `floci-otel-collector:8889`.

**Jaeger** `:9095` — during a ramp, open a slow `POST /events` trace; name the dominant span (gateway self‑time vs `identity ValidateToken` vs `event-service` vs `rule-engine HasMatchingRule` vs Postgres write vs broker publish). gRPC `DEADLINE_EXCEEDED` (5 s) shows here first.

**Fallback only:** `kubectl top`, `kubectl describe pod` (OOMKilled/restarts), `psql -c "select count(*),state,wait_event from pg_stat_activity group by 1,2,3"`, `rabbitmqctl list_queues name messages consumers`, `docker stats` + `uptime`.

## Load generation

**Primary — replay what the web UI drives, at scale.**
1. Manual pass through `http://localhost:8080` (log in → create tenant → rule → ingest events → view notifications), DevTools → Network open. Watch Jaeger/Grafana to learn the call graph + idle timings. Export HAR (or read `apps/web/src/**` API client) → exact `api-gateway` requests.
2. **k6 API replay** — the bulk load, mirroring those requests. Scripts in `ai-notification-system/loadtest/`.
3. **k6 browser** (`import { browser } from 'k6/browser'`) — a *small* VU count (**3–8**, host‑limited) driving real headless Chromium against `:8080`, for true end‑to‑end (web SSR/CSR + Socket.IO). Optional, run alone (not with the API load).

**Fallback — api‑gateway Swagger:** not currently wired (`@nestjs/swagger` absent, no `SwaggerModule.setup`). If wanted as a manual tool / schema artifact: add `@nestjs/swagger` + `SwaggerModule.setup('/docs', ...)` in `apps/api-gateway/src/main.ts` (~15 lines), rebuild. Otherwise use the route table below.

**k6 install:** `k6-vX-macos-arm64` from GitHub releases → `~/bin/k6`.

Main‑flow routes (`http://localhost:8000`, Bearer JWT): `POST /auth/register {email,password(≥8),name?}`→`{accessToken}` · `POST /tenants {name(≥2),slug:/^[a-z0-9]+(-[a-z0-9]+)*$/}`→`{id}` (creator auto‑`owner`) · `PUT /ai-config {tenantId,provider:"openai",model:"gpt-4o-mini"}` · `POST /rules {tenantId,name,eventType,actions:[{channel:"webhook",target:"http://<sink>"}],enabled:true}` · `POST /events {tenantId,type,payload:{}}`→201 (**400 if no matching enabled rule**) · `GET /events?tenantId=` · `GET /events/:id` (poll `status`) · `GET /notifications?tenantId=`.

**Realistic k6 levels for this host** (long holds — time doesn't matter):
- `ramping-arrival-rate` on `POST /events`: steps **2 → 4 → 6 → 8 → 12 → 16 → 20 → 25 → 30 req/s**, hold **3 min** each, `preAllocatedVUs: 20, maxVUs: 60`. Expect the knee somewhere in **8–25 req/s** at 1 replica.
- `ramping-vus` closed‑model comparison: 5 → 40 VUs.
- Async/KEDA demo (secondary): a **separate 2–5 req/s** run with `channel-service` + `ai-service`(OpenAI) + `notification-service` brought back up.

## Scope

- **Primary worked example = the synchronous main flow**: `api-gateway`, `identity-service`, `tenant-service`, `event-service`, `rule-engine-service` (+ Postgres `event_db`/`identity_db`, + one RabbitMQ publish). All other app services scaled to 0. `POST /events` still returns 201; messages just accumulate in RabbitMQ with no consumers — that itself is edge‑case #7.
- **Secondary (optional, low rate) = the async tail + KEDA**: bring up `channel-service` + `ai-service`(OpenAI) + `notification-service`, run at 2–5 req/s, demo KEDA scaling `channel-service` on queue depth and the queue draining.

## Decisions (locked)

- **HPA ↔ GitOps:** `ignoreDifferences` for `apps/Deployment` `/spec/replicas` on the ApplicationSet + the 2 standalone Applications, committed to `platform-gitops`.
- **Load model:** both — `ramping-arrival-rate` (find the knee) + `ramping-vus` (concurrent‑user view).
- **AI provider:** OpenAI (secondary demo only). Fill `openai_api_key` in `secrets.local.tfvars`, re‑seed `app-secrets`, `PUT /ai-config` the test tenant to `provider: openai`. Verify the embeddings path (`SimilarEventRetriever`) — if it hard‑requires Ollama, disable/stub it.
- **Postgres 100‑conn ceiling:** *document as a discovered edge* (reproduce `FATAL: too many clients`), don't fix this phase.

## Inputs needed from the user

- **OpenAI API key** (for the secondary async/KEDA demo) — provide on request.
- Confirm whether to add `@nestjs/swagger` to `api-gateway`.

## Phase 1 — Baseline edge (1 replica, sync path only)

Files: `loadtest/mainflow-open.js` (new, `ramping-arrival-rate`), `loadtest/mainflow-closed.js` (refactor of `baseline.js`, `ramping-vus`), `loadtest/lib/setup.js` (shared).

Fold into the scripts:
- `POST /rules` failure is **fatal** (not `console.warn ... continuing`).
- Rule action `{channel:"webhook", target:"http://host.docker.internal:<sink>"}` (or `{channel:"dashboard", target:"<userId>"}`) so the delivery tail runs in the secondary demo.
- `setup()`: register → tenant → (`PUT /ai-config` openai, secondary only) → rule → return `{token, tenantId}`.
- Tag each request `{ tags: { step: 'ingest' } }` for per‑endpoint percentiles.
- Optional end‑to‑end probe VU: poll `GET /events/:id` until `status != "received"`, record separately.
- Thresholds tied to SLOs; `abortOnFail` on sustained `http_req_failed`.

**SLO:** p95 (main flow) < **300 ms**, p99 < 800 ms, error rate < **1 %**.

Run:
1. Resource‑discipline steps above (stop argocd/jenkins, zero non‑flow services, pin CPU, verify quiet).
2. `kubectl scale deploy api-gateway identity-service tenant-service event-service rule-engine-service -n ai-notification --replicas=1`
3. Confirm no HPA. Grafana Phase‑F board + a Jaeger tab open.
4. `k6 run --summary-export=loadtest/out/baseline-open.json loadtest/mainflow-open.js`
5. Repeat with `mainflow-closed.js` → `baseline-closed.json`.

Record: the **knee** (arrival rate where p95 crosses 300 ms / errors climb); the **first pod to saturate** (expect `api-gateway` or `identity-service` at `250m`, throttle‑ratio → ~0.8); the **failure signature** (throttle→latency cliff / downstream `DEADLINE_EXCEEDED` / 5xx / OOMKill).

## Phase 2 — Diagnose (Grafana / Prometheus / Jaeger)

Which pod is pinned at `250m` (Grafana + throttle query) · where the latency lives in a slow trace (Jaeger: gateway vs `identity ValidateToken` vs `event-service` vs `rule-engine HasMatchingRule` vs Postgres) · does any queue back up (`rabbitmq_queue_messages_ready`). CLI fallback: `pg_stat_activity` count, `describe pod` for OOM.

Classify:
- **CPU‑pinned, request‑path, no DB** → **HPA**: `api-gateway`.
- **CPU‑pinned, owns a DB** → HPA *blocked by the 100‑conn ceiling* — reproduce + **document**: `identity-service`, `event-service`, `rule-engine-service`.
- **Queue worker, no DB** → **KEDA**: `channel-service` (secondary demo).

## Phase 3 — Apply autoscaling (via GitOps)

**3a. GitOps coexistence.** `docker start` the 5 argocd containers briefly. Add to `platform-gitops`:
- `k8s/argocd/applicationsets/nest-services-local.yaml` → `spec.template.spec.ignoreDifferences`
- `k8s/argocd/applications/web.yaml`, `.../prediction-service.yaml` → `spec.ignoreDifferences`
```yaml
ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers: [/spec/replicas]
```
Commit + push to `main`. Verify `kubectl scale deploy api-gateway --replicas=2` sticks and the Application stays `Synced`. Then **`docker stop` the 5 argocd containers again** for the load runs.

**3b. HPA** — `loadtest/hpa/api-gateway.yaml`:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api-gateway, namespace: ai-notification }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api-gateway }
  minReplicas: 1
  maxReplicas: 3            # 8 GB host ceiling
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }  # vs the 50m request
  behavior:
    scaleUp:   { stabilizationWindowSeconds: 0,   policies: [{ type: Pods, value: 1, periodSeconds: 30 }] }
    scaleDown: { stabilizationWindowSeconds: 180, policies: [{ type: Pods, value: 1, periodSeconds: 60 }] }
```
Optionally add HPA on `event-service` / `rule-engine-service` (`min 1, max 2`) purely to walk into and document the Postgres‑connection ceiling.

**3c. KEDA** (secondary demo) — `loadtest/keda/channel-service.yaml`, `prometheus` trigger:
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: channel-service, namespace: ai-notification }
spec:
  scaleTargetRef: { name: channel-service }
  minReplicaCount: 1
  maxReplicaCount: 3
  cooldownPeriod: 180
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://floci-prometheus:9090   # via a Service/Endpoints stub if keda-operator can't reach it directly
        query: sum(rabbitmq_queue_messages_ready{queue="channel-service.notification.created"})
        threshold: "30"
```
(Alt: `type: rabbitmq`, `host: http://guest:...@<backing>:15672`, `queueName: channel-service.notification.created`, `mode: QueueLength`, `value: "30"`.)

## Phase 4 — Re-test + prove + project

1. Re‑run the *exact* `k6 run ... loadtest/mainflow-open.js` with HPA active, argocd stopped → `out/autoscaled-open.json`.
2. Grafana: replica count 1→N, p95 recovering. `kubectl get hpa -w`.
3. **Comparison table** (`RESULTS.md`, numbers from the two summary JSONs):

| Metric | Baseline (1 replica) | Autoscaled (max 3) |
|---|---|---|
| Sustained req/s @ p95 < 300 ms | | |
| p95 at 2× baseline load | (SLO broken) | |
| Error rate at knee | | |
| Peak replicas (api‑gateway) | 1 | |
| Scale‑up latency spike | n/a | +__ ms for ~__ s |

4. **New edge** — with `api-gateway` scaled, the wall moves to `identity-service` (100‑conn ceiling) / `rule-engine` / RabbitMQ / host RAM. Reproduce, name it, evidence it.

5. **Capacity math** (`RESULTS.md` — the projection):
   - Measured: hot path at 1 replica sustains `X` req/s; per‑extra‑api‑gateway‑replica marginal gain `Δ`.
   - To reach **232/s**: `≈ 232 / (per‑replica hot‑path throughput)` replicas across `api-gateway + identity + event + rule-engine` → `≈ R × 0.25` vCPU + `≈ R × 0.25` GB for the app tier alone → `≈ N` real nodes (8 vCPU / 16 GB) + **PgBouncer** (else the 100‑conn wall) + a **short‑TTL Redis cache on `identity.ValidateToken`** (kills the per‑request auth round‑trip — the single biggest lever).
   - To reach **2315/s** (peak): `~10×` the above, or raise per‑pod CPU limits + Node cluster‑mode workers per pod + gRPC channel pooling + read replicas for the read paths.
   - State plainly: this host demonstrates the *shape* of the curve and the *per‑replica economics*; the absolute targets need the projected infra.

## Phase 5 — Trade-offs & edge cases (→ `RESULTS.md`)

1. **The local box is not the target** — control‑plane + stateful + observability overhead dominates 8 GB; the proof is per‑replica throughput + the projection, not an absolute number.
2. **CPU arbitration** — 2 k3s nodes + observability on 8 cores: unmanaged concurrency melted the host (load 44). Phase F runs strictly serial with the app node prioritised; real clusters solve this with node pools + requests/limits + `PriorityClass`.
3. **Node is single‑threaded** → scale out, not up; `250m` = hard per‑pod throughput ceiling.
4. **Shared auth hot path** — `identity-service` fronts *every* authed call; it saturates before the endpoint's own target. Fix: cache token validation (short‑TTL) to remove the per‑request round‑trip.
5. **Postgres 100‑conn ceiling** (documented, not fixed) — Prisma default pool × replicas × 9 DB services → `FATAL: too many clients` before CPU. Fix = `?connection_limit=` / PgBouncer / raise `max_connections`. DB‑owning services are *not* naive HPA candidates.
6. **HPA reaction lag + cold start** — no `startupProbe`, initContainers wait on rabbitmq/postgres, ~15–40 s to Ready → a latency degradation window on every scale‑up. Mitigate: `minReplicas > 1`, `scaleUp` tuning, predictive/scheduled scaling.
7. **Silent message loss under overload** — async handlers `nack(false,false)`: no requeue, no DLX. Show `messages_ready` climbing with no consumer → events lost. Fix: DLX + alerting.
8. **CPU‑HPA vs KEDA‑on‑queue** — CPU scales on a symptom (latency already degrading); queue depth scales on backlog, ahead of degradation. Request‑path → CPU HPA; queue workers (`channel-service`, `notification-service`) → KEDA.
9. **scaleDown flapping** — the 180 s stabilization trade‑off (cost vs thrash).
10. **The bottleneck moves** — must autoscale the whole hot path, or load‑shed at the edge (no throttler today — a finding).
11. **Stateful ≠ stateless** — backing_services don't HPA. Postgres = vertical + read replicas + PgBouncer; RabbitMQ = quorum queues / partitioning. This is *why* backing_services is a separate cluster / failure domain.
12. **ArgoCD + autoscaler coexistence** — without `ignoreDifferences` on `/spec/replicas`, GitOps self‑heal fights the autoscaler.

## Files created / modified

| Path | Change |
|---|---|
| `ai-notification-system/loadtest/mainflow-open.js` | new — `ramping-arrival-rate`, 2–30 req/s |
| `ai-notification-system/loadtest/mainflow-closed.js` | refactor of `baseline.js` — `ramping-vus`, fixed rule action, fatal `setup()` |
| `ai-notification-system/loadtest/lib/setup.js` | new — shared register/tenant/(ai-config)/rule setup |
| `ai-notification-system/loadtest/hpa/*.yaml` · `loadtest/keda/channel-service.yaml` | new — autoscalers |
| `ai-notification-system/loadtest/out/*.json` | new — k6 summary exports |
| `ai-notification-system/loadtest/RESULTS.md` | new — edge report + comparison + capacity math + trade‑offs |
| `platform-gitops/k8s/argocd/applicationsets/nest-services-local.yaml` · `applications/{web,prediction-service}.yaml` | add `ignoreDifferences` `/spec/replicas` |
| `platform-gitops/k8s/environments/local/values-api-gateway.yaml` | *if needed* — `env.METRICS_PROMETHEUS_PORT: "9464"` |
| `ai-notification-system/apps/api-gateway/src/main.ts` | *optional* — add `@nestjs/swagger` `/docs` |
| `platform-infrastructure/secrets.local.tfvars` | fill `openai_api_key` (gitignored) |

## Verification

- **Setup:** `setup()` completes (token + tenant + rule); a manual `POST /events` → 201; `GET /events/:id` reaches a post‑`received` status. Secondary demo: Jaeger shows a full trace through `ai-service` with no `event.ai.failed`.
- **Phase 1:** both k6 runs finish, summary JSONs written, a clear knee with a named saturated pod + evidence.
- **Phase 3a:** `kubectl scale deploy api-gateway --replicas=2` persists; Application stays `Synced`.
- **Phase 3b/c:** `kubectl get hpa` `TARGETS` tracking; `kubectl get scaledobject` `READY=True`; under load, replicas rise in Grafana and the queue drains in Prometheus.
- **Phase 4:** `autoscaled-open.json` sustains a higher req/s at the SLO than `baseline-open.json`; comparison table filled; new bottleneck named + evidenced; capacity‑math projection written.
- **Done:** `RESULTS.md` has the edge report, the before/after table, the projection, and the Phase‑5 trade‑offs, each with a Grafana/Jaeger screenshot or a Prometheus result.

## Follow-ons (not this phase)

- Fix the connection ceiling: `?connection_limit=5` in the chart `DATABASE_URL` and/or PgBouncer; re‑run to show DB‑owning services scaling.
- Redis short‑TTL cache on `identity.ValidateToken`; re‑measure the hot‑path per‑replica throughput.
- KEDA on `notification-service`; `@nestjs/throttler` edge load‑shedding; RabbitMQ DLX.
- Repeat Phases 1–5 for supporting services (`analytics`, `audit`, `ai`) then backing services (where the answer is *not* HPA).

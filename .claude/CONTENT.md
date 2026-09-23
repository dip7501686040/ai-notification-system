# Development Log

Daily record of problems hit and how they were solved, for portfolio/interview reference.
Format per entry: short problem context, short solution context, resource links (repo file
links, screenshots, dashboards). Kept terse on purpose — no long explanations.

Screenshots referenced here live in `.claude/screenshots/YYYY-MM-DD/`.

---

## 2026-09-23

**Problem**: No persistent record of day-to-day engineering decisions/fixes across this
multi-repo project (`ai-notification-system`, `platform-gitops`, `platform-infrastructure`) —
context was only living in chat history, not shareable or interview-ready.
**Solution**: Started this log (`.claude/CONTENT.md`) and a `.claude/plans/` folder in-repo for
all planning docs (moved the active AWS plan here instead of leaving it outside the repo in
`~/.claude/plans/`).
**Resources**: [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

**Problem**: Planned to size the upcoming real-AWS EKS load test purely by adding more pods/nodes,
which would hit AWS cost without addressing the actual ceiling — not defensible as "industry
standard" for interviews.
**Solution**: Code-read confirmed two real architectural bottlenecks instead: (1) zero gRPC channel
pooling anywhere in the monorepo — a fresh `grpc.Client` is opened and closed per call, hottest
path is the auth guard running on every request; (2) all 9 services share one Postgres instance
with no `connection_limit`/PgBouncer, so replica count multiplies connections directly against
the 100-connection ceiling. Plan reordered so both get fixed and measured on the existing $0/month
OCI cluster first, and AWS gets sized from that real data — not a guess.
**Resources**:

- [packages/grpc/src/auth-client.ts](../packages/grpc/src/auth-client.ts)
- [apps/api-gateway/src/auth/grpc-auth.guard.ts](../apps/api-gateway/src/auth/grpc-auth.guard.ts)
- [infra/postgres/init.sql](../infra/postgres/init.sql)

**Problem**: Phase 0 — implement the two fixes above. (a) Every `*-client.ts` wrapper in
`packages/grpc/src` opened a brand-new `grpc.Client` (fresh TCP+DNS+HTTP/2 handshake) per RPC and
closed it immediately after — 9 files, ~50+ call sites, worst on the auth guard which runs on every
authenticated request. (b) 9 services × N replicas each opened Prisma's default connection pool
independently against one shared Postgres instance (`max_connections=100`, never changed from the
image default) — no `connection_limit`, no PgBouncer anywhere (repo lives in `platform-gitops`).
**Solution**: (a) Added `packages/grpc/src/channel-pool.ts` — a `Map<cacheKey, grpc.Client>` cache
keyed by `${service}:${address}`. Every client factory now returns the cached instance instead of
constructing a fresh one, and every `client.close()` call was removed (a pooled client is shared
across calls). `health-client.ts` was deliberately left unpooled — its whole job is measuring
per-check connect latency, so a fresh connection each time is correct there, not an oversight.
(b) Added a PgBouncer Deployment+Service to the `backing-services` Helm chart
(`docker.io/edoburu/pgbouncer:v1.24.1-p1`, wildcard `[databases]` entry via unset `DB_NAME` so all
9 logical databases route through one instance, `pool_mode=transaction`). `nest-service`'s
`postgresHost`/`postgresPort` now default to `pgbouncer:6432` with `?pgbouncer=true` on
`DATABASE_URL` (required — disables Prisma's prepared-statement cache, incompatible with
transaction pooling). The migrate Job deliberately bypasses this and stays hardcoded to
`postgres:5432` directly — `prisma migrate deploy` takes a session-scoped Postgres advisory lock,
which transaction pooling breaks. Both verified with `tsc`/`eslint`/`prettier` and
`helm template`/`helm lint` against a real service's values file before shipping.
**Resources**:

- [packages/grpc/src/channel-pool.ts](../packages/grpc/src/channel-pool.ts), [auth-client.ts](../packages/grpc/src/auth-client.ts) (hottest path), [tenant-client.ts](../packages/grpc/src/tenant-client.ts) (largest, 20 call sites)
- `platform-gitops/k8s/charts/backing-services/templates/pgbouncer.yaml`
- `platform-gitops/k8s/charts/nest-service/values.yaml` (`postgresHost`/`postgresPort`), `templates/migrate-job.yaml` (the deliberate bypass)
- Commits `3b6fd90` (gRPC, ai-notification-system), `a104d6c` (PgBouncer, platform-gitops)

**Problem**: Phase 0c — shipping both fixes to the live OCI cluster hit three unrelated infra
hiccups, none caused by the Phase 0 code itself. (1) `kubectl`/Terraform timed out — the recurring
dynamic-ISP-IP-rotation issue: the OCI security list still allowed the previous IP
(`103.77.136.5/32`), current one was `103.77.136.208/32`. (2) The GitHub Actions build came back
`failure`, but only on a spurious `build-and-push (grpc)` matrix job — Turborepo's affected-package
diff correctly flags every workspace package a change touches, including a shared package's own
name, which isn't in `.github/service-catalog.json` and has no Dockerfile; every real dependent
service built and pushed fine regardless. (3) Once ArgoCD synced `backing-services`, the new
`pgbouncer` pod crash-looped — readiness/liveness probes on 6432 failed with "connection refused"
because it was actually listening on `0.0.0.0:5432`.
**Solution**: (1) Patched the OCI security list in place via `oci network security-list update`
(surgical — replaced only the stale-IP rule, left every other rule, including OCI-CCM-managed LB
rules, untouched). (2) Fixed the workflow to filter Turborepo's affected list against the service
catalog before building the matrix. (3) The `edoburu/pgbouncer` image's `DB_PORT` env var only
configures the _backend_ Postgres port — the port it listens on itself is the separate
`LISTEN_PORT` env var (confirmed by reading `entrypoint.sh` directly, undocumented in the README);
added `LISTEN_PORT: "6432"`. All 14 ArgoCD apps reached Synced+Healthy via the RollingSync wave
(~7 minutes end to end) once this landed; `notification-service` (stuck on `Init:1/2` waiting for
pgbouncer) recovered on its own within seconds.
**Resources**:

- `.github/workflows/build-and-push.yml` (the catalog filter) — commit `e9c7254`
- `platform-gitops/k8s/charts/backing-services/templates/pgbouncer.yaml` (`LISTEN_PORT`) — commit `8307600`

**Problem**: With all 14 apps Synced+Healthy, still needed to prove Phase 0 actually works under
real traffic, not just "it deployed" — and separately, wanted screenshots captured as evidence,
not just described in text.
**Solution**: Logged in as the demo account (`proof-demo@dipankarsaha.dev`) against the live
`https://ainotification-api.duckdns.org`, hit `GET /tenants` repeatedly (goes through
`grpc-auth.guard.ts`'s `validateTokenViaGrpc` on every call). **gRPC pooling**: Jaeger traces show
`grpc.auth.v1.Auth/ValidateToken` averaging 6.5ms (range 5.3–10.4ms) across 8 calls — down from the
previously-documented 100–500ms/hop for a fresh channel, a ~20–75x drop. **PgBouncer**:
`pg_stat_activity` on Postgres shows exactly 9 backend connections (one per logical database), all
from PgBouncer's single pod IP rather than each service directly; `SHOW POOLS` confirms
`pool_mode: transaction` active on all 9. (Proving the connection count _stays_ flat as replica
count grows needs real load — that's the AWS ladder phase, not provable at today's idle 1-replica
baseline.) Captured both live via the Playwright MCP browser against Jaeger (reached through
`kubectl port-forward`), regenerating fresh traces since the original curl-based ones had already
aged out of Jaeger's in-memory storage.
**Resources**:

- [jaeger-tenants-search-results.png](screenshots/2026-09-23/jaeger-tenants-search-results.png) — 3 fresh `GET /tenants` traces, 11–36ms total
- [jaeger-trace-validatetoken-pooled-4.41ms.png](screenshots/2026-09-23/jaeger-trace-validatetoken-pooled-4.41ms.png) — full span waterfall, `ValidateToken` at 4.41ms
- Note: the repo's own `loadtest/grafana-phaseF.json` dashboard has a broken `${DS_PROMETHEUS}` datasource binding (pre-existing) — used the working "Platform Health" dashboard instead for the next entry below. Worth fixing before the AWS ladder phase.

**Problem**: User redirected the plan: instead of using an OCI k6 run to _derive_ AWS sizing math,
they want a preset target ladder (232 → 500 → 1000 → 2315 events/s, the SRS primary/stretch numbers
plus two checkpoints) climbed and proven with evidence one at a time on real AWS — but still wanted
an OCI baseline captured now, purely as a "before" data point for the portfolio story, not for sizing.
**Solution**: Fixed a local blocker first — `k6` couldn't connect at all (`dial: bad file
descriptor`, only for k6, not `curl`), which turned out to be LuLu (the outbound firewall from the
malware-cleanup hardening) never having been prompted/allowed for the `k6` binary; allowed it and
retried. Then ran `loadtest/mainflow-open.js` (open-model ramp: 2→20 req/s over ~3.5min) against
the live API. **Result: 9.6 req/s sustained** (1933 requests, 0% errors), **p95 latency 333.96ms**
(crossed the 300ms threshold — the free-tier node finding its edge), avg 119ms. Cross-checked
against Prometheus: no single pod exceeded **57m CPU** even at the ramp's peak — meaning the
ceiling is **not** per-pod CPU exhaustion, it's aggregate contention across ~16 co-located pods
sharing one 2-OCPU node. Useful, honest finding: the fix that matters on AWS isn't "give services
more CPU each", it's "stop cramming 16 pods onto one small node" — real horizontal spread across
proper node capacity.
**Resources**:

- `loadtest/mainflow-open.js`, `loadtest/out/oci-baseline-open.json` (full k6 summary)
- [grafana-oci-baseline-request-error-rate.png](screenshots/2026-09-23/grafana-oci-baseline-request-error-rate.png) — Platform Health dashboard, live request-rate ramp for the load-test tenant + flat 0% error rate
- Next: Phase 1 onward — AWS budget, Terraform fixes, provision, then climb the 232 → 500 → 1000 →
  2315 events/s ladder on real AWS, each rung proven with evidence (including screenshots) before
  scaling to the next — see [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

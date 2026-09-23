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
- [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

**Problem**: Phase 0a — implement the gRPC channel pooling fix identified above. Every `*-client.ts`
wrapper in `packages/grpc/src` opened a brand-new `grpc.Client` (fresh TCP+DNS+HTTP/2 handshake)
per RPC and closed it immediately after — 9 files, ~50+ call sites, worst on the auth guard which
runs on every authenticated request.
**Solution**: Added `packages/grpc/src/channel-pool.ts` — a `Map<cacheKey, grpc.Client>` cache
keyed by `${service}:${address}`. Every client factory (`createClient`/`createAuthClient` in all 9
files) now returns the cached instance instead of constructing a fresh one, and every `client.close()`
call was removed (a pooled client is shared across calls, so closing it after one RPC would break
the next). `health-client.ts` was deliberately left unpooled — its whole job is measuring per-check
connect latency and reachability, so a fresh connection each time is correct there, not an oversight.
Verified with `tsc --noEmit` (clean), `eslint` (clean), `prettier --check` (clean), and confirmed
zero gRPC-related errors when typechecking `api-gateway` against the built package.
**Resources**:

- [packages/grpc/src/channel-pool.ts](../packages/grpc/src/channel-pool.ts)
- [packages/grpc/src/auth-client.ts](../packages/grpc/src/auth-client.ts) (hottest path: `createAuthClient`, used by `validateTokenViaGrpc`)
- [packages/grpc/src/tenant-client.ts](../packages/grpc/src/tenant-client.ts) (largest file, 20 call sites touched)
- Next: PgBouncer (Phase 0b), then ship both via CI and verify via Jaeger/`pg_stat_activity` on the live OCI cluster (Phase 0c) — see [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

**Problem**: Phase 0b — the other confirmed bottleneck. 9 services × N replicas each open Prisma's
default connection pool independently against one shared Postgres instance (`max_connections=100`,
never changed from the image default), so the ceiling scaled with replica count regardless of node
capacity — no `connection_limit`, no PgBouncer, no shared pooling anywhere (repo lives in
`platform-gitops`, not this one).
**Solution**: Added a PgBouncer Deployment+Service to the `backing-services` Helm chart
(`docker.io/edoburu/pgbouncer:v1.24.1-p1`, wildcard `[databases]` entry via unset `DB_NAME` so all
9 logical databases route through one instance, `pool_mode=transaction`, `default_pool_size=20`).
`nest-service`'s `postgresHost`/`postgresPort` now default to `pgbouncer:6432` with `?pgbouncer=true`
on `DATABASE_URL` (required — disables Prisma's prepared-statement cache, which is incompatible
with transaction pooling). The migrate Job deliberately does **not** use those values and stays
hardcoded to `postgres:5432` directly — `prisma migrate deploy` takes a session-scoped Postgres
advisory lock, which transaction pooling breaks (lock/unlock can land on two different pooled
connections). Verified with `helm template`/`helm lint` against `identity-service`'s real values
file: deployment resolves through `pgbouncer:6432`, migrate job resolves through `postgres:5432`,
both as intended.
**Resources**:

- `platform-gitops/k8s/charts/backing-services/templates/pgbouncer.yaml`
- `platform-gitops/k8s/charts/nest-service/values.yaml` (`postgresHost`/`postgresPort`)
- `platform-gitops/k8s/charts/nest-service/templates/migrate-job.yaml` (the deliberate bypass)
- Next: Phase 0c — ship both Phase 0a+0b fixes through the existing CI/CD pipeline to the live OCI
  cluster, verify via Jaeger (per-hop gRPC latency) and `pg_stat_activity` (bounded connection count
  under load) — see [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

**Problem**: Phase 0c, shipping the fixes — two unrelated infra hiccups hit along the way, not caused
by the Phase 0a/0b code itself. (1) `kubectl`/Terraform to the OCI cluster timed out — the recurring
dynamic-ISP-IP-rotation issue: the OCI security list still allowed the previous IP
(`103.77.136.5/32`), current one was `103.77.136.208/32`. (2) The GitHub Actions build for
`0cc64eb` came back `failure` — but only on a spurious `build-and-push (grpc)` matrix job.
Turborepo's affected-package diff correctly includes every workspace package a change touches, not
just deployable ones — an isolated `packages/grpc`-only change (no service code touched) surfaced
`grpc` itself as "affected", which isn't in `.github/service-catalog.json` and has no Dockerfile.
Every real dependent service (api-gateway, event-service, etc.) built and pushed fine regardless —
confirmed via `platform-gitops` git log showing all 11 image-tag-bump commits landed.
**Solution**: (1) Patched the OCI security list in place via `oci network security-list update`
(surgical — read the full rule set, replaced only the stale-IP ingress rule, left every other rule,
including OCI-CCM-managed LB rules, untouched). (2) Fixed the workflow to filter Turborepo's affected
list against the service catalog before building the matrix, so a shared-package-only change no
longer produces a false-red CI run.
**Resources**:

- `.github/workflows/build-and-push.yml` (the catalog filter)
- Commit `e9c7254` (ai-notification-system)
- Next: once ArgoCD finishes syncing all 14 apps, verify via Jaeger + `pg_stat_activity` on the live
  cluster — see [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

**Problem**: Once ArgoCD synced `backing-services`, the new `pgbouncer` pod crash-looped —
readiness/liveness probes on port 6432 failed with "connection refused". Container logs showed it
was actually listening on `0.0.0.0:5432`, not 6432.
**Solution**: The `edoburu/pgbouncer` image's `DB_PORT` env var only configures the _backend_
Postgres port pgbouncer connects out to — the port it listens on itself is a separate `LISTEN_PORT`
env var (undocumented in the README, confirmed by reading `entrypoint.sh` directly), which I hadn't
set, so it fell back to the image's own default of 5432. Added `LISTEN_PORT: "6432"` to the
container spec. Confirmed live: new pod's logs show `listening on 0.0.0.0:6432`, then successful
wildcard auto-database registrations (`notification_db`, `ai_db`, ...) and real connections through
to Postgres as each service's initContainer started reaching it. `backing-services` ArgoCD app went
Synced+Healthy; `notification-service` (which had been stuck on `Init:1/2` waiting for pgbouncer)
recovered on its own within seconds, no restart needed.
**Resources**:

- `platform-gitops/k8s/charts/backing-services/templates/pgbouncer.yaml` (`LISTEN_PORT`)
- Commit `8307600` (platform-gitops)

**Problem**: All 14 ArgoCD apps reached Synced+Healthy (via the RollingSync ApplicationSet wave, ~7
minutes end to end, no manual intervention needed beyond the pgbouncer fix above) — final step was
proving Phase 0a+0b actually work with real traffic, not just "it deployed".
**Solution**: Logged in as the demo account (`proof-demo@dipankarsaha.dev`) against the live
`https://ainotification-api.duckdns.org`, then hit `GET /tenants` (goes through
`grpc-auth.guard.ts`'s `validateTokenViaGrpc` on every call) 8 times. Pulled the resulting traces
from Jaeger: **`grpc.auth.v1.Auth/ValidateToken` client-side span averaged 6.5ms (range 5.3–10.4ms)
across all 8 calls** — down from the previously-documented 100–500ms/hop for a fresh channel, a
~20–75x drop, exactly matching the pooled-channel prediction. Separately confirmed the PgBouncer fix
structurally: `pg_stat_activity` on Postgres shows exactly 9 backend connections (one per logical
database), all originating from a single `client_addr` (PgBouncer's pod IP) rather than from each
service directly — `SHOW POOLS` on PgBouncer's admin console confirms `pool_mode: transaction` is
active for all 9 databases. Full proof of "connection count stays flat as replica count grows" needs
real load (Phase 0.5's k6 run with HPA scaling replicas up), not provable at today's idle 1-replica
baseline — but the mechanism is confirmed wired up correctly.
**Resources**:

- Jaeger UI: `kubectl port-forward -n observability svc/jaeger 16686:16686`, service `api-gateway`
- `apps/api-gateway/src/auth/grpc-auth.guard.ts` (the traced call path)
- Phase 0 (gRPC pooling + PgBouncer) is now fully shipped and verified on OCI. Next up: Phase 0.5 —
  re-run k6 load tests against this fixed deployment and derive real AWS sizing from measured
  Prometheus data — see [.claude/plans/aws-eks-load-test-deployment.md](plans/aws-eks-load-test-deployment.md)

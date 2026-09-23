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

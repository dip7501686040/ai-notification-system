# Development Log

Daily record of problems hit and how they were solved, for portfolio/interview reference.
One line per topic: problem → solution, key numbers/commits inline, resource link at the end.

Screenshots referenced here live in `.claude/screenshots/YYYY-MM-DD/`.

---

## 2026-09-23

- **Devlog setup**: started this log + moved the AWS plan in-repo to `.claude/plans/` for shareable, persistent tracking. → [plan](plans/aws-eks-load-test-deployment.md)
- **Bottleneck diagnosis**: code-read found the real AWS ceiling is zero gRPC channel pooling + no PgBouncer (not node/pod count) — reordered the plan to fix and prove both on the $0/month OCI cluster before touching AWS. → [auth-client.ts](../packages/grpc/src/auth-client.ts), [grpc-auth.guard.ts](../apps/api-gateway/src/auth/grpc-auth.guard.ts)
- **Phase 0 implementation**: added `channel-pool.ts` (pools clients across all 9 `*-client.ts` files, removed every `client.close()`) and a PgBouncer transaction-pooling proxy in front of Postgres (migrate Job deliberately bypasses it — advisory locks break under pooling). Commits `3b6fd90` (grpc), `a104d6c` (pgbouncer).
- **Phase 0c shipping**: fixed 3 unrelated infra hiccups while deploying to OCI — stale security-list IP from ISP rotation, a spurious CI matrix job for a non-deployable shared package, and PgBouncer crash-looping on the wrong `LISTEN_PORT`. Commits `e9c7254`, `8307600`.
- **Phase 0 verification (live traffic)**: proved both fixes work — `ValidateToken` averaged 6.5ms (was 100–500ms/hop), `pg_stat_activity` shows exactly 9 pooled backend connections instead of one-per-replica. → [jaeger-trace-validatetoken-pooled-4.41ms.png](screenshots/2026-09-23/jaeger-trace-validatetoken-pooled-4.41ms.png)
- **Plan redirect + OCI baseline**: user wants a 232→500→1000→2315 events/s target ladder proven on real AWS (not sizing derived from OCI); captured OCI's baseline as the "before" evidence — 9.6 req/s sustained, p95 333.96ms, no pod over 57m CPU (ceiling is node contention, not compute). → [grafana-oci-baseline-request-error-rate.png](screenshots/2026-09-23/grafana-oci-baseline-request-error-rate.png)
- **AWS credential setup**: initial `aws login` authenticated as root (not scoped, real risk for an interview-facing project) — created IAM user `terraform-admin` (AdministratorAccess + `SignInLocalDevelopmentAccess`), switched the browser console session to it, re-ran `aws login` for short-lived auto-rotating credentials instead of a static access key. Region `ap-south-1` (matches OCI's `ap-mumbai-1`, changed from the plan's original `us-east-1` default at user's request).
- **Phase 1 (AWS Budget)**: created a $20/month budget with 5 escalating alert thresholds (25%/50%/100%/200% actual, 100% forecasted), mirroring the OCI budget ladder — verified live, all 5 in `OK` state. → `platform-infrastructure/aws-budget/`, commit `542982f`
- **OCI cleanup**: found + committed 3 pending Terraform changes from an earlier session (`OPENAI_API_KEY` wiring, current IP) that were never applied — `terraform plan` confirmed exactly one clean resource change, applied it, restarted `ai-service` to pick up the real key. Commit `eb8081d` (platform-infrastructure).

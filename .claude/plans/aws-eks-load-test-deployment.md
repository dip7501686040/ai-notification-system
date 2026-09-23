# Code Efficiency Fixes (on OCI) → Real AWS EKS Load-Test Deployment — AI Notification System

## Context

The OCI/OKE deployment (done, live, $0/month) proved the GitOps/CI/HPA mechanics work, but its single 2-OCPU Always Free node can never genuinely reach the original SRS load targets (232/2315 events/s) — that ceiling is architectural, not a config problem. Goal: stand up a **real** AWS EKS cluster, sized to actually chase those numbers, run the real load test + HPA/KEDA proof there, capture evidence, then tear the whole thing down — repeated a handful of times over the next month while learning the process. Fully independent from the OCI side (own ArgoCD/observability, not multi-cluster GitOps).

**Reordered after a direct question about whether the estimated AWS sizing would actually hit the SRS numbers.** It wouldn't, not from node count alone — the real ceiling is two specific, already-diagnosed architectural gaps (confirmed via a fresh code read, not assumption — see below), and blindly adding pods to compensate is exactly the "inefficient, not industry-standard" outcome the user explicitly does not want for an interview-facing portfolio piece. So the actual first move is fixing those two things **in code, validated on the already-running $0/month OCI cluster**, using the existing CI/CD pipeline that's already built — zero AWS spend for this part. Only once the fix is proven does AWS get provisioned at all, sized against real measured data instead of guesses, to chase the now-higher achievable ceiling.

## The two confirmed bottlenecks (verified via direct code read 2026-09-23, not assumption)

1. **No gRPC channel pooling — zero, anywhere.** Every cross-service gRPC call across the whole monorepo opens a brand-new `grpc.Client` (fresh TCP+DNS+HTTP/2 handshake) and closes it after one RPC. Confirmed in all 8 client wrapper files (`packages/grpc/src/{ai,auth,tenant,event,rule,notification,template,analytics,audit}-client.ts`), ~50+ call sites, no `ClientsModule`/`ClientGrpc` NestJS pattern in use anywhere, no singleton, no per-address cache. The hottest path is `apps/api-gateway/src/auth/grpc-auth.guard.ts:25` — this guard runs on **every authenticated HTTP request** through the gateway, meaning every single request pays a full fresh-channel cost just to validate the token, before any real work happens. This is exactly what Jaeger's 100-500ms/hop finding was showing.
2. **Postgres connection ceiling, unmitigated.** 9 separate databases on one Postgres instance (`max_connections=100`), all 9 `schema.prisma` files identical with no `connection_limit` set anywhere, so every replica of every one of the 9 services opens Prisma's _default_ pool size (`2×vCPU+1`) independently. No PgBouncer, no shared Prisma wrapper. Confirmed via direct `diff` that all 9 `prisma.service.ts` files are byte-identical — this is mechanical, not architecturally hard to fix, just never done. At even 10-15 replicas of a couple of hot services this ceiling gets hit regardless of node/CPU capacity — more AWS compute cannot move this number.

**Redis, checked and ruled out as a lever**: already correctly used for rate-limiting and Socket.IO fan-out in `api-gateway` only — not a caching layer today, not part of either bottleneck, no fix needed there for this pass.

**Hard operating rule, more consequential here than it was on OCI:** OCI's worst-case accident capped near $0. AWS does not — a forgotten running cluster burns **$150–200+/month** at this exact shape (verified current pricing: EKS control plane $0.10/hr flat, not covered by any free tier; `t3.medium` ~$0.0416/hr; NAT Gateway $0.045/hr; ALB ~$0.0225/hr + LCU). Every session ends in `terraform destroy`, no exceptions — the $100 credit isn't the constraint (a 3hr session costs under $1; a month of 8-10 sessions costs ~$7-10, comfortably inside the credit), _forgetting to tear down_ is.

**Verified 2026-09-23** (new AWS account, created after July 15 2025 policy change):

- [AWS Free Tier update, July 2025](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/) — $100 credit at signup (up to $200 with activity bonus), 6-month free plan window (matches the account's "182 days"), credits usable 12 months from signup, 30+ always-free services separate from this budget.
- [EKS/EC2/NAT/ALB current pricing](https://www.cloudzero.com/blog/eks-pricing/) — figures above.

## Known bug in the existing Terraform — must fix before first apply

`platform-infrastructure/main.tf`'s `module.network_backing_services` / `module.eks_backing_services` / `module.addons_backing_services` (`main.tf:1046-1082`) are **not gated by `count`**, unlike every Floci-only resource, and reference `local.backing_services_name` → `var.clusters["backing_services"].cluster_name`. `envs/prod.tfvars` only defines `clusters.app_services` — applying it as-is either errors on the missing map key, or (if that key is added) silently provisions a **second full VPC + EKS cluster** nobody asked for. Fix: delete the `backing_services`/`jenkins`/`argocd`/`observability` cluster trio's resource blocks from the real-AWS path entirely (they're Floci multi-cluster artifacts; this deployment is one cluster, one namespace-per-concern, matching how the OCI side ended up structured) — not just patch the tfvars map.

## What's already built and reusable (confirmed via direct code read, not assumed)

- **Real EKS cluster + node group + IAM roles**: `modules/eks/` — genuine `aws_eks_cluster`/`aws_eks_node_group`, not Floci emulation.
- **Real VPC/subnets/NAT/routing**: `modules/network/`.
- **Real ECR**, 13 repos, unconditional: `modules/ecr/`.
- **Real ALB** fronting `web`/`api-gateway`: `modules/loadbalancer/` (dual-mode, already branches correctly off `manage_floci` for target-type and security groups).
- **IRSA roles** for EBS CSI + AWS LB Controller, upstream policy JSON already vendored: `modules/addons/`.
- `outputs.tf` already exposes `ecr_repository_urls`, `cluster_endpoint`, `kubeconfig_command`.
- `envs/prod.tfvars` is 90% there (region, VPC CIDR, node sizing, `enable_irsa_addons=true`, `manage_floci=false` already set) — needs the bug fix above, region reconsidered, and node sizing revisited for the real-load-test goal.

## What's placeholder or needs to be written fresh

- **`secrets.aws.tfvars`** — doesn't exist; create from `secrets.tfvars.example`, real values (JWT/Postgres/RabbitMQ passwords, OpenAI key already known from the OCI side, GitHub push token already known).
- **`jenkins/env/prod.properties`** in platform-gitops — `AWS_REGION`/`ECR_REGISTRY` still literally say `REPLACE_WITH_*`.
- **A new GitHub Actions workflow** (or extend the existing one) targeting ECR instead of Docker Hub, and a **new `k8s/environments/aws-prod/`** values tree — the existing `prod/` directory is already claimed by the live OCI deployment (Docker Hub image refs, `*.duckdns.org` CORS/callback URLs); re-overwriting it would break the still-running OCI site. A parallel `aws-prod` tree avoids that collision entirely.
- **Fresh ArgoCD + observability on the AWS cluster** — ADR above: fully independent, not reusing OCI's.
- **No prod-equivalent of `scripts/tf.sh`** — apply by hand with real AWS credentials and explicit `-var-file` flags; this is fine at this scale, a wrapper script isn't worth building for occasional bursts.
- **Local-file Terraform state** (`envs/prod.backend.hcl` → `envs/state/prod.tfstate`) — acceptable for a solo, ephemeral-by-design cluster; no S3/DynamoDB backend needed for this use case.
- **An AWS Budget + alert escalation ladder** mirroring the OCI one — set up in Phase 1, before the first real AWS apply.

## Architecture decisions for this pass

- **Public subnets for worker nodes, no NAT Gateway.** This is a deliberately different call from OCI's private-subnet design: there, the cluster runs permanently and the security posture matters long-term. Here, the cluster exists for a few hours at a time and is destroyed immediately after — the NAT Gateway's $0.045/hr (plus data processing) buys security value that doesn't matter for a burst lab environment, and removing it simplifies the network module changes needed. Nodes get public IPs behind tight security groups (only the ALB's ports + your current IP for kubectl, same `/32` discipline as the OCI VCN).
- **Node sizing driven by Phase 0.5's measured data, not a guess.** `t3.medium` as a starting shape (existing default), with `node_desired_size`/`max` raised beyond the current 2/3 — but the actual replica/node counts needed come from real measured per-pod CPU/memory under load (Phase 0.5), not an assumed number. Fine-tuned further live during the AWS load test itself, informed by whatever the first real run shows.
- **Region**: keep `us-east-1` (already default in `prod.tfvars`) — cheapest, most fully-featured region, and latency doesn't matter for a load test you're driving from a k6 run, not real users.
- **Reuse what's already known**: OpenAI key, GitHub push token, JWT/Postgres/RabbitMQ password values already exist in `platform-infrastructure/oci/secrets.oci.tfvars` — copy forward into `secrets.aws.tfvars` rather than regenerating.

## Phased implementation (after approval)

### Phase 0 — Fix both bottlenecks in code, validated on OCI, $0 extra spend

**0a. gRPC persistent channel pooling.** Add a shared channel cache to `packages/grpc/` (new module, e.g. `channel-pool.ts`) keyed by target address: first call to a given service creates the `grpc.Client` and caches it, every subsequent call reuses the same instance instead of opening a fresh one. This is grpc-js's intended usage pattern (a `Client` multiplexes many calls over one persistent HTTP/2 connection) — reuse isn't a workaround, it's using the library correctly. Touches all 8 `packages/grpc/src/*-client.ts` files (`createClient`/`createAuthClient` factories) and removes the per-call `client.close()` sites; the highest-value path to verify first is `apps/api-gateway/src/auth/grpc-auth.guard.ts` since it runs on every authenticated request.

**0b. PgBouncer in front of Postgres, transaction-pooling mode.** Add a `pgbouncer` container to the `backing-services` chart (`platform-gitops/k8s/charts/backing-services/`), sitting between all 9 services and the single Postgres instance, listening on 6432. Point every service's `DATABASE_URL` at PgBouncer instead of Postgres directly (a `postgresPort` value added to the `nest-service` chart, defaulting to 6432). One specific, real-world gotcha worth building in from the start rather than discovering later: Prisma requires `?pgbouncer=true` in the connection string when the pool is in transaction mode (disables prepared-statement caching, which doesn't work with transaction pooling) — this is documented Prisma behavior, not a guess.

**0c. Ship + verify on OCI.** Both fixes go through the existing GitHub Actions → Docker Hub → ArgoCD pipeline exactly like any other change — no new infrastructure needed to validate this. Verify the gRPC fix via Jaeger (per-hop latency should drop from the previously-measured 100-500ms toward single-digit ms for a reused channel). Verify the Postgres fix via `pg_stat_activity` connection counts staying flat and low even as replica counts increase, instead of scaling linearly with replicas.

### Phase 0.5 — Evidence-based sizing (still on OCI, still $0)

Re-run the existing k6 scripts (`loadtest/mainflow-open.js`/`mainflow-closed.js`) against the now-fixed OCI deployment. Use Prometheus's real per-pod CPU/memory data (`container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`) — captured before and after the Phase 0 fixes, a genuine quantified before/after artifact — to derive actual measured resource requests/limits, replacing the original guessed `30-50m/96-256Mi` Helm defaults. These measured numbers become the basis for the AWS node/pod sizing in Phase 2, not another guess.

### Phase 1 — AWS account safety net

Set up AWS Budgets + an escalating alert ladder (same shape as the OCI one: e.g. $5/$10/$25/$50/$100 thresholds on both ACTUAL and FORECASTED), confirmed email subscription. Can happen any time before the first real AWS apply.

### Phase 2 — Fix the AWS Terraform, apply evidence-based sizing

Remove the unconditional `backing_services`/`jenkins`/`argocd`/`observability` cluster blocks from `main.tf`'s real-AWS path (the bug above). Adjust `modules/network` for public-subnet-only nodes (drop NAT Gateway resources, or gate them off). Create `secrets.aws.tfvars`. Set `envs/prod.tfvars` node sizing and Helm resource requests/limits from Phase 0.5's real measurements, not the original guesses.

### Phase 3 — First provision + teardown rehearsal

Apply against real AWS with real credentials, verify EKS cluster comes up, `kubectl get nodes` works, then **immediately `terraform destroy`** before doing anything else — proving the full cycle works cleanly before ever leaving it up long enough to explore. First concrete lesson: prove teardown works _before_ trusting yourself to use the environment.

### Phase 4 — Real session: deploy the (now-optimized) app

Provision, push images to the now-real ECR (new GitHub Actions workflow or manual `docker push` for the first pass), deploy the 13 services + backing services including PgBouncer (fresh Helm installs, same charts as OCI/OKE, carrying the Phase 0 fixes forward — no chart logic changes needed beyond what Phase 0 already built, just new `aws-prod` values), verify healthy, verify the ALB URL reachable.

### Phase 5 — HPA/KEDA + real load test

Apply `loadtest/hpa/api-gateway.yaml` and `loadtest/keda/channel-service.yaml` (KEDA installed fresh here too), run the k6 scripts at real target rates, watch it scale. Because the two architectural bottlenecks are already fixed, this run should get meaningfully further than node-count-alone ever could — capture Grafana/dashboard evidence of the before/after gain (both the OCI-vs-AWS jump AND the pre-fix-vs-post-fix jump), the genuine deliverable.

### Phase 6 — Evidence capture, then destroy

Screenshots/exports of the scaling proof, then `terraform destroy` the same session, confirmed via the AWS Console/CLI that nothing's left running.

**Repeat Phases 4-6** as many times as useful over the coming weeks — each a clean provision→learn→evidence→destroy cycle, informed by what the previous run showed.

## Verification criteria

- After Phase 0: Jaeger shows measurably lower per-hop gRPC latency; `pg_stat_activity` connection count stays bounded under load instead of scaling with replica count.
- After Phase 2: `terraform validate`/`plan` against `prod.tfvars` + `secrets.aws.tfvars` shows only the intended single-cluster resource set — no second VPC/EKS cluster in the plan.
- After Phase 3: a full provision→`kubectl get nodes`→destroy cycle completes with the AWS Console showing zero EKS clusters, zero EC2 instances, zero load balancers afterward.
- After Phase 5: Grafana (or CLI fallback) shows a real before/after replica-count and latency change across the HPA/KEDA scale event, at meaningfully higher throughput than both the OCI single-node ceiling AND the pre-Phase-0 architecture ever allowed — and a documented, evidence-backed explanation of exactly what stands between the achieved number and the 2315/s stretch target.
- Every AWS session: a Budget alert never fires unexpectedly between sessions (would mean something wasn't torn down).

## Follow-ons (out of scope for this pass)

- A prod-equivalent of `scripts/tf.sh` (real AWS credential wrapper) — only worth building if this becomes a much more frequent workflow than "a few sessions this month."
- Remote Terraform state (S3+DynamoDB) — solo/ephemeral use doesn't need it yet.
- Any long-term/always-on AWS presence — explicitly not the goal here.

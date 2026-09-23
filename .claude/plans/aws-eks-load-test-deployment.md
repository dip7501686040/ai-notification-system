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
- **Node/replica sizing driven live by the target ladder, not pre-computed.** `t3.medium` as a starting shape (existing default). Rather than deriving a fixed sizing number in advance, AWS provisioning starts at a small/cheap size and each rung of the target ladder (see "Target ladder" below) is climbed by scaling up (replicas via HPA/manual, nodes via `node_desired_size`) only as far as needed to hit that rung — so the scaling curve itself (replicas/nodes vs. throughput achieved) becomes the evidence, not just a single end-state sizing number.
- **Region**: `ap-south-1` (Mumbai) — changed from `prod.tfvars`'s `us-east-1` default 2026-09-23 at the user's request, to match both the AWS console's already-configured default and the OCI side's `ap-mumbai-1` region. Slightly pricier than `us-east-1` for EKS/EC2/NAT (a few % difference), but immaterial at this session-based, torn-down-after-use scale, and latency doesn't matter for a load test driven from a k6 run, not real users.
- **Reuse what's already known**: OpenAI key, GitHub push token, JWT/Postgres/RabbitMQ password values already exist in `platform-infrastructure/oci/secrets.oci.tfvars` — copy forward into `secrets.aws.tfvars` rather than regenerating.

## Target ladder (redirected 2026-09-23)

Not a single AWS sizing exercise — a staged climb, each rung proven with real evidence before scaling to the next, within one continuous AWS session (re-provisioning between rungs would just waste the scaling-curve narrative):

1. **232 events/s** — the SRS primary target.
2. **500 events/s** — first checkpoint past primary.
3. **1000 events/s** — second checkpoint.
4. **2315 events/s** — the SRS stretch target.

At each rung: run the k6 open-model test at that target rate, capture evidence (k6 summary JSON, Grafana/Prometheus screenshots showing replica count + per-pod resource usage + latency during the run), and only scale up (HPA/replica counts, node group size) if that rung isn't cleanly met. The **OCI baseline (9.6 req/s sustained, p95 333.96ms, captured 2026-09-23 — see `.claude/CONTENT.md`) is the "before" reference point**, not a sizing input — it exists to make the AWS scaling story concrete ("a single free-tier node tops out around 10/s; here's what real horizontal scaling achieves").

## Phased implementation (after approval)

### Phase 0 — Fix both bottlenecks in code, validated on OCI, $0 extra spend

**Status (2026-09-23): Phase 0 fully done — 0a, 0b, and 0c all shipped, deployed, and verified with real traffic on the live OCI cluster.** See `.claude/CONTENT.md` for the day-by-day record, including two infra hiccups hit and fixed along the way (a stale OCI security-list IP, a CI catalog-filter bug, and a PgBouncer `LISTEN_PORT` misconfiguration).

**0a. gRPC persistent channel pooling.** ✅ Done — `packages/grpc/src/channel-pool.ts` added, all 9 `*-client.ts` factories pooled, all stray `client.close()` calls removed (health-client.ts deliberately excluded). Commit `3b6fd90`. Add a shared channel cache to `packages/grpc/` (new module, e.g. `channel-pool.ts`) keyed by target address: first call to a given service creates the `grpc.Client` and caches it, every subsequent call reuses the same instance instead of opening a fresh one. This is grpc-js's intended usage pattern (a `Client` multiplexes many calls over one persistent HTTP/2 connection) — reuse isn't a workaround, it's using the library correctly. Touches all 8 `packages/grpc/src/*-client.ts` files (`createClient`/`createAuthClient` factories) and removes the per-call `client.close()` sites; the highest-value path to verify first is `apps/api-gateway/src/auth/grpc-auth.guard.ts` since it runs on every authenticated request.

**0b. PgBouncer in front of Postgres, transaction-pooling mode.** ✅ Done — `pgbouncer` Deployment+Service added to `backing-services` chart (`docker.io/edoburu/pgbouncer:v1.24.1-p1`, wildcard `[databases]` entry, `pool_mode=transaction`), `nest-service`'s `postgresHost`/`postgresPort` now default to `pgbouncer:6432` with `?pgbouncer=true` on `DATABASE_URL` (disables Prisma's prepared-statement cache, required in transaction-pooling mode — documented Prisma behavior, not a guess). The migrate Job deliberately bypasses PgBouncer and talks to `postgres:5432` directly (`prisma migrate deploy`'s advisory lock is session-scoped, which transaction pooling breaks). Verified via `helm template`/`helm lint` against a real service's values file. Commit `a104d6c` (platform-gitops).

**0c. Ship + verify on OCI.** ✅ Done — both fixes pushed and deployed via the existing GitHub Actions → Docker Hub → ArgoCD pipeline (all 14 apps Synced+Healthy). **Verified with real traffic, not just a healthy-pod check**: logged into the live demo account at `https://ainotification-api.duckdns.org`, hit `GET /tenants` 8 times, pulled the resulting traces from Jaeger. `grpc.auth.v1.Auth/ValidateToken` (the hottest path — runs on every authenticated request via `grpc-auth.guard.ts`) averaged **6.5ms per call (range 5.3–10.4ms)**, down from the previously-measured 100–500ms/hop for a fresh channel — a ~20–75x drop, exactly matching the pooled-channel prediction. Separately confirmed PgBouncer structurally: `pg_stat_activity` on Postgres shows exactly 9 backend connections (one per logical database), all from PgBouncer's single pod IP rather than from each service directly; `SHOW POOLS` confirms `pool_mode: transaction` active on all 9. (Proving the connection count _stays_ flat as replica count grows needs real load — that's Phase 0.5 below, not re-provable at today's idle 1-replica baseline.)

### Phase 0.5 — OCI baseline evidence ✅ Done ($0, no AWS touched)

Not a sizing exercise (superseded — see "Target ladder" above). Ran `loadtest/mainflow-open.js` against the live, now-fixed OCI deployment purely to capture a "before" reference point. Result: **9.6 req/s sustained, 0% errors, p95 latency 333.96ms** (crossed the 300ms threshold — found the edge), and critically, Prometheus showed **no single pod above 57m CPU** even at peak — the ceiling here is aggregate contention across ~16 pods sharing one 2-OCPU node, not per-pod CPU exhaustion. Full writeup in `.claude/CONTENT.md` (2026-09-23). This number is the "before" side of the AWS scaling story, not an input to AWS sizing math.

### Phase 1 — AWS account safety net ✅ Done

$20/month AWS Budget (`ai-notification-aws-loadtest`) with 5 escalating thresholds — ACTUAL 25%/50%/100%/200%, FORECASTED 100% — email subscription confirmed live via `aws budgets describe-notifications-for-budget` (all 5 in `OK` state). Also set up along the way: AWS CLI v2 + `aws login` (short-lived, auto-rotating credentials — no static access keys), a dedicated `terraform-admin` IAM user instead of using root for CLI/Terraform work, and region switched to `ap-south-1` (Mumbai) to match the OCI side. Config in `platform-infrastructure/aws-budget/`, commit `542982f`.

### Phase 2 — Fix the AWS Terraform, start at a small baseline size ✅ Done

Gated `module.network_backing_services`/`eks_backing_services`/`addons_backing_services` on `var.manage_floci` (matching every other Floci-only resource) and fixed all downstream `[0]` reference indexing. The real root cause was one level up: `locals`' `jenkins_name`/`argocd_name`/`observability_name`/`backing_services_name` indexed `var.clusters[...]` unconditionally — evaluated regardless of any gate elsewhere, and the actual thing erroring against `prod.tfvars`'s single-entry map. Deleted the first three (confirmed dead code, unused anywhere), wrapped `backing_services_name` in `try()`. Added `create_nat_gateway`/`nodes_in_public_subnets` toggles to `modules/network`/`modules/eks` (default to the prior always-NAT/private-subnet behavior, so Floci is untouched) — set `false`/`true` in `prod.tfvars` for the no-NAT burst-session design. Created `secrets.aws.tfvars` (gitignored; jwt/postgres/rabbitmq/openai/google values copied forward from `oci/secrets.oci.tfvars`, everything else empty since it's Jenkins-only and Jenkins isn't installed via Terraform on real AWS). Also fixed two bugs discovered only by actually running a real plan against AWS for the first time: Terraform's AWS provider doesn't understand `aws login`'s `login_session` credential format (bridged via `aws configure export-credentials --format env`), and a security-group-rule description containing `->` (AWS disallows `>`; never caught before since that resource's `for_each` is empty on the Floci path).

**Verified**: `terraform plan -var-file=envs/prod.tfvars -var-file=secrets.aws.tfvars` (against a fresh `envs/state/prod.tfstate`, first-ever real-AWS plan for this project) now produces **82 to add, 0 to change, 0 to destroy, 0 errors** — one VPC, one EKS cluster + node group, 13 ECR repos, one ALB, zero NAT/EIP resources, `ap-south-1` region confirmed throughout. Floci/local path re-verified unaffected (all new variables default to prior behavior; `terraform plan` against `local.tfvars` proceeds past the same point as before, failing only on an unrelated pre-existing "Docker daemon not running" environmental issue).

### Phase 3 — First provision + teardown rehearsal ✅ Done

Apply against real AWS with real credentials, verify EKS cluster comes up, `kubectl get nodes` works, then **immediately `terraform destroy`** before doing anything else — proving the full cycle works cleanly before ever leaving it up long enough to explore. First concrete lesson: prove teardown works _before_ trusting yourself to use the environment.

**Standing rule from here on, every session, not just this one** (user's explicit instruction 2026-09-23, after the OCI incident where a leftover paid LB shape kept billing silently after a migration): after every `terraform destroy`, explicitly check AWS Cost Explorer / Billing (and a resource-level sanity pass — EC2, EBS volumes, EIPs, load balancers, NAT gateways) to confirm nothing is still accruing charges. `terraform destroy` exiting cleanly is necessary but not sufficient proof — verify against the account directly, same lesson as OCI.

**What actually happened (2026-09-23)**: this rehearsal surfaced 4 real, previously-undiscoverable issues on the very first real apply — full details in `.claude/CONTENT.md`. Summary: (1) exported `aws login` session credentials can expire mid-apply on a slow step (a LuLu-blocked `tls_certificate` read this time — same class of issue as `k6` earlier, a new binary never given a LuLu allow rule), requiring a `terraform untaint`/state-reconciliation dance; (2) this AWS account is on the "Free Plan", which hard-blocks non-free-tier EC2 instance types outright — `t3.medium` silently retried failed launches for 27 minutes before AWS gave up; switched to `m7i-flex.large` (free-tier-eligible, 2vCPU/8GB) and capped `node_max_size=2` to stay under the account's 5-vCPU default quota, staying on Free Plan per user's choice; (3) 11 more Floci-only `docker_image`/`docker_volume` resources turned out to be ungated too (same bug class as `backing_services`), fixed; (4) EKS self-corrected a harmless `k8s_version` drift during a cluster modify step.

**Verified end to end**: cluster + node group + ALB all reached `ACTIVE`, `kubectl get nodes` showed both nodes `Ready` with real public IPs (confirming the no-NAT/public-subnet design works), then `terraform destroy` removed all 71 resources cleanly. Post-destroy check confirmed directly against the AWS API (not just Terraform's exit code): 0 EKS clusters, EC2 instances `terminated`, 0 ALBs/NAT gateways/EIPs/VPCs/ECR repos/EBS volumes. Billing/Cost Explorer has a normal reporting lag (8-24h) so the exact dollar figure isn't confirmed yet — follow-up check scheduled, expected well under $1 for the ~1hr session. Commits `3803003`, `85bd13d` (platform-infrastructure).

### Phase 4 — Real session: deploy the (now-optimized) app

Provision, push images to the now-real ECR (new GitHub Actions workflow or manual `docker push` for the first pass), deploy the 13 services + backing services including PgBouncer (fresh Helm installs, same charts as OCI/OKE, carrying the Phase 0 fixes forward — no chart logic changes needed beyond what Phase 0 already built, just new `aws-prod` values), verify healthy, verify the ALB URL reachable.

### Phase 5 — Climb the target ladder, one rung at a time

Install HPA/KEDA (`loadtest/hpa/api-gateway.yaml`, `loadtest/keda/channel-service.yaml`). Then, for each rung in the target ladder (232 → 500 → 1000 → 2315 events/s):

1. Run `mainflow-open.js` (or a variant tuned to that target rate) against the AWS ALB URL.
2. Capture evidence for that rung: k6 summary JSON, Grafana/Prometheus screenshots (replica count, per-pod CPU/memory, latency percentiles during the run), current node count.
3. If the rung wasn't cleanly met (error rate, latency thresholds, or throughput itself falls short), scale up — HPA max replicas, manual replica counts, or `node_desired_size` — and re-run the same rung until it's met.
4. Log the rung's result in `.claude/CONTENT.md` (target, achieved throughput, replica/node count, evidence links) before moving to the next rung.

Because the two architectural bottlenecks are already fixed, each rung should need meaningfully less scaling than raw node-count-alone would have — that contrast (OCI baseline vs. each AWS rung) is the real deliverable, not just "2315/s was reached."

### Phase 6 — Final evidence capture, then destroy

Once all four rungs are climbed (or the session's time/budget runs out — document honestly which rungs were reached and what stood between the last one and 2315/s if it wasn't fully hit), pull together the full evidence set, then `terraform destroy` the same session, confirmed via the AWS Console/CLI that nothing's left running.

**Repeat Phases 4-6** across multiple sessions if the full ladder isn't climbed in one sitting — each session picks up from the last rung proven, informed by what the previous run showed.

## Verification criteria

- After Phase 0: Jaeger shows measurably lower per-hop gRPC latency; `pg_stat_activity` connection count stays bounded under load instead of scaling with replica count. ✅ Done.
- Phase 0.5: OCI baseline captured with real k6 + Prometheus evidence. ✅ Done.
- After Phase 2: `terraform validate`/`plan` against `prod.tfvars` + `secrets.aws.tfvars` shows only the intended single-cluster resource set — no second VPC/EKS cluster in the plan. ✅ Done.
- After Phase 3 (and every AWS session after, standing rule): a full provision→`kubectl get nodes`→destroy cycle completes with the AWS Console showing zero EKS clusters, zero EC2 instances, zero load balancers afterward, **and** AWS Cost Explorer/Billing checked directly (not just inferred from `terraform destroy` exiting cleanly) to confirm nothing is still accruing charges.
- After each Phase 5 rung: k6 summary shows the target rate cleanly met (errors within threshold, latency within threshold), with Grafana/Prometheus evidence of the replica/node count it took to get there — logged in `.claude/CONTENT.md` before moving to the next rung.
- After the full ladder: a documented, evidence-backed comparison across all rungs (replica/node count vs. throughput achieved) plus the OCI baseline, and if 2315/s isn't fully reached, an honest evidence-backed explanation of exactly what stood in the way.
- Every AWS session: a Budget alert never fires unexpectedly between sessions (would mean something wasn't torn down).

## Follow-ons (out of scope for this pass)

- A prod-equivalent of `scripts/tf.sh` (real AWS credential wrapper) — only worth building if this becomes a much more frequent workflow than "a few sessions this month."
- Remote Terraform state (S3+DynamoDB) — solo/ephemeral use doesn't need it yet.
- Any long-term/always-on AWS presence — explicitly not the goal here.

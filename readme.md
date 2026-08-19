# AI Notification Platform

An AI-powered, multi-tenant, event-driven notification platform: tenants define **rules** that watch incoming **events** and fire **notifications** (email / webhook / in-app) through reusable **templates**, with an **AI service** scoring every event for severity, business impact, and duplicates before it reaches a human.

Built as a full production-style system, not a toy demo — 11 NestJS microservices (gRPC internally, REST at the edge), a Python prediction service, a Next.js frontend, per-service Postgres databases, RabbitMQ as the event bus, a full OpenTelemetry/Prometheus/Loki/Jaeger/Grafana observability stack, and a Terraform + Kubernetes + ArgoCD + Jenkins GitOps pipeline that runs identically against a local AWS emulation or real AWS.

For the full problem definition, requirements, and architecture rationale, see **[docs/SRS.md](docs/SRS.md)** (Software Requirements Specification).

## Getting started

### Prerequisites

- Node.js ≥ 24, [pnpm](https://pnpm.io) 10.16.0 (via `corepack enable`)
- Docker Desktop
- For the full CI/CD path below: [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.5, AWS CLI

```bash
git clone https://github.com/dip7501686040/ai-notification-system.git
cd ai-notification-system
pnpm install
cp .env.example .env   # fill in whatever API keys/SMTP creds you have
```

Every credential in `.env` degrades gracefully if left blank — a missing AI provider key just means analysis attempts record `status: failed` instead of crashing the service; missing SMTP does the same for email.

### Option A — Local app development (fastest)

```bash
pnpm dev
```

`pnpm dev` (`scripts/dev.sh`) brings up the Docker-hosted infra (Postgres, RabbitMQ, Redis, the full observability stack, Stripe CLI), runs pending Prisma migrations, then starts all 13 app services natively — staggered 2 at a time so code hot-reloads without a container rebuild, and so this doesn't try to launch 13 concurrent Nest+webpack+OTel processes at once.

Already have infra running from a previous `pnpm dev`? Skip straight to the app services:

```bash
pnpm dev:light   # scripts/dev-light.sh — same staggered service startup, skips infra + migrations
```

Once it's up:

| | |
|---|---|
| App | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| Grafana | http://localhost:3011 |
| Jaeger | http://localhost:16686 |
| pgAdmin | http://localhost:5050 |

### Seed demo data

```bash
bash scripts/seed-demo-data.sh
```

Seeds two tenants (to demonstrate multi-tenancy + RBAC), users, templates, rules, events, and a realistic success/failure/retry mix of notifications, plus an AI analysis pass. Not idempotent — intended for a fresh stack. Walk through **[docs/demo-walkthrough.md](docs/demo-walkthrough.md)** alongside it for the full guided tour: the core event→rule→notification loop, tenant isolation and RBAC enforcement, AI analysis, and the embedded observability views.

### Option B — Full local CI/CD (EC2 + ECR + EKS + Jenkins + ArgoCD, no AWS account)

This runs the complete GitOps pipeline end-to-end on your machine via Floci, a local Docker-based AWS emulator — the same Terraform provisions this identically against real AWS later.

```bash
# 1. Clone the deploy repo alongside this one
git clone https://github.com/dip7501686040/platform-gitops.git ../platform-gitops

# 2. Point aws/terraform at Floci's emulated endpoint (local/aws-config,
#    local/aws-credentials in platform-gitops are committed as-is — Floci's
#    values are fixed dummy credentials, the same for everyone, not a real
#    secret, so there's nothing to fill in)
cd ../platform-gitops
source local/floci-env.sh

# 3. Provision: VPC, ECR repos, an EKS (k3s) cluster, and a fully-seeded
#    Jenkins EC2 instance — Terraform starts Floci itself if it isn't
#    already running
cd terraform
terraform init -backend-config=envs/local.backend.hcl
terraform apply -var-file=envs/local.tfvars -var-file=secrets.local.tfvars
```

What you get:

- **Jenkins** at http://localhost:8091 (a Terraform-managed SSH tunnel — no manual port-forwarding needed on future applies). Log in as `admin` with the password at `platform-gitops/terraform/envs/state/jenkins-admin-password.txt`.
- **`build-<service>`** jobs — one per service, plus a generic `build-service` job — build the image, push to the emulated ECR, and bump that service's tag in `platform-gitops`.
- **`watch-source-and-build`** — polls this repo's `main` (Jenkins' built-in SCM trigger; click "Build Now" once after first seeding to register its schedule). On a real change it runs `turbo run build --filter='...[<last-commit>]'` to find every package actually affected — dependency-graph aware, so a shared `packages/*` change correctly triggers every service that depends on it — and builds them one at a time, never in parallel, never for anything unaffected.
- **ArgoCD**, deployed to the emulated EKS cluster, watching `platform-gitops` and auto-syncing every tag bump — the deployed services in the cluster stay in sync with what Jenkins just built. `kubectl` access is via the cluster's own kubeconfig (see `terraform output kubeconfig_command` in `platform-gitops/terraform`) — Floci's `aws eks update-kubeconfig` emulation has known gaps, so pulling kubeconfig directly from the `floci-eks-<cluster-name>` container is the fallback if that command doesn't cooperate.

#### Coming back after a system reboot or Docker restart

Floci and everything it created are just Docker containers, so they don't survive a reboot on their own — only `floci` itself auto-restarts (it's the one container Terraform directly manages, with a `restart: unless-stopped` policy). Bring the rest back up in this order:

```bash
# 1. Start Docker Desktop, and wait for the daemon to actually be up
open -a Docker
until docker info >/dev/null 2>&1; do sleep 2; done

# 2. Start Floci's own child containers (ECR, EKS/k3s, the Jenkins EC2
#    emulation) -- these don't have a restart policy, since Floci creates
#    them internally, not Terraform, so they need to be started explicitly.
#    Container names are stable unless that resource was replaced -- list
#    them first if unsure:
docker ps -a --format '{{.Names}}' | grep floci
docker start floci-ecr-registry floci-eks-ai-notification-floci floci-ec2-i-<instance-id>
```

Optional one-time fix so step 2 stops being manual on every future reboot — this only needs running once, and only survives until any of these three containers gets recreated (e.g. after a `terraform apply -replace` on the Jenkins instance):

```bash
docker update --restart=unless-stopped floci-ecr-registry floci-eks-ai-notification-floci floci-ec2-i-<instance-id>
```

```bash
# 3. Re-establish the Jenkins SSH tunnel. It's Terraform-managed state
#    (terraform_data.jenkins_ssh_tunnel), not a container -- the reboot
#    killed the actual `ssh -L 8091:...` process running on your Mac, so
#    it needs a real apply, not just a container start. Only run this once
#    the EC2 container from step 2 is confirmed reachable.
#
#    it's a fresh terminal since the reboot, so the AWS_PROFILE/endpoint env
#    vars aren't set anymore either -- skipping this is what "No valid
#    credential sources found" from the aws provider means.
cd ../platform-gitops
source local/floci-env.sh
cd terraform
terraform apply -var-file=envs/local.tfvars -var-file=secrets.local.tfvars
```

Jenkins should be back at http://localhost:8091 once that completes.

## Architecture at a glance

The core pipeline is asynchronous, RabbitMQ-driven event choreography — each service publishes a routing-keyed event on completion and reacts only to the events it cares about, with no service calling the next one directly. Auth, multi-tenancy, and template rendering are the exception: those are synchronous gRPC calls, made where a request genuinely needs an answer before it can proceed.

```
Client / API key
      │ REST
      ▼
 api-gateway ──gRPC──► identity-service   (JWT / API-key auth)
      │       ──gRPC──► tenant-service     (multi-tenancy, membership, API keys)
      │  gRPC: createEvent
      ▼
 event-service ──publish──► event.created
                                  │
                                  ▼
                        rule-engine-service (evaluate rules)
                                  │ publish
                                  ▼
                         event.rule.matched
                                  │
                                  ▼
                             ai-service (LLM: severity / impact / duplicate)
                                  │ publish
                                  ▼
                         event.ai.completed
                                  │
                                  ▼
                       notification-service ──gRPC──► template-service (render)
                                  │            ──gRPC──► tenant-service (membership)
                                  │ publish
                                  ▼
                        notification.created
                                  │
                                  ▼
                          channel-service (email / webhook / dashboard delivery)
                                  │ publish
                                  ▼
                          notification.sent

 Parallel async taps (data collection, not in the critical path):
   event.created, event.ai.completed, notification.sent ──► audit-service     (who did what, when)
   event.created, notification.sent                      ──► analytics-service (aggregates)

 Every service ──► OpenTelemetry ──► Prometheus / Loki / Jaeger ──► Grafana ──► tenant "Observability" tab
```

**Services** (`apps/`): `identity-service`, `tenant-service`, `event-service`, `rule-engine-service`, `notification-service`, `channel-service`, `ai-service`, `analytics-service`, `audit-service`, `api-gateway`, `template-service`, `web` (Next.js), `prediction-service` (Python).

**Shared libraries** (`packages/`): `common`, `config`, `grpc`, `logger`, `rabbitmq`, `telemetry`, `typescript-config` — a pnpm + Turborepo monorepo.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | NestJS, gRPC, Prisma, PostgreSQL, RabbitMQ |
| Frontend | Next.js |
| AI | OpenAI / Anthropic-backed event analysis |
| Observability | OpenTelemetry, Prometheus, Loki, Jaeger, Grafana, cAdvisor |
| Monorepo tooling | pnpm workspaces, Turborepo (dependency-graph-aware builds) |
| Infra / CI-CD | Terraform, Kubernetes + Helm, ArgoCD (GitOps), Jenkins, Docker |
| Local AWS emulation | [Floci](https://github.com/floci/floci) — EC2/ECR/EKS as real Docker containers, no AWS account needed |

## Repository structure

```
apps/            13 services (see above)
packages/        shared libraries
docker/          Dockerfiles used by the CI build pipeline
infra/           local dev support only — Grafana/Prometheus/OTel/Postgres
                 config. No Terraform/Kubernetes/Jenkins here — see
                 "Related repo" below.
docs/            SRS.md, demo-walkthrough.md
scripts/         dev.sh, dev-light.sh, seed-demo-data.sh
Jenkinsfile      thin CI trigger: turbo --filter decides which service(s)
                 changed, dispatches builds one at a time (see below)
```

## Related repo: platform-gitops

Deployment infra — Terraform, Kubernetes manifests, ArgoCD Application definitions, and the actual build/push/deploy Jenkins pipeline — lives in a separate repo, kept apart so deploy concerns don't mix into the application codebase:

**https://github.com/dip7501686040/platform-gitops**

## Documentation

- **[docs/SRS.md](docs/SRS.md)** — full Software Requirements Specification: problem definition, requirements, architecture rationale
- **[docs/demo-walkthrough.md](docs/demo-walkthrough.md)** — guided product demo script

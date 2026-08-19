# Project context: ai-notification-system + platform-gitops

Two-repo setup. This repo (`ai-notification-system`) is application code only.
All deploy/infra lives in the sibling repo **platform-gitops**
(https://github.com/dip7501686040/platform-gitops.git, local clone: `~/platform-gitops`).
Both repos are public. The split is for separation of concerns (multi-project
infra repo, app repo free of deploy noise) — not access-hiding.

## This repo's structure

- `apps/<service>/` — 13 services, each `@ai-notification/<service>` in the pnpm
  workspace: ai-service, analytics-service, api-gateway, audit-service,
  channel-service, event-service, identity-service, notification-service,
  prediction-service, rule-engine-service, template-service, tenant-service, web
- `packages/` — shared libs (common, config, grpc, logger, rabbitmq, telemetry,
  typescript-config) — turbo tracks these as build deps of the apps above
- `docker/` — Dockerfiles, used by platform-gitops's build Jenkinsfile
- `infra/` — **local dev only** now: Grafana/Prometheus/OTel/Postgres config.
  No Terraform/k8s/Jenkins here anymore — see `infra/README.md`
- `Jenkinsfile` — this repo's only Jenkins file: a thin CI trigger (see below)
- `turbo.json`, `pnpm-workspace.yaml` — pnpm + Turborepo monorepo tooling

## platform-gitops structure (`~/platform-gitops`)

- `terraform/` — Terraform for Floci (local) and real AWS (prod)
  - `envs/{local,prod}.tfvars`, `{local,prod}.backend.hcl`
  - `modules/{network,ecr,eks,addons,jenkins-ec2,floci}`
  - `modules/floci/` — starts/pulls the `floci/floci` container itself
    (`var.manage_floci`), local env only
- `k8s/`
  - `charts/` — Helm charts (nest-service, web, prediction-service, backing-services)
  - `environments/{local,prod}/` — per-service `values-<service>.yaml` (image repo+tag)
  - `argocd/` — Application/ApplicationSet manifests; `repoURL` points at platform-gitops itself
- `jenkins/`
  - `Jenkinsfile` — the real build pipeline (`build-<service>`/`build-service`
    jobs): docker build/push, bumps `k8s/environments/<env>/values-<service>.yaml`,
    commits+pushes here
  - `env/{local,prod}.properties` — AWS_REGION/ECR_REGISTRY/K8S_ENV per env

## CI/CD flow (how the two repos connect)

1. Push to `ai-notification-system` `main`.
2. Jenkins job `watch-source-and-build` — primary SCM is `ai-notification-system`
   itself (Jenkinsfile at repo root), triggered by Jenkins' built-in `pollSCM`
   (~2 min interval; no public webhook yet — Floci has no internet-reachable
   endpoint). It runs `turbo run build --filter='...[$GIT_PREVIOUS_SUCCESSFUL_COMMIT]' --dry=json`
   in a `node:24` container to get the actual affected packages —
   dependency-graph aware, so a shared `packages/*` change correctly flags every
   service that depends on it, not just literal `apps/<service>/` path matches.
3. For each affected service, triggers `build-<service>` (defined in
   `platform-gitops/jenkins/Jenkinsfile`) **sequentially** (`wait: true`, never
   `parallel`, never for unaffected services).
4. `build-<service>` checks out `ai-notification-system` into `src/`,
   builds+pushes the Docker image, bumps the values file in platform-gitops,
   commits+pushes to platform-gitops `main`.
5. ArgoCD (watching platform-gitops) auto-syncs the new tag to the cluster.

All Jenkins jobs are seeded by
`platform-gitops/terraform/modules/jenkins-ec2/templates/seed-jobs.groovy.tftpl`,
baked into the EC2 instance's `user_data` at _create_ time. Job-definition
changes need either an instance replace
(`terraform apply -replace=module.jenkins_ec2[0].aws_instance.jenkins`) or a
live re-seed via Jenkins' `/scriptText` script console (faster — render the
`.tftpl` with real values, POST it with a session cookie + crumb header; used
throughout this session instead of replacing the instance every time).

## Local dev environment (Floci)

- Floci = local Docker-based AWS emulator (`floci/floci:latest`, LocalStack-like),
  API at `localhost:4566`. Managed by Terraform itself (`terraform/modules/floci`).
- EC2 "instances" are literally Docker containers (`floci-ec2-i-<id>`) on the
  same daemon — only SSH gets host-published, on a Floci-assigned port, **not**
  literally 22 (`docker port floci-ec2-<id> 22` to find it).
- SSH user on Floci instances is **root**, not `ec2-user` — no cloud-init means
  the real AMI's `ec2-user` account never gets created. Real AWS still uses `ec2-user`.
- Known Floci refresh drift needing `lifecycle.ignore_changes` on
  `aws_instance.jenkins`: `associate_public_ip_address`, `subnet_id`,
  `vpc_security_group_ids` — Floci doesn't track these faithfully; without
  ignoring them, every `plan` wants to replace the instance.
- Jenkins UI: `http://localhost:8091` via a Terraform-managed SSH tunnel
  (`terraform_data.jenkins_ssh_tunnel` in `platform-gitops/terraform/main.tf`,
  re-established on every apply). Admin password at
  `platform-gitops/terraform/envs/state/jenkins-admin-password.txt` (gitignored).
- `source platform-gitops/local/floci-env.sh` before running aws/terraform
  commands locally — `local/aws-config`/`local/aws-credentials` are committed
  as-is (Floci's fixed dummy credentials, not a real secret).

## Environments

- **local** = Floci, disposable. `cluster_name` intentionally stays
  `ai-notification-floci` (not renamed to match `local`) for state continuity —
  EKS cluster names are immutable, renaming would force destroy/recreate.
- **prod** = real AWS, not yet applied (`envs/state/` has no `prod.tfstate`).

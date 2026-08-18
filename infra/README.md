# infra/

Local dev support only: Grafana/Prometheus/OTel config, the Postgres init
script, and machine-local dev env files.

Terraform, Kubernetes manifests/Helm charts, ArgoCD app definitions, and the
Jenkins pipeline live in the separate `platform-gitops` repo — kept apart so
deploy/infra concerns don't mix into the application codebase, following the
common industry pattern of a dedicated GitOps repo per set of projects.

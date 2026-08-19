# infra/

Local dev support only: Grafana/Prometheus/OTel config and the Postgres init
script.

Terraform, Kubernetes manifests/Helm charts, ArgoCD app definitions, the
Jenkins pipeline, and the Floci local-dev env pointer (`local/floci-env.sh`)
live in the separate `platform-gitops` repo — kept apart so deploy/infra
concerns don't mix into the application codebase, following the common
industry pattern of a dedicated GitOps repo per set of projects.

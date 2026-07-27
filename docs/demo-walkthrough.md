https://claude.ai/code/artifact/a9b394b8-9b0d-4c82-a708-f16473ac1d36?via=auto_preview

# AI Notification Platform — Demo Walkthrough

This is the source-of-truth script for demoing the platform end-to-end. It maps every major feature to a concrete, already-seeded example in the running dev environment, so a click-through matches exactly what's described here.

## 1. What this platform is

A multi-tenant SaaS notification platform: tenants define **rules** that watch incoming **events** and fire **notifications** (email/webhook/dashboard) through reusable **templates**, with an **AI service** analyzing every event for severity/impact/duplicates, an **analytics** layer aggregating outcomes, an **audit log** of every privileged action, per-tenant **API keys** for programmatic ingest, and a full **observability stack** (metrics/logs/traces) surfaced directly in the tenant dashboard.

```
Event ingested (UI, or API key) ──► rule-engine-service ──► matched? ──► notification-service ──► channel-service (email/webhook/dashboard)
                     │                                                          │
                     ├──► ai-service (LLM analysis: summary/severity/impact/duplicate)
                     ├──► analytics-service (daily aggregates)
                     └──► audit-service (who did what, when)

Every service ──► OpenTelemetry ──► Prometheus / Loki / Jaeger ──► Grafana ──► tenant "Observability" tab
```

Eleven backend microservices (NestJS + gRPC internally, REST at the edge via `api-gateway`), one Next.js web app, Postgres per service, RabbitMQ as the event bus.

## 2. How to access it

- **App**: http://localhost:3000
- **Grafana** (direct, for reference — the app embeds this): http://localhost:3011
- **Jaeger** (direct): http://localhost:16686

### Demo accounts

| Account                           | Password       | Role                                                                                      | Notes                                                                                                          |
| --------------------------------- | -------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `obs-test-1785068338@example.com` | `Password123!` | **Owner** of _Observability Test Co_; **Member** of _Globex Freight Co_; also Super Admin | Primary demo account — log in as this one                                                                      |
| `jordan.owner@example.com`        | `Password123!` | **Owner** of _Globex Freight Co_                                                          | Use to show the owner-side view of the second tenant, and to contrast against the member-restricted view above |

These are throwaway local dev accounts with fabricated data — not real customer data.

## 3. Multi-tenancy & RBAC

Log in as `obs-test-...`. The tenant switcher (top of the sidebar) shows both tenants this account belongs to:

1. **Observability Test Co** — you're the **owner** here. Full access: create/edit rules, templates, view audit logs, manage API keys and billing.
2. **Globex Freight Co** — you're a **member** here (owned by Jordan). Switch to it and note:
   - You can view its events/rules/templates (`Shipment Delay Alert`, `Shipment Delay Webhook`) but the create/edit UI is unavailable — server-side enforced, not just hidden (`POST /rules` as a member returns `403 Insufficient tenant role`).
   - **Audit Logs** is inaccessible — owner/admin only.
   - Switch back to Observability Test Co and confirm none of Globex's shipment events appear — tenants are fully data-isolated, verified independently at the API level (each tenant's event list returns only its own rows, membership-checked server-side on every read).

This demonstrates both isolation (no data leakage between tenants) and RBAC (permissions differ by role within a tenant a user belongs to).

## 4. Feature tour (Observability Test Co)

### Events → Rules → Notifications (the core loop)

Three rules are live:

- **Server Down Alert** — `eventType=server.down`, condition `severity == critical` — fires two webhook actions (one to `httpbin.org` which succeeds, one to a deliberately unroutable address to demonstrate retry/failure handling).
- **Payment Failed Alert** — `eventType=payment.failed` — fires a webhook.
- **Catch-all Dashboard Feed** — `eventType=*` — every event lands as an in-app dashboard notification.

Seeded events include a critical `server.down`, a non-critical (warning) `server.down` that deliberately _doesn't_ match the critical-only rule (shows condition evaluation working, not just event-type matching), a `payment.failed`, a `user.signup`, and a `deployment.completed`.

Check **Notifications**: you should see a realistic mix —

- `dashboard`: 11 sent
- `email`: 1 sent (see the note in §7 about this)
- `webhook`: 5 sent, 3 `dead_letter` (the unroutable target — retried on a backoff schedule, then given up; shows the retry mechanism honestly reaching its terminal failure state rather than hanging forever)

**Analytics** tab aggregates all of this into daily counts, top event sources, and per-channel success rate (currently ~83%) — computed by `analytics-service`'s own RabbitMQ consumers, not queried live from the other services.

### API Keys (FR-10)

One key exists ("CI/CD Ingest Key", rate limit 100/window). To demonstrate the programmatic-ingest path live: generate a fresh key in **API Keys** (the raw value is shown once), then:

```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" -H "X-API-Key: <the raw key>" \
  -d '{"tenantId":"ignored-for-api-key-auth","type":"deployment.completed","source":"github-actions","payload":{"message":"CI pipeline finished"}}'
```

The `tenantId` field is required by the request schema but is **ignored and overridden server-side** with the key's own bound tenant — a key scoped to one tenant cannot be used to write into another, even by editing the request body.

### Audit Log

Every privileged action is captured automatically: `rule.created`, `notification.sent`, `ai.decision.generated`, etc. — 24 entries currently. This is written by `audit-service`'s own consumer, not by the calling code remembering to log — so it can't be silently skipped by a code change elsewhere.

## 5. AI Service — all tasks

Configured to use a **local Ollama model** (`qwen2.5:0.5b`) for this tenant — no external API key, no per-token cost, runs entirely on this machine. (The platform also supports OpenAI and Anthropic per-tenant — `PUT /ai-config` swaps the provider without touching any other config.)

Every event, whether or not a rule matches it, is independently analyzed by `ai-service` (it's a second, parallel consumer of the same `event.created` stream rule-engine listens to). Open the **AI** tab and pick any analyzed event to see the real model output:

- `summary` — plain-language description of what happened
- `category`, `severity`, `businessImpact` — the model's own classification
- `recommendation` — a suggested next action
- `isDuplicate` / `duplicateOfEventId` — retrieval-augmented duplicate detection: the service embeds the new event, retrieves the tenant's most similar recent events (cosine similarity ≥ 0.65), and asks the model to judge whether it's a repeat

**Honest caveat, worth stating to the client directly**: `qwen2.5:0.5b` is a 0.5-billion-parameter model chosen for demo speed and zero cost, not accuracy — in testing, it correctly summarized/classified every event but did _not_ reliably flag near-duplicate events as duplicates (tested twice with near-identical incident text, both times classified as new). This is a model-capability limit, not a platform bug — switching the tenant to `gpt-4o-mini` or `claude-3-5-haiku` (one config change, `PUT /ai-config`) is the expected fix for production duplicate-detection accuracy. It's a good moment to point at the per-tenant provider flexibility as the actual feature.

## 6. Observability — request tracking, errors, logs, traces, resource usage

Tenant dashboard → **Observability**. This is built on the same OpenTelemetry → Prometheus/Loki/Jaeger → Grafana pipeline the platform runs on itself, scoped per-tenant:

- **Metrics & Errors** — live Grafana panel: request rate and error rate by route, filtered to `tenant_id = <this tenant>`. The 3 `dead_letter` webhook retries from §4 show up here as real error-rate data, not synthetic.
- **Logs** — same dashboard, Loki panel, filtered by parsing `tenantId` out of each service's structured log line.
- **Traces** — Jaeger's own UI, pre-filtered to this tenant's `tenant.id` span tag — click into any trace to see the full request waterfall across api-gateway → downstream services.
- **System Health** — CPU/memory per container (cAdvisor-backed). This one is platform-wide by nature (containers are shared across all tenants, not one-per-tenant), which is called out directly in the panel.

**Super Admin** (this account has that flag) → **Platform Health** shows the same resource data unfiltered, plus request/error rate broken out **by tenant** side-by-side — the view an operator would use, vs. the tenant-scoped view above.

All of this is backed by a `TenantMetricsInterceptor` on the gateway (tags every request's trace span and records Prometheus counters with `tenant_id`) plus per-service log enrichment — not a separate observability pipeline bolted on after the fact.

## 7. Known limitations (say these proactively, don't wait to be asked)

- **Email actually sends** — SMTP is configured with a real relay in this dev environment. The one `email`-channel notification in this dataset was a genuine send (to a placeholder `@example.com` address, so nothing was actually delivered anywhere). Avoid triggering more of these live during a demo unless you intend to send real mail.
- **AI duplicate detection accuracy** — see §5. Real with the local model, but not reliable at that specific judgment with a 0.5B model.
- **Grafana embedding** required one infra setting most people miss: Grafana blocks iframe embedding by default (`X-Frame-Options: deny`) — this stack has `GF_SECURITY_ALLOW_EMBEDDING=true` set specifically so the tenant-scoped dashboards can be embedded. If you ever see "refused to connect" _only inside an iframe_ while the same URL works in a new tab, this is the setting to check first.
- **Resource usage is platform-wide, not tenant-attributable** — containers aren't partitioned per tenant, so "System Health" necessarily shows everyone's load, not just one tenant's.

## 8. Reproducing this from scratch

`scripts/seed-demo-data.sh` (repo root) creates two fresh tenants and runs through the same sequence described above end-to-end — registers two owner accounts, creates both tenants, invites one owner into the other as a member, seeds templates/rules/events/an API key, and points Tenant 1's AI config at Ollama. Requires the full stack up (`docker compose up -d`) and the `qwen2.5:0.5b`/`nomic-embed-text` Ollama models pulled (the `ollama-pull` init container in `docker-compose.yml` does this automatically on first stack startup).

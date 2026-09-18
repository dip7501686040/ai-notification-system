import { apiFetch } from "./api-client";
import type { Paginated, Rule, Template } from "./types";

// The public, read/write demo tenant ("Acme Retail"). Not a secret -- the
// login page's "Try demo" button shows the matching password directly.
export const DEMO_EMAIL = "proof-demo@dipankarsaha.dev";

export function isDemoUser(email: string | null | undefined): boolean {
  return email === DEMO_EMAIL;
}

const TEMPLATES = [
  {
    name: "Critical Incident Webhook",
    channel: "webhook",
    body: '{"eventType":"{{eventType}}","source":"{{source}}","severity":"{{severity}}","message":"{{message}}"}',
  },
  {
    name: "Critical Incident Email",
    channel: "email",
    subject: "[{{severity}}] {{eventType}} incident",
    body: "Source: {{source}}\nMessage: {{message}}",
  },
];

const RULES = [
  {
    name: "Server Down Alert",
    eventType: "server.down",
    conditions: { op: "equals", field: "severity", value: "critical" },
    actions: [
      { channel: "webhook", target: "https://httpbin.org/post", template: "Critical Incident Webhook" },
      { channel: "webhook", target: "http://10.255.255.1/unreachable", template: "Critical Incident Webhook" },
    ],
  },
  {
    name: "Payment Failed Alert",
    eventType: "payment.failed",
    conditions: {},
    actions: [{ channel: "webhook", target: "https://httpbin.org/post", template: "Critical Incident Webhook" }],
  },
  {
    name: "Catch-all Dashboard Feed",
    eventType: "*",
    conditions: {},
    actions: [{ channel: "dashboard", target: DEMO_EMAIL }],
  },
];

const EVENTS = [
  { type: "server.down", source: "prod-db-01", payload: { severity: "critical", message: "Primary database connection pool exhausted" } },
  { type: "server.down", source: "prod-web-03", payload: { severity: "warning", message: "High memory usage detected" } },
  { type: "payment.failed", source: "stripe-webhook", payload: { severity: "critical", message: "Card declined: insufficient funds" } },
  { type: "user.signup", source: "web-app", payload: { severity: "info", message: "New user registered" } },
  { type: "deployment.completed", source: "ci-cd", payload: { severity: "info", message: "v2.4.1 deployed to production" } },
];

/** Deletes and recreates the demo tenant's rules/templates/API key, then
 *  sends a fresh batch of demo events. Config-only reset: there's no
 *  delete endpoint for events/notifications (each service owns its own
 *  database with no cascade between them), so history just accumulates
 *  across resets -- negligible at demo-button traffic scale. */
export async function resetDemoData(tenantId: string): Promise<void> {
  const [rules, templates, apiKeys] = await Promise.all([
    apiFetch<Paginated<Rule>>("/rules", { query: { tenantId, limit: "100" } }),
    apiFetch<Paginated<Template>>("/templates", { query: { tenantId, limit: "100" } }),
    apiFetch<Paginated<{ id: string }>>("/apikeys", { query: { tenantId, limit: "100" } }),
  ]);

  await Promise.all(rules.list.map((r) => apiFetch(`/rules/${r.id}`, { method: "DELETE" })));
  await Promise.all(templates.list.map((t) => apiFetch(`/templates/${t.id}`, { method: "DELETE" })));
  await Promise.all(apiKeys.list.map((k) => apiFetch(`/apikeys/${k.id}`, { method: "DELETE" })));

  for (const t of TEMPLATES) {
    await apiFetch("/templates", { method: "POST", body: { tenantId, ...t } });
  }
  for (const r of RULES) {
    await apiFetch("/rules", { method: "POST", body: { tenantId, ...r } });
  }
  await apiFetch("/apikeys", { method: "POST", body: { tenantId, name: "CI/CD Ingest Key", rateLimit: 100 } });
  for (const e of EVENTS) {
    await apiFetch("/events", { method: "POST", body: { tenantId, ...e } });
  }
}

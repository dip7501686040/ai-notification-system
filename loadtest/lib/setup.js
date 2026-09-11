// Shared k6 setup() body for the Phase F load tests.
//
// Provisions a fresh tenant + an enabled rule so `POST /events` actually
// returns 201 (it returns 400 unless an enabled rule matches the event
// `type`). Any failure here is FATAL -- a half-provisioned setup makes the
// whole run measure nothing but the 400 reject path.
//
// The rule action is `{ channel: "dashboard", target: <userId> }`:
//   - it still flows through channel-service's queue
//     (`channel-service.notification.created`), so the async / KEDA demo
//     has real queue work to scale on;
//   - "dashboard" is the fire-and-forget fast path (channel-service just
//     re-publishes `notification.dashboard.push`) -- no external SMTP/HTTP
//     sink to stand up. Override with RULE_CHANNEL / RULE_TARGET env vars
//     to exercise the real webhook/email connectors instead.

import http from "k6/http";
import { fail } from "k6";

export function provisionTenant({ api, withOpenAI = false } = {}) {
  const stamp = Date.now();
  const j = { headers: { "Content-Type": "application/json" }, responseType: "text" };

  // 1. register (no email verification; returns a signed JWT immediately)
  let r = http.post(
    `${api}/auth/register`,
    JSON.stringify({
      email: `loadtest-${stamp}@example.com`,
      password: "LoadTest123!",
      name: "Load Test",
    }),
    j,
  );
  if (r.status < 200 || r.status >= 300) fail(`setup: register failed ${r.status} ${r.body}`);
  const token = r.json("accessToken");
  const userId = r.json("user.id");
  const auth = {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    responseType: "text",
  };

  // 2. tenant -- the creator is auto-inserted as an `owner` member, which
  //    is why the `owner`-gated POST /rules below succeeds.
  r = http.post(
    `${api}/tenants`,
    JSON.stringify({ name: "Load Test Tenant", slug: `loadtest-${stamp}` }),
    auth,
  );
  if (r.status < 200 || r.status >= 300) fail(`setup: create tenant failed ${r.status} ${r.body}`);
  const tenantId = r.json("id");

  // 3. secondary/async demo only: point this tenant's AI at OpenAI so
  //    ai-service doesn't dead-end on a missing Ollama.
  if (withOpenAI) {
    r = http.put(
      `${api}/ai-config`,
      JSON.stringify({
        tenantId,
        provider: "openai",
        model: __ENV.OPENAI_MODEL || "gpt-4o-mini",
      }),
      auth,
    );
    if (r.status < 200 || r.status >= 300) fail(`setup: ai-config failed ${r.status} ${r.body}`);
  }

  // 4. MANDATORY enabled rule.
  const action = {
    channel: __ENV.RULE_CHANNEL || "dashboard",
    target: __ENV.RULE_TARGET || userId,
  };
  r = http.post(
    `${api}/rules`,
    JSON.stringify({
      tenantId,
      name: "load-test-rule",
      eventType: "load-test.ping",
      actions: [action],
      enabled: true,
    }),
    auth,
  );
  if (r.status < 200 || r.status >= 300) fail(`setup: create rule failed ${r.status} ${r.body}`);

  return { token, tenantId, userId };
}

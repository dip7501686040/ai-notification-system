// Phase E baseline load test -- 1 replica everywhere, no HPA/KEDA yet.
// This run's data is what Phase F reads to decide which services actually
// need autoscaling (CPU-pinned -> HPA candidate, queue backs up -> KEDA
// candidate) -- see platform-infrastructure's load-test plan doc.
//
// Run: k6 run loadtest/baseline.js
// JSON summary: k6 run --summary-export=loadtest/baseline-summary.json loadtest/baseline.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_WEB = "http://localhost:8080";
const BASE_API = "http://localhost:8000";

const eventErrors = new Counter("event_errors");
const eventDuration = new Trend("event_duration");

export const options = {
  scenarios: {
    // Stage 1+2 of the plan: ramp until it hurts, then hold at the ceiling.
    baseline: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "5m", target: 100 }, // plateau -- watch CPU/queue depth here
        { duration: "30s", target: 0 },
      ],
      exec: "baselineMix",
    },
    // Stage 3: controlled spike, POST /events only -- which queue backs up
    // hardest under a sudden jump, not steady load.
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      startTime: "8m45s", // after baseline's own stages finish
      stages: [
        { duration: "10s", target: 200 },
        { duration: "30s", target: 200 },
        { duration: "10s", target: 0 },
      ],
      exec: "spikeEvents",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.05"],
  },
};

export function setup() {
  const email = `loadtest-${Date.now()}@example.com`;
  const password = "LoadTest123!";

  let res = http.post(
    `${BASE_API}/auth/register`,
    JSON.stringify({ email, password, name: "Load Test User" }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`setup: register failed ${res.status} ${res.body}`);
  }
  const { accessToken } = res.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const slug = `loadtest-${Date.now()}`;
  res = http.post(`${BASE_API}/tenants`, JSON.stringify({ name: "Load Test Tenant", slug }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`setup: create tenant failed ${res.status} ${res.body}`);
  }
  const tenantId = res.json().id;

  // A matching rule so event.created actually cascades downstream
  // (rule-engine -> ai-service -> notification-service -> analytics/audit)
  // instead of dead-ending at rule-engine-service with zero matches --
  // without this, the load test would only ever exercise the first hop.
  // `actions` content is opaque JSON as far as rule-engine-service is
  // concerned (it just forwards it); if ai-service doesn't recognize this
  // exact shape, the earlier hops (api-gateway, event-service,
  // rule-engine-service) are still fully exercised and their data is
  // still valid -- only the very last hops would be affected.
  res = http.post(
    `${BASE_API}/rules`,
    JSON.stringify({
      tenantId,
      name: "load-test-rule",
      eventType: "load-test.ping",
      actions: [{ type: "notification", channel: "in-app", message: "Load test event" }],
      enabled: true,
    }),
    { headers: { ...headers, "Content-Type": "application/json" } },
  );
  if (res.status < 200 || res.status >= 300) {
    console.warn(
      `setup: rule creation failed ${res.status} ${res.body} -- continuing anyway, only the first pipeline hop will be exercised`,
    );
  }

  return { accessToken, tenantId };
}

export function baselineMix(data) {
  const headers = { Authorization: `Bearer ${data.accessToken}` };

  check(http.get(`${BASE_WEB}/login`), { "web ok": (r) => r.status === 200 });

  check(http.get(`${BASE_API}/health`), { "health ok": (r) => r.status === 200 });
  check(http.get(`${BASE_API}/events?tenantId=${data.tenantId}`, { headers }), {
    "events list ok": (r) => r.status === 200,
  });

  const res = http.post(
    `${BASE_API}/events`,
    JSON.stringify({
      tenantId: data.tenantId,
      type: "load-test.ping",
      payload: { ts: Date.now() },
    }),
    { headers: { ...headers, "Content-Type": "application/json" } },
  );
  eventDuration.add(res.timings.duration);
  if (res.status < 200 || res.status >= 300) eventErrors.add(1);
  check(res, { "event create ok": (r) => r.status >= 200 && r.status < 300 });

  sleep(1);
}

export function spikeEvents(data) {
  const headers = {
    Authorization: `Bearer ${data.accessToken}`,
    "Content-Type": "application/json",
  };
  const res = http.post(
    `${BASE_API}/events`,
    JSON.stringify({
      tenantId: data.tenantId,
      type: "load-test.ping",
      payload: { ts: Date.now(), spike: true },
    }),
    { headers },
  );
  eventDuration.add(res.timings.duration);
  if (res.status < 200 || res.status >= 300) eventErrors.add(1);
}

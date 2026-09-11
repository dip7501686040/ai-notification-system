// Phase F -- closed-model comparison: realistic concurrent users.
//
// Refactor of the original baseline.js: `ramping-vus` (closed model --
// each VU waits for its response before the next request, so throughput
// self-limits under load). Use this to see latency-under-contention and a
// realistic per-user experience; use mainflow-open.js to find the raw
// throughput ceiling.
//
// Fixes vs baseline.js: setup() is fatal on failure (a missing rule =>
// every POST /events 400s), and the shared setup lib is used.
//
// Run:
//   k6 run --summary-export=loadtest/out/baseline-closed.json loadtest/mainflow-closed.js
// Env: API (http://localhost:8000), WEB (http://localhost:8080)

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { provisionTenant } from "./lib/setup.js";

const API = __ENV.API || "http://localhost:8000";
const WEB = __ENV.WEB || "http://localhost:8080";

const eventDuration = new Trend("event_duration", true);
const eventErrors = new Counter("event_errors");

export const options = {
  scenarios: {
    users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 5 },
        { duration: "2m", target: 10 },
        { duration: "2m", target: 20 },
        { duration: "2m", target: 30 },
        { duration: "3m", target: 40 }, // plateau -- watch CPU / p95 / throttling
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"],
    event_duration: ["p(95)<500"],
  },
};

export function setup() {
  return provisionTenant({ api: API });
}

export default function (data) {
  const auth = { headers: { Authorization: `Bearer ${data.token}` } };

  check(http.get(`${WEB}/login`, { tags: { step: "web-login" } }), {
    "web /login 200": (r) => r.status === 200,
  });
  check(http.get(`${API}/health`, { tags: { step: "health" } }), {
    "health 200": (r) => r.status === 200,
  });
  check(http.get(`${API}/events?tenantId=${data.tenantId}`, { ...auth, tags: { step: "events-list" } }), {
    "events list 200": (r) => r.status === 200,
  });

  const res = http.post(
    `${API}/events`,
    JSON.stringify({ tenantId: data.tenantId, type: "load-test.ping", payload: { ts: Date.now() } }),
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` }, tags: { step: "ingest" } },
  );
  eventDuration.add(res.timings.duration);
  if (res.status >= 400) eventErrors.add(1);
  check(res, { "event accepted": (r) => r.status >= 200 && r.status < 300 });

  sleep(1);
}

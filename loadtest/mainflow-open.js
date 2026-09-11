// Phase F -- open-model capacity test: find THIS host's edge for the
// synchronous main flow (POST /events).
//
// `ramping-arrival-rate` = open model: k6 pushes a fixed req/s regardless
// of how slow the system gets, so the queue builds and the knee is
// unmistakable. A closed `ramping-vus` model (see mainflow-closed.js)
// would self-limit and hide it.
//
// Levels are tuned for an 8-core / 8 GB host with the app_services k3s
// node CPU-prioritised and everything else stopped/zeroed -- see the plan
// (~/.claude/plans/purrfect-sauteeing-graham.md) "Resource discipline"
// section. Long 3-min holds because time is not a constraint here; they
// give Prometheus clean per-step averages.
//
// Run:
//   k6 run --summary-export=loadtest/out/baseline-open.json  loadtest/mainflow-open.js   # 1 replica, no HPA
//   k6 run --summary-export=loadtest/out/autoscaled-open.json loadtest/mainflow-open.js  # HPA active
// Env: API (default http://localhost:8000)

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";
import { provisionTenant } from "./lib/setup.js";

const API = __ENV.API || "http://localhost:8000";

const ingest = new Trend("ingest_latency", true);
const ingestErr = new Rate("ingest_errors");

export const options = {
  discardResponseBodies: true, // hot loop doesn't read bodies; setup.js opts back in per-request
  scenarios: {
    edge: {
      executor: "ramping-arrival-rate",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 60,
      // Short ramp -- the edge collapses fast, no need for long holds.
      stages: [
        { target: 3, duration: "30s" },
        { target: 6, duration: "30s" },
        { target: 10, duration: "40s" },
        { target: 15, duration: "40s" },
        { target: 20, duration: "40s" },
        { target: 0, duration: "20s" },
      ],
    },
  },
  thresholds: {
    // pass/fail markers only -- NOT abort. We want to see the whole curve.
    ingest_latency: ["p(95)<300", "p(99)<800"],
    ingest_errors: ["rate<0.01"],
    // only bail if it's really, sustainedly dead (lets transient blips ride)
    http_req_failed: [{ threshold: "rate<0.40", abortOnFail: true, delayAbortEval: "1m" }],
  },
};

export function setup() {
  return provisionTenant({ api: API });
}

export default function (data) {
  const res = http.post(
    `${API}/events`,
    JSON.stringify({
      tenantId: data.tenantId,
      type: "load-test.ping",
      payload: { ts: Date.now(), vu: __VU, iter: __ITER },
    }),
    {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      tags: { step: "ingest" },
    },
  );
  ingest.add(res.timings.duration);
  ingestErr.add(res.status >= 400);
  check(res, { "event accepted": (r) => r.status === 200 || r.status === 201 || r.status === 202 });
}

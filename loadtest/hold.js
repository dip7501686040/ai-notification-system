// Phase 2 -- hold a FIXED arrival rate so the system sits at steady state
// while you run loadtest/diag.sh against it. Not for finding the edge
// (that's mainflow-open.js) -- for diagnosing it.
//
//   k6 run -e RATE=8 -e DURATION=3m loadtest/hold.js
// Env: API, RATE (req/s, default 8), DURATION (default 2m; use 3m for a
//      steadier Grafana/Jaeger screenshot window)

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";
import { provisionTenant } from "./lib/setup.js";

const API = __ENV.API || "http://localhost:8000";
const RATE = Number(__ENV.RATE || 8);

const ingest = new Trend("ingest_latency", true);
const ingestErr = new Rate("ingest_errors");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    hold: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1s",
      duration: __ENV.DURATION || "2m",
      preAllocatedVUs: 20,
      maxVUs: 80,
    },
  },
};

export function setup() {
  return provisionTenant({ api: API });
}

export default function (data) {
  const r = http.post(
    `${API}/events`,
    JSON.stringify({ tenantId: data.tenantId, type: "load-test.ping", payload: { ts: Date.now() } }),
    {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      tags: { step: "ingest" },
    },
  );
  ingest.add(r.timings.duration);
  ingestErr.add(r.status >= 400);
  check(r, { ok: (x) => x.status >= 200 && x.status < 300 });
}

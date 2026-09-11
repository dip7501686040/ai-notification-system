// Phase F -- secondary demo: the async tail + KEDA-on-queue-depth.
//
// LOW rate (2-5 req/s). Requires ai-service (OpenAI), notification-service
// and channel-service scaled back up first, and OPENAI_API_KEY seeded into
// the `app-secrets` k8s secret (see the plan, "AI provider" decision).
//
// What it proves:
//   - the full fan-out runs (Jaeger shows a trace through ai-service with
//     no `event.ai.failed`);
//   - with channel-service held at 1 replica the queue
//     `channel-service.notification.created` backs up under load
//     (Prometheus `rabbitmq_queue_messages_ready`);
//   - the KEDA ScaledObject (loadtest/keda/channel-service.yaml) scales
//     channel-service out and the queue drains.
//
// Run:
//   k6 run --summary-export=loadtest/out/async-demo.json loadtest/mainflow-async.js
// Env: API (http://localhost:8000)

import http from "k6/http";
import { check } from "k6";
import { Trend, Rate } from "k6/metrics";
import { provisionTenant } from "./lib/setup.js";

const API = __ENV.API || "http://localhost:8000";

const ingest = new Trend("ingest_latency", true);
const ingestErr = new Rate("ingest_errors");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    async_tail: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 20,
      stages: [
        { target: 2, duration: "3m" },
        { target: 3, duration: "3m" },
        { target: 5, duration: "5m" }, // hold -- queue should build, then KEDA drains it
        { target: 2, duration: "3m" }, // back off -- watch KEDA cool down
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    ingest_latency: ["p(95)<500"],
    ingest_errors: ["rate<0.02"],
  },
};

export function setup() {
  return provisionTenant({ api: API, withOpenAI: true });
}

export default function (data) {
  const res = http.post(
    `${API}/events`,
    JSON.stringify({ tenantId: data.tenantId, type: "load-test.ping", payload: { ts: Date.now(), vu: __VU } }),
    {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` },
      tags: { step: "ingest" },
    },
  );
  ingest.add(res.timings.duration);
  ingestErr.add(res.status >= 400);
  check(res, { "event accepted": (r) => r.status >= 200 && r.status < 300 });
}

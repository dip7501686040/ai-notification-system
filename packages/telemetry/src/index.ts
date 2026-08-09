import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { trace, metrics, type Meter } from "@opentelemetry/api";

export function initTelemetry(serviceName: string): NodeSDK {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";

  const sdk = new NodeSDK({
    resource: new Resource({ [ATTR_SERVICE_NAME]: serviceName }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
      exportIntervalMillis: 10000,
    }),
    // Bridges pino log calls to OTLP via @opentelemetry/instrumentation-pino
    // (bundled in getNodeAutoInstrumentations()) -- without a registered
    // log record processor, that instrumentation's "log sending" is a no-op.
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint }))],
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });

  return sdk;
}

// Tags the currently active span with the tenant it belongs to, so traces
// stay searchable by tenant in Jaeger without every service needing its
// own span-tagging code -- tagging the request's root span is enough,
// since Jaeger indexes tags across the whole trace.
export function tagTenant(tenantId: string): void {
  trace.getActiveSpan()?.setAttribute("tenant.id", tenantId);
}

export function getMeter(name: string): Meter {
  return metrics.getMeter(name);
}

export interface TraceContext {
  trace_id?: string;
  span_id?: string;
}

// Pulls trace_id/span_id off the active OTel span so log lines stay
// correlated with the request's Jaeger trace without every call site
// touching the OTel API directly. Fields are undefined outside any span
// (pino drops undefined keys), so pino's JSON output stays consistent
// whether or not a trace is active.
export function getTraceContext(): TraceContext {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return {
    trace_id: spanContext?.traceId,
    span_id: spanContext?.spanId,
  };
}

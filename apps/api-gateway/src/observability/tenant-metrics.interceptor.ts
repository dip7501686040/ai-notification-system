import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { catchError, tap, throwError } from "rxjs";
import { getMeter, tagTenant } from "@ai-notification/telemetry";
import { resolveTenantId } from "../auth/resolve-tenant-id";

// Global interceptor: every HTTP request through the gateway gets its
// tenant tagged on the active trace span (makes traces searchable by
// tenant in Jaeger with zero changes downstream) and counted into
// per-tenant request/latency/error metrics, which the tenant-observability
// Grafana dashboard queries by tenant_id.
@Injectable()
export class TenantMetricsInterceptor implements NestInterceptor {
  private readonly requestsTotal;
  private readonly requestDuration;
  private readonly errorsTotal;

  constructor() {
    const meter = getMeter("api-gateway");
    this.requestsTotal = meter.createCounter("gateway_requests_total", {
      description: "HTTP requests handled by the gateway, by tenant",
    });
    this.requestDuration = meter.createHistogram("gateway_request_duration_ms", {
      description: "HTTP request duration in milliseconds, by tenant",
    });
    this.errorsTotal = meter.createCounter("gateway_errors_total", {
      description: "HTTP requests that errored, by tenant",
    });
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = resolveTenantId(request) ?? "unknown";
    const route = request.route?.path ?? request.path;
    const method = request.method;
    const start = Date.now();

    tagTenant(tenantId);

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const attributes = {
          tenant_id: tenantId,
          route,
          method,
          status_code: String(response.statusCode),
        };
        this.requestsTotal.add(1, attributes);
        this.requestDuration.record(Date.now() - start, attributes);
      }),
      catchError((error: { status?: number; name?: string }) => {
        const statusCode = typeof error?.status === "number" ? error.status : 500;
        const attributes = {
          tenant_id: tenantId,
          route,
          method,
          status_code: String(statusCode),
        };
        this.requestsTotal.add(1, attributes);
        this.requestDuration.record(Date.now() - start, attributes);
        this.errorsTotal.add(1, { tenant_id: tenantId, route, error_type: error?.name ?? "Error" });
        return throwError(() => error);
      }),
    );
  }
}

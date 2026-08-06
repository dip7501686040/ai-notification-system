import { ArgumentsHost, Catch, HttpException, type RpcExceptionFilter } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { status as grpcStatus } from "@grpc/grpc-js";
import { throwError, type Observable } from "rxjs";
import type { Logger } from "@ai-notification/logger";

interface GrpcErrorPayload {
  code: number;
  message: string;
}

const HTTP_TO_GRPC_STATUS: Record<number, number> = {
  400: grpcStatus.INVALID_ARGUMENT,
  401: grpcStatus.UNAUTHENTICATED,
  403: grpcStatus.PERMISSION_DENIED,
  404: grpcStatus.NOT_FOUND,
  409: grpcStatus.ALREADY_EXISTS,
  422: grpcStatus.INVALID_ARGUMENT,
};

function messageFrom(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === "string") {
    return response;
  }
  const message = (response as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : (message ?? exception.message);
}

// Registered per-service on the gRPC microservice (@UseFilters on the gRPC
// controller). Lets service methods keep throwing the same Nest
// HttpException subclasses (ConflictException, NotFoundException, ...) they
// already used when they had REST controllers -- this translates those into
// a proper gRPC status instead of every handler needing to build a response
// object.
//
// The Observable must error with a *plain* {code, message} object, not an
// RpcException instance: writeObservableToGrpc hands whatever this throws
// straight to grpc-js's call.emit("error", ...), which reads .code/.message
// directly off that value. An RpcException hides its payload behind
// .getError() instead of exposing .code, so wrapping it here silently
// degrades every response to UNKNOWN/500.
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<unknown> {
  // Sole place every gRPC service's unhandled exceptions pass through --
  // logging here (rather than at each throw site) is what gets them into
  // Loki, since this filter previously only converted exceptions to gRPC
  // status payloads and dropped everything else on the floor.
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, _host: ArgumentsHost): Observable<GrpcErrorPayload> {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HTTP_TO_GRPC_STATUS[status] ?? grpcStatus.INTERNAL;
      const message = messageFrom(exception);
      this.log(status >= 500 ? "error" : "warn", exception, message);
      return throwError(() => ({ code, message }));
    }

    if (exception instanceof RpcException) {
      const error = exception.getError();
      const payload =
        typeof error === "string"
          ? { code: grpcStatus.INTERNAL, message: error }
          : (error as GrpcErrorPayload);
      this.log("error", exception, payload.message);
      return throwError(() => payload);
    }

    const message = exception instanceof Error ? exception.message : "Internal error";
    this.log("error", exception, message);
    return throwError(() => ({ code: grpcStatus.INTERNAL, message }));
  }

  private log(level: "error" | "warn", exception: unknown, message: string): void {
    this.logger[level]({ err: exception }, message);
  }
}

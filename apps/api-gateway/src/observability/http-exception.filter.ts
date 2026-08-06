import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Logger } from "@ai-notification/logger";

// api-gateway's only global exception filter -- without it, Nest's built-in
// default filter handles uncaught errors (still produces a correct HTTP
// response) but never logs anything, so failures here and in every gRPC
// call proxied through grpc-call.ts were invisible in Loki.
@Catch()
export class HttpLoggingExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    // Mirrors Nest's own BaseExceptionFilter: an HttpException's response
    // can be a plain string (e.g. `new HttpException("...", 500)`, as
    // grpc-error.ts's throwAsHttpException does) -- normalize it into an
    // object the same way, instead of sending a bare JSON string that
    // breaks every client expecting `{statusCode, message}`.
    const body = !(exception instanceof HttpException)
      ? { statusCode: status, message: "Internal server error" }
      : typeof exception.getResponse() === "object"
        ? exception.getResponse()
        : { statusCode: status, message: exception.getResponse() };
    const message = exception instanceof Error ? exception.message : "Unhandled exception";

    this.logger[status >= 500 ? "error" : "warn"](
      { err: exception, method: request.method, url: request.url, status },
      message,
    );

    response.status(status).json(body);
  }
}

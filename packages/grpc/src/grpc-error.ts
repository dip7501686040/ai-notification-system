import * as grpc from "@grpc/grpc-js";
import { HttpException, HttpStatus } from "@nestjs/common";

const GRPC_TO_HTTP_STATUS: Partial<Record<grpc.status, number>> = {
  [grpc.status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [grpc.status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [grpc.status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [grpc.status.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [grpc.status.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [grpc.status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [grpc.status.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
};

export function isGrpcServiceError(error: unknown): error is grpc.ServiceError {
  return error instanceof Error && typeof (error as Partial<grpc.ServiceError>).code === "number";
}

// Inverse of GrpcExceptionFilter: turns a failed gRPC call back into the
// Nest HttpException an api-gateway REST controller should surface.
export function throwAsHttpException(error: grpc.ServiceError): never {
  const httpStatus = GRPC_TO_HTTP_STATUS[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  throw new HttpException(error.details || error.message, httpStatus);
}

import { isGrpcServiceError, throwAsHttpException } from "@ai-notification/grpc";

// Wraps a call into a *ViaGrpc client function: a rejected gRPC call
// surfaces as the matching Nest HttpException (via throwAsHttpException)
// instead of an opaque 500. Used by every REST controller in this service
// that proxies to a backend over gRPC.
export async function grpcCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isGrpcServiceError(error)) {
      throwAsHttpException(error);
    }
    throw error;
  }
}

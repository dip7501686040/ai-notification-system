import type * as grpc from "@grpc/grpc-js";

type UnaryMethod<Req, Res> = (
  request: Req,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: Res) => void,
) => grpc.ClientUnaryCall;

// Shared plumbing behind every hand-written *-client.ts RPC wrapper: apply
// a deadline, invoke the method, reject with the raw ServiceError on
// failure (callers decide how to translate it -- see grpc-error.ts) rather
// than swallowing it into a sentinel response.
export function callUnary<Req, Res>(
  client: grpc.Client,
  method: string,
  request: Req,
  timeoutMs = 5000,
): Promise<Res> {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMs);
    const fn = (client as unknown as Record<string, UnaryMethod<Req, Res>>)[method];
    if (!fn) {
      reject(new Error(`gRPC method "${method}" does not exist on this client`));
      return;
    }
    fn.call(client, request, { deadline }, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

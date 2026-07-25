import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface DispatchResult {
  success: boolean;
  error: string;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("channel.proto") as unknown as {
    channel: { v1: { Channel: grpc.ServiceClientConstructor } };
  };
  return new proto.channel.v1.Channel(address, grpc.credentials.createInsecure());
}

// Real SMTP/webhook sends legitimately take a few seconds -- longer than
// the 5s default most other RPCs in this codebase use.
const DISPATCH_TIMEOUT_MS = 10000;

export async function dispatchViaGrpc(
  address: string,
  channel: string,
  target: string,
  payload: unknown,
): Promise<DispatchResult> {
  const client = createClient(address);
  try {
    return await callUnary<
      { channel: string; target: string; payload_json: string },
      DispatchResult
    >(
      client,
      "Dispatch",
      { channel, target, payload_json: JSON.stringify(payload) },
      DISPATCH_TIMEOUT_MS,
    );
  } finally {
    client.close();
  }
}

import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";

export interface HealthCheckResult {
  name: string;
  address: string;
  status: "SERVING" | "NOT_SERVING" | "UNKNOWN" | "UNREACHABLE";
  latencyMs: number;
  error?: string;
}

interface HealthClient extends grpc.Client {
  Check(
    request: { service: string },
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: { status: string }) => void,
  ): grpc.ClientUnaryCall;
}

export function checkGrpcHealth(
  name: string,
  address: string,
  timeoutMs = 3000,
): Promise<HealthCheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const proto = loadProto("health.proto") as unknown as {
      grpc: { health: { v1: { Health: grpc.ServiceClientConstructor } } };
    };
    const HealthClientCtor = proto.grpc.health.v1.Health;
    const client = new HealthClientCtor(
      address,
      grpc.credentials.createInsecure(),
    ) as unknown as HealthClient;
    const deadline = new Date(Date.now() + timeoutMs);

    client.Check({ service: "" }, { deadline }, (error, response) => {
      const latencyMs = Date.now() - start;
      client.close();

      if (error) {
        resolve({ name, address, status: "UNREACHABLE", latencyMs, error: error.message });
        return;
      }

      resolve({
        name,
        address,
        status: (response.status as HealthCheckResult["status"]) ?? "UNKNOWN",
        latencyMs,
      });
    });
  });
}

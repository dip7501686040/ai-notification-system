import path from "node:path";
import { Transport, type MicroserviceOptions } from "@nestjs/microservices";
import { PROTO_DIR, defaultLoaderOptions } from "./proto";

export function grpcHealthMicroserviceOptions(port: number): MicroserviceOptions {
  return {
    transport: Transport.GRPC,
    options: {
      package: "grpc.health.v1",
      protoPath: path.join(PROTO_DIR, "health.proto"),
      url: `0.0.0.0:${port}`,
      loader: defaultLoaderOptions,
    },
  };
}

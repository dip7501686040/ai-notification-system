import "./tracing";
import "reflect-metadata";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import { Transport, type MicroserviceOptions } from "@nestjs/microservices";
import {
  grpcHealthMicroserviceOptions,
  GrpcExceptionFilter,
  PROTO_DIR,
  defaultLoaderOptions,
} from "@ai-notification/grpc";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("audit-service");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalFilters(new GrpcExceptionFilter(logger));

  app.connectMicroservice<MicroserviceOptions>(grpcHealthMicroserviceOptions(env.GRPC_PORT));
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.GRPC,
      options: {
        package: "audit.v1",
        protoPath: path.join(PROTO_DIR, "audit.proto"),
        url: `0.0.0.0:${env.AUDIT_GRPC_PORT}`,
        loader: defaultLoaderOptions,
      },
    },
    { inheritAppConfig: true },
  );

  await app.init();
  await app.startAllMicroservices();
  logger.info(`audit-service gRPC health server listening on port ${env.GRPC_PORT}`);
  logger.info(`audit-service gRPC audit server listening on port ${env.AUDIT_GRPC_PORT}`);
}

bootstrap();

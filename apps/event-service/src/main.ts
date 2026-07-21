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
  const logger = createLogger("event-service");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalFilters(new GrpcExceptionFilter());

  app.connectMicroservice<MicroserviceOptions>(grpcHealthMicroserviceOptions(env.GRPC_PORT));
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.GRPC,
      options: {
        package: "event.v1",
        protoPath: path.join(PROTO_DIR, "event.proto"),
        url: `0.0.0.0:${env.EVENT_GRPC_PORT}`,
        loader: defaultLoaderOptions,
      },
    },
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();
  logger.info(`event-service gRPC health server listening on port ${env.GRPC_PORT}`);
  logger.info(`event-service gRPC event server listening on port ${env.EVENT_GRPC_PORT}`);

  await app.listen(env.PORT);
  logger.info(`event-service listening on port ${env.PORT}`);
}

bootstrap();

import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { MicroserviceOptions } from "@nestjs/microservices";
import { grpcHealthMicroserviceOptions } from "@ai-notification/grpc";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("analytics-service");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.connectMicroservice<MicroserviceOptions>(grpcHealthMicroserviceOptions(env.GRPC_PORT));
  await app.startAllMicroservices();
  logger.info(`analytics-service gRPC health server listening on port ${env.GRPC_PORT}`);

  await app.listen(env.PORT);
  logger.info(`analytics-service listening on port ${env.PORT}`);
}

bootstrap();

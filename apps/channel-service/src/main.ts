import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type MicroserviceOptions } from "@nestjs/microservices";
import { grpcHealthMicroserviceOptions, GrpcExceptionFilter } from "@ai-notification/grpc";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("channel-service");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalFilters(new GrpcExceptionFilter(logger));

  app.connectMicroservice<MicroserviceOptions>(grpcHealthMicroserviceOptions(env.GRPC_PORT));

  await app.init();
  await app.startAllMicroservices();
  logger.info(`channel-service gRPC health server listening on port ${env.GRPC_PORT}`);
}

bootstrap();

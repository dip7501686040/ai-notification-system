import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { MicroserviceOptions } from "@nestjs/microservices";
import { grpcHealthMicroserviceOptions } from "@ai-notification/grpc";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { RedisIoAdapter } from "./notifications/redis-io.adapter";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("api-gateway");
  // rawBody: true adds req.rawBody alongside the normally-parsed JSON
  // body -- needed only by the Stripe webhook route, to verify its
  // signature against the exact bytes Stripe signed.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  // Bearer tokens, not cookies -- credentials stays false.
  app.enableCors({ origin: env.FRONTEND_URL });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const redisIoAdapter = new RedisIoAdapter(app, env.REDIS_URL);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.connectMicroservice<MicroserviceOptions>(grpcHealthMicroserviceOptions(env.GRPC_PORT));
  await app.startAllMicroservices();
  logger.info(`api-gateway gRPC health server listening on port ${env.GRPC_PORT}`);

  await app.listen(env.PORT);
  logger.info(`api-gateway listening on port ${env.PORT}`);
}

bootstrap();

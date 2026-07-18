import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("channel-service");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  await app.listen(env.PORT);
  logger.info(`channel-service listening on port ${env.PORT}`);
}

bootstrap();

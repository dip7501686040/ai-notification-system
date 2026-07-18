import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createLogger } from "@ai-notification/logger";
import { env } from "./env";

async function bootstrap() {
  const logger = createLogger("api-gateway");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  await app.listen(env.PORT);
  logger.info(`api-gateway listening on port ${env.PORT}`);
}

bootstrap();

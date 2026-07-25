import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { RabbitMQModule } from "@ai-notification/rabbitmq";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { TenantsModule } from "./tenants/tenants.module";
import { env } from "./env";

@Module({
  imports: [PrismaModule, RabbitMQModule.forRoot({ url: env.RABBITMQ_URL }), TenantsModule],
  controllers: [HealthController, GrpcHealthController],
})
export class AppModule {}

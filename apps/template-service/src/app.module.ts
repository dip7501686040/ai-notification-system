import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { TemplatesModule } from "./templates/templates.module";

@Module({
  imports: [PrismaModule, TemplatesModule],
  controllers: [HealthController, GrpcHealthController],
})
export class AppModule {}

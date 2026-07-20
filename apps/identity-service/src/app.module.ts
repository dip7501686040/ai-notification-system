import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController, GrpcHealthController],
})
export class AppModule {}

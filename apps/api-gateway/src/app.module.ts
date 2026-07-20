import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { ServiceHealthController } from "./health/service-health.controller";
import { ProtectedController } from "./auth/protected.controller";

@Module({
  controllers: [
    HealthController,
    GrpcHealthController,
    ServiceHealthController,
    ProtectedController,
  ],
})
export class AppModule {}

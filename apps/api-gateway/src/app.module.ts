import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { ServiceHealthController } from "./health/service-health.controller";

@Module({
  controllers: [HealthController, GrpcHealthController, ServiceHealthController],
})
export class AppModule {}

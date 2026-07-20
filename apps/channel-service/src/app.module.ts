import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";

@Module({
  controllers: [HealthController, GrpcHealthController],
})
export class AppModule {}

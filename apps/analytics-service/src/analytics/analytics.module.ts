import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsGrpcController } from "./grpc/analytics-grpc.controller";
import { AnalyticsConsumerService } from "./analytics-consumer.service";

@Module({
  controllers: [AnalyticsGrpcController],
  providers: [AnalyticsService, AnalyticsConsumerService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

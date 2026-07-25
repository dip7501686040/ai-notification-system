import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { ChannelModule } from "./channel/channel.module";

@Module({
  imports: [ChannelModule],
  controllers: [HealthController, GrpcHealthController],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { ChannelModule } from "./channel/channel.module";

@Module({
  imports: [ChannelModule],
  controllers: [GrpcHealthController],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { RabbitMQModule } from "@ai-notification/rabbitmq";
import { ChannelModule } from "./channel/channel.module";
import { env } from "./env";

@Module({
  imports: [RabbitMQModule.forRoot({ url: env.RABBITMQ_URL }), ChannelModule],
  controllers: [GrpcHealthController],
})
export class AppModule {}

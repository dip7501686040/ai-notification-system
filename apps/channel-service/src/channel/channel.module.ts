import { Module } from "@nestjs/common";
import { ChannelDispatchService } from "./channel-dispatch.service";
import { ChannelGrpcController } from "./grpc/channel-grpc.controller";
import { EmailConnector } from "./connectors/email.connector";
import { WebhookConnector } from "./connectors/webhook.connector";

@Module({
  controllers: [ChannelGrpcController],
  providers: [ChannelDispatchService, EmailConnector, WebhookConnector],
})
export class ChannelModule {}

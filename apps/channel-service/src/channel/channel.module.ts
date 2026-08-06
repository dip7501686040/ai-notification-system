import { Module } from "@nestjs/common";
import { ChannelDispatchService } from "./channel-dispatch.service";
import { ChannelConsumerService } from "./channel-consumer.service";
import { EmailConnector } from "./connectors/email.connector";
import { WebhookConnector } from "./connectors/webhook.connector";

@Module({
  providers: [ChannelDispatchService, ChannelConsumerService, EmailConnector, WebhookConnector],
})
export class ChannelModule {}

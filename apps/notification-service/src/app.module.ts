import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { RabbitMQModule } from "@ai-notification/rabbitmq";
import { PrismaModule } from "./prisma/prisma.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { env } from "./env";

@Module({
  imports: [PrismaModule, RabbitMQModule.forRoot({ url: env.RABBITMQ_URL }), NotificationsModule],
  controllers: [GrpcHealthController],
})
export class AppModule {}

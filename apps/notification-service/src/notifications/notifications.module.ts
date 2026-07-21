import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationGrpcController } from "./grpc/notification-grpc.controller";
import { DispatchSimulatorService } from "./dispatch-simulator.service";
import { NotificationConsumerService } from "./notification-consumer.service";
import { RetrySchedulerService } from "./retry-scheduler.service";

@Module({
  controllers: [NotificationGrpcController],
  providers: [
    NotificationsService,
    DispatchSimulatorService,
    NotificationConsumerService,
    RetrySchedulerService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

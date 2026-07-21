import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { EventGrpcController } from "./grpc/event-grpc.controller";

@Module({
  controllers: [EventGrpcController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

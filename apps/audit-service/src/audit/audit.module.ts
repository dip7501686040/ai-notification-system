import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditGrpcController } from "./grpc/audit-grpc.controller";
import { AuditConsumerService } from "./audit-consumer.service";

@Module({
  controllers: [AuditGrpcController],
  providers: [AuditService, AuditConsumerService],
  exports: [AuditService],
})
export class AuditModule {}

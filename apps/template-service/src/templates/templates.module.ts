import { Module } from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { TemplateGrpcController } from "./grpc/template-grpc.controller";

@Module({
  controllers: [TemplateGrpcController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}

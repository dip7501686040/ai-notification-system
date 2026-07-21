import { Module } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { TenantGrpcController } from "./grpc/tenant-grpc.controller";

@Module({
  controllers: [TenantGrpcController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}

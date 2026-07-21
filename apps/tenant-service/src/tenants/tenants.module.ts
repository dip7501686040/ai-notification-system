import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { TenantGrpcController } from "./grpc/tenant-grpc.controller";

@Module({
  controllers: [TenantsController, TenantGrpcController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}

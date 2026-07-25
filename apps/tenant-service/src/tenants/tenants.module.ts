import { Module } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { ApiKeysService } from "./api-keys.service";
import { TenantGrpcController } from "./grpc/tenant-grpc.controller";

@Module({
  controllers: [TenantGrpcController],
  providers: [TenantsService, ApiKeysService],
  exports: [TenantsService, ApiKeysService],
})
export class TenantsModule {}

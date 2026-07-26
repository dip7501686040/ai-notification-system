import { Module } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { ApiKeysService } from "./api-keys.service";
import { BillingService } from "./billing.service";
import { TenantGrpcController } from "./grpc/tenant-grpc.controller";

@Module({
  controllers: [TenantGrpcController],
  providers: [TenantsService, ApiKeysService, BillingService],
  exports: [TenantsService, ApiKeysService, BillingService],
})
export class TenantsModule {}

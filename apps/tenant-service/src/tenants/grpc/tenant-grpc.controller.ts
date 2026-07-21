import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { TenantsService } from "../tenants.service";

interface GetTenantRequest {
  tenant_id: string;
}

interface TenantMessage {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

interface GetTenantResponse {
  found: boolean;
  tenant: TenantMessage | null;
}

interface CheckMembershipRequest {
  tenant_id: string;
  user_id: string;
}

interface CheckMembershipResponse {
  is_member: boolean;
  role: string;
}

@Controller()
export class TenantGrpcController {
  constructor(private readonly tenantsService: TenantsService) {}

  @GrpcMethod("Tenant", "GetTenant")
  async getTenant(data: GetTenantRequest): Promise<GetTenantResponse> {
    const tenant = await this.tenantsService.findUnique({ id: data.tenant_id });
    if (!tenant) {
      return { found: false, tenant: null };
    }

    return {
      found: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
      },
    };
  }

  @GrpcMethod("Tenant", "CheckMembership")
  async checkMembership(data: CheckMembershipRequest): Promise<CheckMembershipResponse> {
    const membership = await this.tenantsService.getMembership(data.tenant_id, data.user_id);
    return { is_member: Boolean(membership), role: membership?.role ?? "" };
  }
}

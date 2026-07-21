import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { Tenant, TenantMember } from "../../../generated/prisma-client";
import { TenantsService } from "../tenants.service";
import type { TenantRole } from "../dto/add-member.dto";

interface GetTenantRequest {
  tenant_id: string;
}

interface GetTenantForUserRequest {
  requester_id: string;
  tenant_id: string;
}

interface TenantMessage {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings_json: string;
  created_at: string;
  updated_at: string;
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

interface MemberMessage {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface SuccessResponse {
  success: boolean;
}

interface CreateTenantRequest {
  requester_id: string;
  name: string;
  slug: string;
  plan: string;
}

interface TenantWithRoleMessage {
  tenant: TenantMessage;
  role: string;
}

interface ListTenantsRequest {
  requester_id: string;
  query: ListQueryMessage;
}

interface ListTenantsResponse {
  list: TenantWithRoleMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface UpdateTenantRequest {
  requester_id: string;
  tenant_id: string;
  name: string;
  plan: string;
  status: string;
  settings_json: string;
}

interface DeleteTenantRequest {
  requester_id: string;
  tenant_id: string;
}

interface ListMembersRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
}

interface ListMembersResponse {
  list: MemberMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface AddMemberRequest {
  requester_id: string;
  tenant_id: string;
  user_id: string;
  role: string;
}

interface UpdateMemberRoleRequest {
  requester_id: string;
  tenant_id: string;
  user_id: string;
  role: string;
}

interface RemoveMemberRequest {
  requester_id: string;
  tenant_id: string;
  user_id: string;
}

function toTenantMessage(tenant: Tenant): TenantMessage {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    status: tenant.status,
    settings_json: JSON.stringify(tenant.settings),
    created_at: tenant.createdAt.toISOString(),
    updated_at: tenant.updatedAt.toISOString(),
  };
}

function toMemberMessage(member: TenantMember): MemberMessage {
  return {
    id: member.id,
    tenant_id: member.tenantId,
    user_id: member.userId,
    role: member.role,
    created_at: member.createdAt.toISOString(),
  };
}

function toRawListQuery(query: ListQueryMessage | undefined): RawListQuery {
  return {
    page: query?.page || undefined,
    limit: query?.limit || undefined,
    search: query?.search || undefined,
    sort_fields: query?.sort_fields || undefined,
    sort_type: query?.sort_type || undefined,
  };
}

@Controller()
export class TenantGrpcController {
  constructor(private readonly tenantsService: TenantsService) {}

  @GrpcMethod("Tenant", "GetTenant")
  async getTenant(data: GetTenantRequest): Promise<GetTenantResponse> {
    const tenant = await this.tenantsService.findUnique({ id: data.tenant_id });
    return tenant
      ? { found: true, tenant: toTenantMessage(tenant) }
      : { found: false, tenant: null };
  }

  @GrpcMethod("Tenant", "GetTenantForUser")
  async getTenantForUser(data: GetTenantForUserRequest): Promise<TenantMessage> {
    const tenant = await this.tenantsService.findOne(data.tenant_id, data.requester_id);
    return toTenantMessage(tenant);
  }

  @GrpcMethod("Tenant", "CheckMembership")
  async checkMembership(data: CheckMembershipRequest): Promise<CheckMembershipResponse> {
    const membership = await this.tenantsService.getMembership(data.tenant_id, data.user_id);
    return { is_member: Boolean(membership), role: membership?.role ?? "" };
  }

  @GrpcMethod("Tenant", "CreateTenant")
  async createTenant(data: CreateTenantRequest): Promise<TenantMessage> {
    const tenant = await this.tenantsService.create(data.requester_id, {
      name: data.name,
      slug: data.slug,
      plan: data.plan || undefined,
    });
    return toTenantMessage(tenant);
  }

  @GrpcMethod("Tenant", "ListTenants")
  async listTenants(data: ListTenantsRequest): Promise<ListTenantsResponse> {
    const result = await this.tenantsService.findAllForUser(
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(({ role, ...tenant }) => ({ tenant: toTenantMessage(tenant), role })),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Tenant", "UpdateTenant")
  async updateTenant(data: UpdateTenantRequest): Promise<TenantMessage> {
    const tenant = await this.tenantsService.updateTenant(data.tenant_id, data.requester_id, {
      name: data.name || undefined,
      plan: data.plan || undefined,
      status: data.status || undefined,
      settings: data.settings_json ? JSON.parse(data.settings_json) : undefined,
    });
    return toTenantMessage(tenant);
  }

  @GrpcMethod("Tenant", "DeleteTenant")
  async deleteTenant(data: DeleteTenantRequest): Promise<SuccessResponse> {
    await this.tenantsService.remove(data.tenant_id, data.requester_id);
    return { success: true };
  }

  @GrpcMethod("Tenant", "ListMembers")
  async listMembers(data: ListMembersRequest): Promise<ListMembersResponse> {
    const result = await this.tenantsService.listMembers(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(toMemberMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Tenant", "AddMember")
  async addMember(data: AddMemberRequest): Promise<MemberMessage> {
    const member = await this.tenantsService.addMember(data.tenant_id, data.requester_id, {
      userId: data.user_id,
      role: (data.role || undefined) as TenantRole | undefined,
    });
    return toMemberMessage(member);
  }

  @GrpcMethod("Tenant", "UpdateMemberRole")
  async updateMemberRole(data: UpdateMemberRoleRequest): Promise<MemberMessage> {
    const member = await this.tenantsService.updateMemberRole(
      data.tenant_id,
      data.requester_id,
      data.user_id,
      data.role as TenantRole,
    );
    return toMemberMessage(member);
  }

  @GrpcMethod("Tenant", "RemoveMember")
  async removeMember(data: RemoveMemberRequest): Promise<SuccessResponse> {
    await this.tenantsService.removeMember(data.tenant_id, data.requester_id, data.user_id);
    return { success: true };
  }
}

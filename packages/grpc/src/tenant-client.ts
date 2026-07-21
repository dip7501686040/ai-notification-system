import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

export interface GetTenantResult {
  found: boolean;
  tenant: TenantSummary | null;
}

export interface CheckMembershipResult {
  isMember: boolean;
  role: string;
}

// Wire shapes from tenant.proto (keepCase: true -> snake_case field names).
interface TenantWireMessage {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

interface GetTenantWireResponse {
  found: boolean;
  tenant: TenantWireMessage;
}

interface CheckMembershipWireResponse {
  is_member: boolean;
  role: string;
}

interface TenantClient extends grpc.Client {
  GetTenant(
    request: { tenant_id: string },
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: GetTenantWireResponse) => void,
  ): grpc.ClientUnaryCall;
  CheckMembership(
    request: { tenant_id: string; user_id: string },
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: CheckMembershipWireResponse) => void,
  ): grpc.ClientUnaryCall;
}

function createClient(address: string): TenantClient {
  const proto = loadProto("tenant.proto") as unknown as {
    tenant: { v1: { Tenant: grpc.ServiceClientConstructor } };
  };
  const TenantClientCtor = proto.tenant.v1.Tenant;
  return new TenantClientCtor(
    address,
    grpc.credentials.createInsecure(),
  ) as unknown as TenantClient;
}

export function getTenantViaGrpc(
  address: string,
  tenantId: string,
  timeoutMs = 3000,
): Promise<GetTenantResult> {
  return new Promise((resolve) => {
    const client = createClient(address);
    const deadline = new Date(Date.now() + timeoutMs);

    client.GetTenant({ tenant_id: tenantId }, { deadline }, (error, response) => {
      client.close();

      if (error || !response.found) {
        resolve({ found: false, tenant: null });
        return;
      }

      resolve({
        found: true,
        tenant: {
          id: response.tenant.id,
          name: response.tenant.name,
          slug: response.tenant.slug,
          plan: response.tenant.plan,
          status: response.tenant.status,
        },
      });
    });
  });
}

export function checkMembershipViaGrpc(
  address: string,
  tenantId: string,
  userId: string,
  timeoutMs = 3000,
): Promise<CheckMembershipResult> {
  return new Promise((resolve) => {
    const client = createClient(address);
    const deadline = new Date(Date.now() + timeoutMs);

    client.CheckMembership(
      { tenant_id: tenantId, user_id: userId },
      { deadline },
      (error, response) => {
        client.close();

        if (error) {
          resolve({ isMember: false, role: "" });
          return;
        }

        resolve({ isMember: response.is_member, role: response.role });
      },
    );
  });
}

export interface TenantResult {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMemberResult {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Same shape as RawListQuery (packages/common/src/list-query.ts) -- kept
// structurally compatible rather than imported, so this package doesn't
// need a dependency on @ai-notification/common for one small interface.
export interface ListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface FullTenantWireMessage {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings_json: string;
  created_at: string;
  updated_at: string;
}

interface MemberWireMessage {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface TenantWithRoleWireMessage {
  tenant: FullTenantWireMessage;
  role: string;
}

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListTenantsWireResponse {
  list: TenantWithRoleWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface ListMembersWireResponse {
  list: MemberWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface SuccessWireResponse {
  success: boolean;
}

function toTenantResult(wire: FullTenantWireMessage): TenantResult {
  return {
    id: wire.id,
    name: wire.name,
    slug: wire.slug,
    plan: wire.plan,
    status: wire.status,
    settings: wire.settings_json ? JSON.parse(wire.settings_json) : null,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function toMemberResult(wire: MemberWireMessage): TenantMemberResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    userId: wire.user_id,
    role: wire.role,
    createdAt: wire.created_at,
  };
}

function toQueryWire(query: ListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function getTenantForUserViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
): Promise<TenantResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string },
      FullTenantWireMessage
    >(client, "GetTenantForUser", { requester_id: requesterId, tenant_id: tenantId });
    return toTenantResult(response);
  } finally {
    client.close();
  }
}

export async function createTenantViaGrpc(
  address: string,
  requesterId: string,
  data: { name: string; slug: string; plan?: string },
): Promise<TenantResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; name: string; slug: string; plan: string },
      FullTenantWireMessage
    >(client, "CreateTenant", {
      requester_id: requesterId,
      name: data.name,
      slug: data.slug,
      plan: data.plan ?? "",
    });
    return toTenantResult(response);
  } finally {
    client.close();
  }
}

export async function listTenantsViaGrpc(
  address: string,
  requesterId: string,
  query: ListQueryParams,
): Promise<PaginatedResult<TenantResult & { role: string }>> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; query: ListQueryWireMessage },
      ListTenantsWireResponse
    >(client, "ListTenants", { requester_id: requesterId, query: toQueryWire(query) });
    return {
      list: response.list.map((item) => ({ ...toTenantResult(item.tenant), role: item.role })),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function updateTenantViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  data: { name?: string; plan?: string; status?: string; settings?: unknown },
): Promise<TenantResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        tenant_id: string;
        name: string;
        plan: string;
        status: string;
        settings_json: string;
      },
      FullTenantWireMessage
    >(client, "UpdateTenant", {
      requester_id: requesterId,
      tenant_id: tenantId,
      name: data.name ?? "",
      plan: data.plan ?? "",
      status: data.status ?? "",
      settings_json: data.settings !== undefined ? JSON.stringify(data.settings) : "",
    });
    return toTenantResult(response);
  } finally {
    client.close();
  }
}

export async function deleteTenantViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
): Promise<void> {
  const client = createClient(address);
  try {
    await callUnary<{ requester_id: string; tenant_id: string }, SuccessWireResponse>(
      client,
      "DeleteTenant",
      { requester_id: requesterId, tenant_id: tenantId },
    );
  } finally {
    client.close();
  }
}

export async function listMembersViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: ListQueryParams,
): Promise<PaginatedResult<TenantMemberResult>> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; query: ListQueryWireMessage },
      ListMembersWireResponse
    >(client, "ListMembers", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toMemberResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function addMemberViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  data: { userId: string; role?: string },
): Promise<TenantMemberResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; user_id: string; role: string },
      MemberWireMessage
    >(client, "AddMember", {
      requester_id: requesterId,
      tenant_id: tenantId,
      user_id: data.userId,
      role: data.role ?? "",
    });
    return toMemberResult(response);
  } finally {
    client.close();
  }
}

export async function updateMemberRoleViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  userId: string,
  role: string,
): Promise<TenantMemberResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; user_id: string; role: string },
      MemberWireMessage
    >(client, "UpdateMemberRole", {
      requester_id: requesterId,
      tenant_id: tenantId,
      user_id: userId,
      role,
    });
    return toMemberResult(response);
  } finally {
    client.close();
  }
}

export async function removeMemberViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  const client = createClient(address);
  try {
    await callUnary<
      { requester_id: string; tenant_id: string; user_id: string },
      SuccessWireResponse
    >(client, "RemoveMember", { requester_id: requesterId, tenant_id: tenantId, user_id: userId });
  } finally {
    client.close();
  }
}

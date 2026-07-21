import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";

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

import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface TemplateResult {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTemplatesResult {
  list: TemplateResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TemplateListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

export interface RenderTemplateResult {
  found: boolean;
  subject: string;
  body: string;
}

interface TemplateWireMessage {
  id: string;
  tenant_id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListTemplatesWireResponse {
  list: TemplateWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface SuccessWireResponse {
  success: boolean;
}

interface RenderTemplateWireResponse {
  found: boolean;
  subject: string;
  body: string;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("template.proto") as unknown as {
    template: { v1: { Template: grpc.ServiceClientConstructor } };
  };
  return new proto.template.v1.Template(address, grpc.credentials.createInsecure());
}

function toTemplateResult(wire: TemplateWireMessage): TemplateResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    name: wire.name,
    channel: wire.channel,
    subject: wire.subject,
    body: wire.body,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function toQueryWire(query: TemplateListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function createTemplateViaGrpc(
  address: string,
  requesterId: string,
  data: {
    tenantId: string;
    name: string;
    channel: string;
    subject?: string;
    body: string;
  },
): Promise<TemplateResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        tenant_id: string;
        name: string;
        channel: string;
        subject: string;
        body: string;
      },
      TemplateWireMessage
    >(client, "CreateTemplate", {
      requester_id: requesterId,
      tenant_id: data.tenantId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? "",
      body: data.body,
    });
    return toTemplateResult(response);
  } finally {
    client.close();
  }
}

export async function listTemplatesViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: TemplateListQueryParams,
): Promise<PaginatedTemplatesResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; query: ListQueryWireMessage },
      ListTemplatesWireResponse
    >(client, "ListTemplates", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toTemplateResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function getTemplateViaGrpc(
  address: string,
  requesterId: string,
  templateId: string,
): Promise<TemplateResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; template_id: string },
      TemplateWireMessage
    >(client, "GetTemplate", { requester_id: requesterId, template_id: templateId });
    return toTemplateResult(response);
  } finally {
    client.close();
  }
}

export async function updateTemplateViaGrpc(
  address: string,
  requesterId: string,
  templateId: string,
  data: {
    name?: string;
    channel?: string;
    subject?: string;
    body?: string;
  },
): Promise<TemplateResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        template_id: string;
        name: string;
        channel: string;
        subject: string;
        body: string;
      },
      TemplateWireMessage
    >(client, "UpdateTemplate", {
      requester_id: requesterId,
      template_id: templateId,
      name: data.name ?? "",
      channel: data.channel ?? "",
      subject: data.subject ?? "",
      body: data.body ?? "",
    });
    return toTemplateResult(response);
  } finally {
    client.close();
  }
}

export async function deleteTemplateViaGrpc(
  address: string,
  requesterId: string,
  templateId: string,
): Promise<void> {
  const client = createClient(address);
  try {
    await callUnary<{ requester_id: string; template_id: string }, SuccessWireResponse>(
      client,
      "DeleteTemplate",
      { requester_id: requesterId, template_id: templateId },
    );
  } finally {
    client.close();
  }
}

// Internal-only (no requesterId) -- called by notification-service, not
// routed through api-gateway.
export async function renderTemplateViaGrpc(
  address: string,
  tenantId: string,
  name: string,
  channel: string,
  variables: Record<string, unknown>,
): Promise<RenderTemplateResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { tenant_id: string; name: string; channel: string; variables_json: string },
      RenderTemplateWireResponse
    >(client, "RenderTemplate", {
      tenant_id: tenantId,
      name,
      channel,
      variables_json: JSON.stringify(variables),
    });
    return response;
  } finally {
    client.close();
  }
}

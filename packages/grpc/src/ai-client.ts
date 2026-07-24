import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface EventAnalysisResult {
  id: string;
  tenantId: string;
  eventId: string;
  type: string;
  provider: string;
  model: string;
  summary: string;
  category: string;
  severity: string;
  businessImpact: string;
  recommendation: string;
  isDuplicate: boolean;
  duplicateOfEventId: string;
  status: string;
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEventAnalysesResult {
  list: EventAnalysisResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AiConfigResult {
  tenantId: string;
  provider: string;
  model: string;
}

// Same shape as RawListQuery (packages/common/src/list-query.ts) -- kept
// structurally compatible rather than imported (see tenant-client.ts).
export interface EventAnalysisListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface EventAnalysisWireMessage {
  id: string;
  tenant_id: string;
  event_id: string;
  type: string;
  provider: string;
  model: string;
  summary: string;
  category: string;
  severity: string;
  business_impact: string;
  recommendation: string;
  is_duplicate: boolean;
  duplicate_of_event_id: string;
  status: string;
  error: string;
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

interface ListEventAnalysesWireResponse {
  list: EventAnalysisWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface AiConfigWireMessage {
  tenant_id: string;
  provider: string;
  model: string;
}

function createClient(address: string): grpc.Client {
  const proto = loadProto("ai.proto") as unknown as {
    ai: { v1: { AiAnalysis: grpc.ServiceClientConstructor } };
  };
  return new proto.ai.v1.AiAnalysis(address, grpc.credentials.createInsecure());
}

function toEventAnalysisResult(wire: EventAnalysisWireMessage): EventAnalysisResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    eventId: wire.event_id,
    type: wire.type,
    provider: wire.provider,
    model: wire.model,
    summary: wire.summary,
    category: wire.category,
    severity: wire.severity,
    businessImpact: wire.business_impact,
    recommendation: wire.recommendation,
    isDuplicate: wire.is_duplicate,
    duplicateOfEventId: wire.duplicate_of_event_id,
    status: wire.status,
    error: wire.error,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  };
}

function toAiConfigResult(wire: AiConfigWireMessage): AiConfigResult {
  return { tenantId: wire.tenant_id, provider: wire.provider, model: wire.model };
}

function toQueryWire(query: EventAnalysisListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function listEventAnalysesViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: EventAnalysisListQueryParams,
): Promise<PaginatedEventAnalysesResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; query: ListQueryWireMessage },
      ListEventAnalysesWireResponse
    >(client, "ListEventAnalyses", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toEventAnalysisResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function getEventAnalysisViaGrpc(
  address: string,
  requesterId: string,
  analysisId: string,
): Promise<EventAnalysisResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; analysis_id: string },
      EventAnalysisWireMessage
    >(client, "GetEventAnalysis", { requester_id: requesterId, analysis_id: analysisId });
    return toEventAnalysisResult(response);
  } finally {
    client.close();
  }
}

export async function getEventAnalysisByEventViaGrpc(
  address: string,
  requesterId: string,
  eventId: string,
): Promise<EventAnalysisResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; event_id: string },
      EventAnalysisWireMessage
    >(client, "GetEventAnalysisByEvent", { requester_id: requesterId, event_id: eventId });
    return toEventAnalysisResult(response);
  } finally {
    client.close();
  }
}

export async function getAiConfigViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
): Promise<AiConfigResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string },
      AiConfigWireMessage
    >(client, "GetAiConfig", { requester_id: requesterId, tenant_id: tenantId });
    return toAiConfigResult(response);
  } finally {
    client.close();
  }
}

export async function setAiConfigViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  provider: string,
  model: string,
): Promise<AiConfigResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; provider: string; model: string },
      AiConfigWireMessage
    >(client, "SetAiConfig", {
      requester_id: requesterId,
      tenant_id: tenantId,
      provider,
      model,
    });
    return toAiConfigResult(response);
  } finally {
    client.close();
  }
}

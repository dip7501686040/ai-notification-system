import * as grpc from "@grpc/grpc-js";
import { loadProto } from "./proto";
import { callUnary } from "./call-unary";

export interface EventResult {
  id: string;
  tenantId: string;
  type: string;
  source: string;
  payload: unknown;
  status: string;
  createdAt: string;
}

export interface PaginatedEventsResult {
  list: EventResult[];
  total: number;
  page: number;
  pageSize: number;
}

// Same shape as RawListQuery (packages/common/src/list-query.ts) -- kept
// structurally compatible rather than imported (see tenant-client.ts).
export interface EventListQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  sort_fields?: string;
  sort_type?: string;
}

interface EventWireMessage {
  id: string;
  tenant_id: string;
  type: string;
  source: string;
  payload_json: string;
  status: string;
  created_at: string;
}

interface ListQueryWireMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface ListEventsWireResponse {
  list: EventWireMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface EventClient extends grpc.Client {
  CreateEvent(
    request: {
      requester_id: string;
      tenant_id: string;
      type: string;
      source: string;
      payload_json: string;
    },
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: EventWireMessage) => void,
  ): grpc.ClientUnaryCall;
}

function createClient(address: string): EventClient {
  const proto = loadProto("event.proto") as unknown as {
    event: { v1: { Event: grpc.ServiceClientConstructor } };
  };
  return new proto.event.v1.Event(
    address,
    grpc.credentials.createInsecure(),
  ) as unknown as EventClient;
}

function toEventResult(wire: EventWireMessage): EventResult {
  return {
    id: wire.id,
    tenantId: wire.tenant_id,
    type: wire.type,
    source: wire.source,
    payload: wire.payload_json ? JSON.parse(wire.payload_json) : null,
    status: wire.status,
    createdAt: wire.created_at,
  };
}

function toQueryWire(query: EventListQueryParams): ListQueryWireMessage {
  return {
    page: query.page ?? "",
    limit: query.limit ?? "",
    search: query.search ?? "",
    sort_fields: query.sort_fields ?? "",
    sort_type: query.sort_type ?? "",
  };
}

export async function createEventViaGrpc(
  address: string,
  requesterId: string,
  data: { tenantId: string; type: string; source?: string; payload: unknown },
): Promise<EventResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      {
        requester_id: string;
        tenant_id: string;
        type: string;
        source: string;
        payload_json: string;
      },
      EventWireMessage
    >(client, "CreateEvent", {
      requester_id: requesterId,
      tenant_id: data.tenantId,
      type: data.type,
      source: data.source ?? "",
      payload_json: JSON.stringify(data.payload),
    });
    return toEventResult(response);
  } finally {
    client.close();
  }
}

export async function listEventsViaGrpc(
  address: string,
  requesterId: string,
  tenantId: string,
  query: EventListQueryParams,
): Promise<PaginatedEventsResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<
      { requester_id: string; tenant_id: string; query: ListQueryWireMessage },
      ListEventsWireResponse
    >(client, "ListEvents", {
      requester_id: requesterId,
      tenant_id: tenantId,
      query: toQueryWire(query),
    });
    return {
      list: response.list.map(toEventResult),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  } finally {
    client.close();
  }
}

export async function getEventViaGrpc(
  address: string,
  requesterId: string,
  eventId: string,
): Promise<EventResult> {
  const client = createClient(address);
  try {
    const response = await callUnary<{ requester_id: string; event_id: string }, EventWireMessage>(
      client,
      "GetEvent",
      { requester_id: requesterId, event_id: eventId },
    );
    return toEventResult(response);
  } finally {
    client.close();
  }
}

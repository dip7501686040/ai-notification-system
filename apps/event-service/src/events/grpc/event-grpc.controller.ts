import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import type { RawListQuery } from "@ai-notification/common";
import type { Event } from "../../../generated/prisma-client";
import { EventsService } from "../events.service";

interface EventMessage {
  id: string;
  tenant_id: string;
  type: string;
  source: string;
  payload_json: string;
  status: string;
  created_at: string;
}

interface ListQueryMessage {
  page: string;
  limit: string;
  search: string;
  sort_fields: string;
  sort_type: string;
}

interface CreateEventRequest {
  requester_id: string;
  tenant_id: string;
  type: string;
  source: string;
  payload_json: string;
}

interface ListEventsRequest {
  requester_id: string;
  tenant_id: string;
  query: ListQueryMessage;
}

interface ListEventsResponse {
  list: EventMessage[];
  total: number;
  page: number;
  page_size: number;
}

interface GetEventRequest {
  requester_id: string;
  event_id: string;
}

interface IngestViaApiKeyRequest {
  tenant_id: string;
  type: string;
  source: string;
  payload_json: string;
}

function toEventMessage(event: Event): EventMessage {
  return {
    id: event.id,
    tenant_id: event.tenantId,
    type: event.type,
    source: event.source ?? "",
    payload_json: JSON.stringify(event.payload),
    status: event.status,
    created_at: event.createdAt.toISOString(),
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
export class EventGrpcController {
  constructor(private readonly eventsService: EventsService) {}

  @GrpcMethod("Event", "CreateEvent")
  async createEvent(data: CreateEventRequest): Promise<EventMessage> {
    const event = await this.eventsService.ingest(data.requester_id, {
      tenantId: data.tenant_id,
      type: data.type,
      source: data.source || undefined,
      payload: data.payload_json ? JSON.parse(data.payload_json) : {},
    });
    return toEventMessage(event);
  }

  @GrpcMethod("Event", "ListEvents")
  async listEvents(data: ListEventsRequest): Promise<ListEventsResponse> {
    const result = await this.eventsService.findAllForTenant(
      data.tenant_id,
      data.requester_id,
      toRawListQuery(data.query),
    );
    return {
      list: result.list.map(toEventMessage),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }

  @GrpcMethod("Event", "GetEvent")
  async getEvent(data: GetEventRequest): Promise<EventMessage> {
    const event = await this.eventsService.findOne(data.event_id, data.requester_id);
    return toEventMessage(event);
  }

  @GrpcMethod("Event", "IngestViaApiKey")
  async ingestViaApiKey(data: IngestViaApiKeyRequest): Promise<EventMessage> {
    const event = await this.eventsService.ingestViaApiKey(data.tenant_id, {
      type: data.type,
      source: data.source || undefined,
      payload: data.payload_json ? JSON.parse(data.payload_json) : {},
    });
    return toEventMessage(event);
  }
}

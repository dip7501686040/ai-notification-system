import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc, hasMatchingRuleViaGrpc } from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import type { Prisma, Event } from "../../generated/prisma-client";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../env";
import type { CreateEventDto } from "./dto/create-event.dto";

const EVENT_SEARCHABLE_FIELDS = ["type", "source", "status"];
export const EVENTS_EXCHANGE = "platform";
export const EVENT_CREATED_ROUTING_KEY = "event.created";

@Injectable()
export class EventsService extends BaseCrudService<
  Event,
  Prisma.EventCreateInput,
  Prisma.EventUpdateInput,
  Prisma.EventWhereUniqueInput,
  Prisma.EventWhereInput,
  Prisma.EventOrderByWithRelationInput
> {
  private readonly logger = createLogger("event-service");

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    super(prisma.event);
  }

  async ingest(userId: string, dto: CreateEventDto): Promise<Event> {
    await this.assertMembership(dto.tenantId, userId);
    return this.ingestForTenant(dto.tenantId, dto);
  }

  // Used when api-gateway has already authenticated the caller via an API
  // key -- tenantId is the key's own (already-trusted) tenant, not a
  // requester to check membership for. No user identity exists on this
  // path at all.
  async ingestViaApiKey(tenantId: string, dto: Omit<CreateEventDto, "tenantId">): Promise<Event> {
    return this.ingestForTenant(tenantId, { ...dto, tenantId });
  }

  private async ingestForTenant(tenantId: string, dto: CreateEventDto): Promise<Event> {
    // Synchronous guard: reject the event outright if nothing in
    // rule-engine-service could ever fire on it, rather than accepting
    // it and silently producing zero notifications. Only checks
    // eventType (exact or wildcard "*"), not each rule's `conditions` --
    // that depends on the payload and would mean re-running the
    // in-memory evaluator on every ingest.
    const hasMatch = await hasMatchingRuleViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, tenantId, dto.type);
    if (!hasMatch) {
      throw new BadRequestException(
        `No enabled rule matches event type "${dto.type}" for this tenant. Create a rule for this event type (or a wildcard "*" rule) before sending it.`,
      );
    }

    const event = await super.create({
      tenantId,
      type: dto.type,
      source: dto.source,
      payload: dto.payload as Prisma.InputJsonValue,
      status: "received",
    });

    try {
      this.logger.info(
        {
          ...getTraceContext(),
          event_type: EVENT_CREATED_ROUTING_KEY,
          step: "publish",
          eventId: event.id,
          tenantId: event.tenantId,
        },
        "[event-service]: Publishing event.created",
      );
      // DEMO BREAKPOINT: before publishing event.created
      await this.rabbitmq.publish(EVENTS_EXCHANGE, EVENT_CREATED_ROUTING_KEY, {
        eventId: event.id,
        tenantId: event.tenantId,
        type: event.type,
        source: event.source,
        payload: dto.payload,
        createdAt: event.createdAt,
      });
      return await super.update({ id: event.id }, { status: "published" });
    } catch (error) {
      this.logger.error(
        { tenantId: event.tenantId, eventId: event.id, error },
        "Failed to publish event",
      );
      return super.update({ id: event.id }, { status: "failed" });
    }
  }

  async findAllForTenant(
    tenantId: string,
    userId: string,
    query: RawListQuery,
  ): Promise<Paginated<Event>> {
    await this.assertMembership(tenantId, userId);
    return this.list(query, { searchableFields: EVENT_SEARCHABLE_FIELDS }, { tenantId });
  }

  async findOne(eventId: string, userId: string): Promise<Event> {
    const event = await this.findUnique({ id: eventId });
    if (!event) {
      throw new NotFoundException("Event not found");
    }

    // 404 rather than 403 for a non-member: a Forbidden response would
    // confirm the event exists, leaking it to callers who aren't tenant
    // members (mirrors TenantsService.findOne's same reasoning).
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, event.tenantId, userId);
    if (!result.isMember) {
      throw new NotFoundException("Event not found");
    }

    return event;
  }

  private async assertMembership(tenantId: string, userId: string): Promise<void> {
    const result = await checkMembershipViaGrpc(env.TENANT_GRPC_ADDRESS, tenantId, userId);
    if (!result.isMember) {
      throw new ForbiddenException("Not a member of this tenant");
    }
  }
}

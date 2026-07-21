import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BaseCrudService, type Paginated, type RawListQuery } from "@ai-notification/common";
import { checkMembershipViaGrpc } from "@ai-notification/grpc";
import { RabbitMQService } from "@ai-notification/rabbitmq";
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
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {
    super(prisma.event);
  }

  async ingest(userId: string, dto: CreateEventDto): Promise<Event> {
    await this.assertMembership(dto.tenantId, userId);

    const event = await super.create({
      tenantId: dto.tenantId,
      type: dto.type,
      source: dto.source,
      payload: dto.payload as Prisma.InputJsonValue,
      status: "received",
    });

    try {
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
        `Failed to publish event ${event.id}: ${error instanceof Error ? error.message : error}`,
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

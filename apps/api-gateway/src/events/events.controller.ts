import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import {
  createEventViaGrpc,
  ingestEventViaApiKeyGrpc,
  listEventsViaGrpc,
  getEventViaGrpc,
} from "@ai-notification/grpc";
import { createLogger } from "@ai-notification/logger";
import { getTraceContext } from "@ai-notification/telemetry";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { EventIngestAuthGuard } from "../auth/event-ingest-auth.guard";
import { CreateEventDto } from "./dto/create-event.dto";

const EVENT_CREATED_TOPIC = "event.created";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

function apiKeyTenantId(req: Request): string | undefined {
  return (req as Request & { apiKeyTenantId?: string }).apiKeyTenantId;
}

// create() accepts either auth mode (see EventIngestAuthGuard); list()/
// findOne() stay JWT-only, so guards are per-method rather than one
// class-level @UseGuards().
@Controller("events")
export class EventsController {
  private readonly logger = createLogger("api-gateway");

  @UseGuards(EventIngestAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateEventDto) {
    const tenantId = apiKeyTenantId(req);
    if (tenantId) {
      // Never dto.tenantId here -- a key scoped to one tenant must not be
      // able to claim a different tenant by putting it in the body.
      return grpcCall(() => ingestEventViaApiKeyGrpc(env.EVENT_GRPC_ADDRESS, tenantId, dto));
    }
    this.logger.info(
      { ...getTraceContext(), event_type: EVENT_CREATED_TOPIC, step: "dispatch", type: dto.type },
      "[api-gateway]: Dispatching CreateEvent to event-service via gRPC",
    );
    // DEMO BREAKPOINT: before dispatching CreateEvent gRPC call to event-service
    return grpcCall(() => createEventViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, dto));
  }

  @UseGuards(GrpcAuthGuard)
  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listEventsViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @UseGuards(GrpcAuthGuard)
  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => getEventViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, id));
  }
}

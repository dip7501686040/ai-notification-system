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
import { createEventViaGrpc, listEventsViaGrpc, getEventViaGrpc } from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { CreateEventDto } from "./dto/create-event.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

@Controller("events")
@UseGuards(GrpcAuthGuard)
export class EventsController {
  @Post()
  create(@Req() req: Request, @Body() dto: CreateEventDto) {
    return grpcCall(() => createEventViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, dto));
  }

  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listEventsViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => getEventViaGrpc(env.EVENT_GRPC_ADDRESS, currentUser(req).id, id));
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import {
  listEventAnalysesViaGrpc,
  getEventAnalysisViaGrpc,
  getEventAnalysisByEventViaGrpc,
  getAiConfigViaGrpc,
  setAiConfigViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { SetAiConfigDto } from "./dto/set-ai-config.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// Read-only for analyses: lifecycle is managed entirely by ai-service's
// own consumer (see AI_GRPC_ADDRESS's proto), not by external callers.
// AI config is the one writable surface, gated to tenant owner/admin
// inside ai-service itself.
@Controller()
@UseGuards(GrpcAuthGuard)
export class AiController {
  @Get("ai-analyses")
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listEventAnalysesViaGrpc(env.AI_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @Get("ai-analyses/by-event/:eventId")
  findOneByEvent(@Req() req: Request, @Param("eventId") eventId: string) {
    return grpcCall(() =>
      getEventAnalysisByEventViaGrpc(env.AI_GRPC_ADDRESS, currentUser(req).id, eventId),
    );
  }

  @Get("ai-analyses/:id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => getEventAnalysisViaGrpc(env.AI_GRPC_ADDRESS, currentUser(req).id, id));
  }

  @Get("ai-config")
  getConfig(@Req() req: Request, @Query("tenantId") tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() => getAiConfigViaGrpc(env.AI_GRPC_ADDRESS, currentUser(req).id, tenantId));
  }

  @Put("ai-config")
  setConfig(@Req() req: Request, @Body() dto: SetAiConfigDto) {
    return grpcCall(() =>
      setAiConfigViaGrpc(
        env.AI_GRPC_ADDRESS,
        currentUser(req).id,
        dto.tenantId,
        dto.provider,
        dto.model,
      ),
    );
  }
}

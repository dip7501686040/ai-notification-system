import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { RawListQuery } from "@ai-notification/common";
import {
  createRuleViaGrpc,
  listRulesViaGrpc,
  getRuleViaGrpc,
  updateRuleViaGrpc,
  deleteRuleViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantRolesGuard } from "../auth/tenant-roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

@Controller("rules")
@UseGuards(GrpcAuthGuard, TenantRolesGuard)
export class RulesController {
  // Rules control automated dispatch -- administrative. Gateway checks
  // this as a fast-fail (tenantId is in the body, no fetch needed);
  // rule-engine-service's own RulesService re-checks it authoritatively.
  @Roles("owner", "admin")
  @Post()
  create(@Req() req: Request, @Body() dto: CreateRuleDto) {
    return grpcCall(() =>
      createRuleViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, currentUser(req).id, dto),
    );
  }

  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listRulesViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => getRuleViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, currentUser(req).id, id));
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateRuleDto) {
    return grpcCall(() =>
      updateRuleViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, currentUser(req).id, id, dto),
    );
  }

  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string) {
    await grpcCall(() => deleteRuleViaGrpc(env.RULE_ENGINE_GRPC_ADDRESS, currentUser(req).id, id));
    return { success: true };
  }
}

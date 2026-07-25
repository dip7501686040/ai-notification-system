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
  createTemplateViaGrpc,
  listTemplatesViaGrpc,
  getTemplateViaGrpc,
  updateTemplateViaGrpc,
  deleteTemplateViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantRolesGuard } from "../auth/tenant-roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

@Controller("templates")
@UseGuards(GrpcAuthGuard, TenantRolesGuard)
export class TemplatesController {
  // Templates control real notification content -- administrative.
  // Gateway fast-fail (tenantId is in the body); template-service's own
  // TemplatesService re-checks it authoritatively.
  @Roles("owner", "admin")
  @Post()
  create(@Req() req: Request, @Body() dto: CreateTemplateDto) {
    return grpcCall(() =>
      createTemplateViaGrpc(env.TEMPLATE_GRPC_ADDRESS, currentUser(req).id, dto),
    );
  }

  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listTemplatesViaGrpc(env.TEMPLATE_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @Get(":id")
  findOne(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => getTemplateViaGrpc(env.TEMPLATE_GRPC_ADDRESS, currentUser(req).id, id));
  }

  @Patch(":id")
  update(@Req() req: Request, @Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return grpcCall(() =>
      updateTemplateViaGrpc(env.TEMPLATE_GRPC_ADDRESS, currentUser(req).id, id, dto),
    );
  }

  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string) {
    await grpcCall(() => deleteTemplateViaGrpc(env.TEMPLATE_GRPC_ADDRESS, currentUser(req).id, id));
    return { success: true };
  }
}

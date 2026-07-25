import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  createApiKeyViaGrpc,
  listApiKeysViaGrpc,
  rotateApiKeyViaGrpc,
  revokeApiKeyViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "../auth/grpc-auth.guard";
import { TenantRolesGuard } from "../auth/tenant-roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

// FR-10: create/rotate/revoke are all owner/admin -- an API key is a
// credential, same sensitivity class as rule/template mutations and the
// audit log. create()/list() get the gateway fast-fail (tenantId is in
// the body/query); rotate()/revoke() are service-layer-only, same
// round-trip limitation as PATCH/DELETE /rules/:id.
@Controller("apikeys")
@UseGuards(GrpcAuthGuard, TenantRolesGuard)
export class ApiKeysController {
  @Roles("owner", "admin")
  @Post()
  create(@Req() req: Request, @Body() dto: CreateApiKeyDto) {
    return grpcCall(() =>
      createApiKeyViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, dto.tenantId, dto),
    );
  }

  @Roles("owner", "admin")
  @Get()
  list(@Req() req: Request, @Query() query: RawListQuery & { tenantId?: string }) {
    if (!query.tenantId) {
      throw new BadRequestException("tenantId query param is required");
    }
    return grpcCall(() =>
      listApiKeysViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, query.tenantId!, query),
    );
  }

  @Post(":id/rotate")
  rotate(@Req() req: Request, @Param("id") id: string) {
    return grpcCall(() => rotateApiKeyViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id));
  }

  @Delete(":id")
  async revoke(@Req() req: Request, @Param("id") id: string) {
    await grpcCall(() => revokeApiKeyViaGrpc(env.TENANT_GRPC_ADDRESS, currentUser(req).id, id));
    return { success: true };
  }
}

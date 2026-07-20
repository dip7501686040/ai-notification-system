import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { GrpcAuthGuard, type AuthenticatedUser } from "./grpc-auth.guard";

@Controller("protected")
export class ProtectedController {
  @Get("ping")
  @UseGuards(GrpcAuthGuard)
  ping(@Req() req: Request) {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    return { message: "pong", user };
  }
}

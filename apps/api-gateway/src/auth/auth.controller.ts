import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  registerViaGrpc,
  loginViaGrpc,
  getUserViaGrpc,
  forgotPasswordViaGrpc,
  resetPasswordViaGrpc,
} from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import { GrpcAuthGuard, type AuthenticatedUser } from "./grpc-auth.guard";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

function currentUser(req: Request): AuthenticatedUser {
  return (req as Request & { user: AuthenticatedUser }).user;
}

@Controller("auth")
export class AuthController {
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return grpcCall(() =>
      registerViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, dto.email, dto.password, dto.name),
    );
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return grpcCall(() => loginViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, dto.email, dto.password));
  }

  @Get("me")
  @UseGuards(GrpcAuthGuard)
  async me(@Req() req: Request) {
    const { user } = await grpcCall(() =>
      getUserViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, currentUser(req).id),
    );
    return user;
  }

  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await grpcCall(() => forgotPasswordViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, dto.email));
    return { success: true };
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await grpcCall(() =>
      resetPasswordViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, dto.token, dto.newPassword),
    );
    return { success: true };
  }
}

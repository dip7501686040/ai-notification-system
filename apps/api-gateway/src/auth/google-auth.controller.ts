import { Controller, Get, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { validateOAuthUserViaGrpc } from "@ai-notification/grpc";
import { grpcCall } from "../grpc-call";
import { env } from "../env";
import type { GoogleOAuthUser } from "./strategies/google.strategy";

@Controller("auth/google")
export class GoogleAuthController {
  @Get()
  @UseGuards(AuthGuard("google"))
  login(): void {
    // passport redirects to Google's consent screen; nothing to do here.
  }

  @Get("callback")
  @UseGuards(AuthGuard("google"))
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleOAuthUser;
    const result = await grpcCall(() =>
      validateOAuthUserViaGrpc(env.IDENTITY_AUTH_GRPC_ADDRESS, profile),
    );
    res.json(result);
  }
}

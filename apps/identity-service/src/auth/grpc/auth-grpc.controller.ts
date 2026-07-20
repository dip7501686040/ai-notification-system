import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { JwtService } from "@nestjs/jwt";
import { AuthService, type AuthTokenPayload } from "../auth.service";

interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  error: string;
}

@Controller()
export class AuthGrpcController {
  constructor(
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
  ) {}

  @GrpcMethod("Auth", "ValidateToken")
  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const payload = this.jwt.verify<AuthTokenPayload>(data.token);
      const user = await this.authService.findById(payload.sub);
      if (!user) {
        return { valid: false, user_id: "", email: "", error: "User not found" };
      }

      return { valid: true, user_id: user.id, email: user.email, error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid token";
      return { valid: false, user_id: "", email: "", error: message };
    }
  }
}

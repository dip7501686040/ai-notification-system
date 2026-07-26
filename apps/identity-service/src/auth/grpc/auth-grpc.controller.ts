import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { JwtService } from "@nestjs/jwt";
import {
  AuthService,
  type AuthResult,
  type AuthTokenPayload,
  type SafeUser,
} from "../auth.service";

interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  is_super_admin: boolean;
  error: string;
}

interface UserMessage {
  id: string;
  email: string;
  name: string;
  provider: string;
  is_super_admin: boolean;
}

interface AuthResultMessage {
  user: UserMessage;
  access_token: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface GetUserRequest {
  user_id: string;
}

interface GetUserResponse {
  found: boolean;
  user: UserMessage | null;
}

interface ValidateOAuthUserRequest {
  email: string;
  name: string;
  provider: string;
  provider_id: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

function toUserMessage(user: SafeUser): UserMessage {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    provider: user.provider,
    is_super_admin: user.isSuperAdmin,
  };
}

function toAuthResultMessage(result: AuthResult): AuthResultMessage {
  return { user: toUserMessage(result.user), access_token: result.accessToken };
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
        return {
          valid: false,
          user_id: "",
          email: "",
          is_super_admin: false,
          error: "User not found",
        };
      }

      return {
        valid: true,
        user_id: user.id,
        email: user.email,
        is_super_admin: user.isSuperAdmin,
        error: "",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid token";
      return { valid: false, user_id: "", email: "", is_super_admin: false, error: message };
    }
  }

  @GrpcMethod("Auth", "Register")
  async register(data: RegisterRequest): Promise<AuthResultMessage> {
    const result = await this.authService.register(
      data.email,
      data.password,
      data.name || undefined,
    );
    return toAuthResultMessage(result);
  }

  @GrpcMethod("Auth", "Login")
  async login(data: LoginRequest): Promise<AuthResultMessage> {
    const result = await this.authService.login(data.email, data.password);
    return toAuthResultMessage(result);
  }

  @GrpcMethod("Auth", "GetUser")
  async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    const user = await this.authService.findById(data.user_id);
    return { found: Boolean(user), user: user ? toUserMessage(user) : null };
  }

  @GrpcMethod("Auth", "ValidateOAuthUser")
  async validateOAuthUser(data: ValidateOAuthUserRequest): Promise<AuthResultMessage> {
    const result = await this.authService.validateOAuthUser({
      email: data.email,
      name: data.name || undefined,
      provider: data.provider,
      providerId: data.provider_id,
    });
    return toAuthResultMessage(result);
  }

  @GrpcMethod("Auth", "ForgotPassword")
  async forgotPassword(data: ForgotPasswordRequest): Promise<{ success: boolean }> {
    await this.authService.forgotPassword(data.email);
    return { success: true };
  }

  @GrpcMethod("Auth", "ResetPassword")
  async resetPassword(data: ResetPasswordRequest): Promise<{ success: boolean }> {
    await this.authService.resetPassword(data.token, data.new_password);
    return { success: true };
  }
}

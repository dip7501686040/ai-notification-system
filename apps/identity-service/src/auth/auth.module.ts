import { Module, type Type } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { GoogleAuthController } from "./google-auth.controller";
import { AuthGrpcController } from "./grpc/auth-grpc.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { env, isGoogleOAuthConfigured } from "../env";

const controllers: Type<unknown>[] = [AuthController, AuthGrpcController];
const providers: Type<unknown>[] = [AuthService, JwtStrategy];

if (isGoogleOAuthConfigured) {
  controllers.push(GoogleAuthController);
  providers.push(GoogleStrategy);
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN },
    }),
  ],
  controllers,
  providers,
  exports: [AuthService],
})
export class AuthModule {}

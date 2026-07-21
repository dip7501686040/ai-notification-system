import { Module, type Type } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { GrpcHealthController } from "@ai-notification/grpc";
import { HealthController } from "./health/health.controller";
import { ServiceHealthController } from "./health/service-health.controller";
import { ProtectedController } from "./auth/protected.controller";
import { AuthController } from "./auth/auth.controller";
import { GoogleAuthController } from "./auth/google-auth.controller";
import { GoogleStrategy } from "./auth/strategies/google.strategy";
import { TenantsController } from "./tenants/tenants.controller";
import { EventsController } from "./events/events.controller";
import { RulesController } from "./rules/rules.controller";
import { isGoogleOAuthConfigured } from "./env";

const controllers: Type<unknown>[] = [
  HealthController,
  GrpcHealthController,
  ServiceHealthController,
  ProtectedController,
  AuthController,
  TenantsController,
  EventsController,
  RulesController,
];
const providers: Type<unknown>[] = [];

if (isGoogleOAuthConfigured) {
  controllers.push(GoogleAuthController);
  providers.push(GoogleStrategy);
}

@Module({
  imports: [PassportModule],
  controllers,
  providers,
})
export class AppModule {}

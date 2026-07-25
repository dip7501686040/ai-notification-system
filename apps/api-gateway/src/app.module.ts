import { Module, type Type } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { GrpcHealthController } from "@ai-notification/grpc";
import { RabbitMQModule } from "@ai-notification/rabbitmq";
import { HealthController } from "./health/health.controller";
import { ServiceHealthController } from "./health/service-health.controller";
import { ProtectedController } from "./auth/protected.controller";
import { AuthController } from "./auth/auth.controller";
import { GoogleAuthController } from "./auth/google-auth.controller";
import { GoogleStrategy } from "./auth/strategies/google.strategy";
import { TenantsController } from "./tenants/tenants.controller";
import { EventsController } from "./events/events.controller";
import { RulesController } from "./rules/rules.controller";
import { TemplatesController } from "./templates/templates.controller";
import { NotificationsController } from "./notifications/notifications.controller";
import { AnalyticsController } from "./analytics/analytics.controller";
import { AuditController } from "./audit/audit.controller";
import { ApiKeysController } from "./api-keys/api-keys.controller";
import { NotificationsGateway } from "./notifications/notifications.gateway";
import { NotificationPushConsumerService } from "./notifications/notification-push-consumer.service";
import { AiController } from "./ai/ai.controller";
import { GrpcAuthGuard } from "./auth/grpc-auth.guard";
import { ApiKeyRateLimiterService } from "./auth/api-key-rate-limiter.service";
import { env, isGoogleOAuthConfigured } from "./env";

const controllers: Type<unknown>[] = [
  HealthController,
  GrpcHealthController,
  ServiceHealthController,
  ProtectedController,
  AuthController,
  TenantsController,
  EventsController,
  RulesController,
  TemplatesController,
  NotificationsController,
  AiController,
  AnalyticsController,
  AuditController,
  ApiKeysController,
];
const providers: Type<unknown>[] = [
  NotificationsGateway,
  NotificationPushConsumerService,
  GrpcAuthGuard,
  ApiKeyRateLimiterService,
];

if (isGoogleOAuthConfigured) {
  controllers.push(GoogleAuthController);
  providers.push(GoogleStrategy);
}

@Module({
  imports: [PassportModule, RabbitMQModule.forRoot({ url: env.RABBITMQ_URL })],
  controllers,
  providers,
})
export class AppModule {}

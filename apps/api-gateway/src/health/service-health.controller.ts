import { Controller, Get } from "@nestjs/common";
import { checkGrpcHealth, type HealthCheckResult } from "@ai-notification/grpc";

const DOWNSTREAM_SERVICES: Array<{ name: string; address: string }> = [
  { name: "identity-service", address: "identity-service:50052" },
  { name: "tenant-service", address: "tenant-service:50053" },
  { name: "event-service", address: "event-service:50054" },
  { name: "ai-service", address: "ai-service:50055" },
  { name: "rule-engine-service", address: "rule-engine-service:50056" },
  { name: "notification-service", address: "notification-service:50057" },
  { name: "channel-service", address: "channel-service:50058" },
  { name: "template-service", address: "template-service:50059" },
  { name: "analytics-service", address: "analytics-service:50060" },
  { name: "audit-service", address: "audit-service:50061" },
  { name: "prediction-service", address: "prediction-service:50062" },
];

@Controller("internal")
export class ServiceHealthController {
  @Get("service-health")
  async checkAll(): Promise<{ checkedAt: string; services: HealthCheckResult[] }> {
    const services = await Promise.all(
      DOWNSTREAM_SERVICES.map(({ name, address }) => checkGrpcHealth(name, address)),
    );

    return { checkedAt: new Date().toISOString(), services };
  }
}

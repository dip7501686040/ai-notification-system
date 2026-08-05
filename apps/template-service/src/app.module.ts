import { Module } from "@nestjs/common";
import { GrpcHealthController } from "@ai-notification/grpc";
import { PrismaModule } from "./prisma/prisma.module";
import { TemplatesModule } from "./templates/templates.module";

@Module({
  imports: [PrismaModule, TemplatesModule],
  controllers: [GrpcHealthController],
})
export class AppModule {}

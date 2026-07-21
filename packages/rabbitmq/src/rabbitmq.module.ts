import { Module, type DynamicModule } from "@nestjs/common";
import { RabbitMQService, RABBITMQ_OPTIONS, type RabbitMQModuleOptions } from "./rabbitmq.service";

@Module({})
export class RabbitMQModule {
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      global: true,
      providers: [{ provide: RABBITMQ_OPTIONS, useValue: options }, RabbitMQService],
      exports: [RabbitMQService],
    };
  }
}

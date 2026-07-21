import { Module } from "@nestjs/common";
import { RulesService } from "./rules.service";
import { RuleGrpcController } from "./grpc/rule-grpc.controller";
import { RuleConsumerService } from "./rule-consumer.service";

@Module({
  controllers: [RuleGrpcController],
  providers: [RulesService, RuleConsumerService],
  exports: [RulesService],
})
export class RulesModule {}

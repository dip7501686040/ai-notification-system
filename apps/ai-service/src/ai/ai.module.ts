import { Module } from "@nestjs/common";
import { AiAnalysisService } from "./ai-analysis.service";
import { AiConfigService } from "./ai-config.service";
import { AiConsumerService } from "./ai-consumer.service";
import { AiGrpcController } from "./grpc/ai-grpc.controller";
import { LangchainProvider } from "./providers/langchain-provider.service";
import { EmbeddingsService } from "./rag/embeddings.service";
import { SimilarEventRetrieverService } from "./rag/similar-event-retriever.service";

@Module({
  controllers: [AiGrpcController],
  providers: [
    AiAnalysisService,
    AiConfigService,
    AiConsumerService,
    LangchainProvider,
    EmbeddingsService,
    SimilarEventRetrieverService,
  ],
  exports: [AiAnalysisService, AiConfigService],
})
export class AiModule {}

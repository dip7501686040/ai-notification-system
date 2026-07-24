import { Injectable } from "@nestjs/common";
import { OllamaEmbeddings } from "@langchain/ollama";
import { env } from "../../env";

// Embeddings always run locally via Ollama, independent of which provider
// (Anthropic/OpenAI/Ollama) is doing the actual event analysis -- this
// keeps RAG retrieval working even when the tenant's chosen analysis
// provider is rate-limited, unconfigured, or costs money per call.
@Injectable()
export class EmbeddingsService {
  private readonly embeddings = new OllamaEmbeddings({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.EMBEDDING_MODEL,
  });

  embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}

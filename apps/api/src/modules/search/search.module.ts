import { Module } from '@nestjs/common';
import { SearchService } from './application/search.service';
import { OnProductCreatedIndexHandler } from './application/event-handlers/on-product-indexed.handler';
import { SearchController } from './infrastructure/controllers/search.controller';
import { OpenAiEmbeddingAdapter } from './infrastructure/openai/openai-embedding.adapter';
import { QdrantAdapter } from './infrastructure/qdrant/qdrant.adapter';
import { EMBEDDING_PORT } from './domain/ports/embedding.port';
import { VECTOR_STORE_PORT } from './domain/ports/vector-store.port';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    OnProductCreatedIndexHandler,
    { provide: EMBEDDING_PORT, useClass: OpenAiEmbeddingAdapter },
    { provide: VECTOR_STORE_PORT, useClass: QdrantAdapter },
  ],
  exports: [SearchService],
})
export class SearchModule {}

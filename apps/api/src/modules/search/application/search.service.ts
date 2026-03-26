import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { EMBEDDING_PORT } from '../domain/ports/embedding.port';
import type { EmbeddingPort } from '../domain/ports/embedding.port';
import { VECTOR_STORE_PORT } from '../domain/ports/vector-store.port';
import type { VectorStorePort } from '../domain/ports/vector-store.port';
import type { SearchQueryDto, SearchResponse, SearchResultItem } from './dto/search.dto';

const COLLECTION_NAME = 'dorify_products';
const SCORE_THRESHOLD = 0.5;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(EMBEDDING_PORT) private readonly embedding: EmbeddingPort,
    @Inject(VECTOR_STORE_PORT) private readonly vectorStore: VectorStorePort,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.vectorStore.ensureCollection(COLLECTION_NAME, this.embedding.getDimensions());
      this.logger.log(`Qdrant collection "${COLLECTION_NAME}" ready`);
    } catch (error) {
      this.logger.warn(`Failed to ensure Qdrant collection: ${error}`);
    }
  }

  async indexProduct(product: {
    id: string;
    name: string;
    description?: string;
    activeSubstance?: string;
    manufacturer?: string;
    category?: string;
    price: number;
    pharmacyId: string;
    imageUrl?: string;
  }): Promise<void> {
    const text = [
      product.name,
      product.description,
      product.activeSubstance,
      product.manufacturer,
      product.category,
    ].filter(Boolean).join('. ');

    try {
      const vector = await this.embedding.embed(text);

      await this.vectorStore.upsert(COLLECTION_NAME, [{
        id: product.id,
        vector,
        payload: {
          name: product.name,
          description: product.description ?? '',
          manufacturer: product.manufacturer ?? '',
          category: product.category ?? '',
          price: product.price,
          pharmacyId: product.pharmacyId,
          imageUrl: product.imageUrl ?? '',
        },
      }]);

      this.logger.log(`Indexed product: ${product.name}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}: ${error}`);
    }
  }

  async removeProduct(productId: string): Promise<void> {
    try {
      await this.vectorStore.delete(COLLECTION_NAME, [productId]);
    } catch (error) {
      this.logger.error(`Failed to remove product ${productId} from index: ${error}`);
    }
  }

  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const vector = await this.embedding.embed(dto.q);

    // Build Qdrant filter
    const filter: Record<string, unknown> = {};
    const must: Array<Record<string, unknown>> = [];

    if (dto.pharmacyId) {
      must.push({ key: 'pharmacyId', match: { value: dto.pharmacyId } });
    }
    if (dto.category) {
      must.push({ key: 'category', match: { value: dto.category } });
    }
    if (must.length > 0) {
      filter.must = must;
    }

    const results = await this.vectorStore.search(COLLECTION_NAME, {
      vector,
      limit: dto.limit,
      filter: must.length > 0 ? filter : undefined,
      scoreThreshold: SCORE_THRESHOLD,
    });

    const items: SearchResultItem[] = results.map((r) => ({
      id: r.id,
      name: r.payload.name as string,
      description: r.payload.description as string || undefined,
      manufacturer: r.payload.manufacturer as string || undefined,
      category: r.payload.category as string || undefined,
      price: r.payload.price as number,
      pharmacyId: r.payload.pharmacyId as string,
      imageUrl: r.payload.imageUrl as string || undefined,
      score: r.score,
    }));

    return {
      query: dto.q,
      results: items,
      total: items.length,
    };
  }
}

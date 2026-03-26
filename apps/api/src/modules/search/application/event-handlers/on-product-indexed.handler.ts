import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SearchService } from '../search.service';
import type { ProductCreatedEvent } from '../../../catalog/domain/events/index';

@Injectable()
export class OnProductCreatedIndexHandler {
  private readonly logger = new Logger(OnProductCreatedIndexHandler.name);

  constructor(private readonly searchService: SearchService) {}

  @OnEvent('product.created')
  async handle(event: ProductCreatedEvent): Promise<void> {
    this.logger.log(`Indexing product ${event.payload.productId} for search`);

    await this.searchService.indexProduct({
      id: event.payload.productId,
      name: event.payload.name,
      pharmacyId: event.payload.pharmacyId,
      price: 0, // Will be re-indexed with full data on publish
    });
  }
}

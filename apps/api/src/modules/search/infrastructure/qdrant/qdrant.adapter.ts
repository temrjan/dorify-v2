import { Injectable, Logger } from '@nestjs/common';
import type { VectorStorePort, VectorPoint, VectorSearchResult, VectorSearchParams } from '../../domain/ports/vector-store.port';

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';

@Injectable()
export class QdrantAdapter implements VectorStorePort {
  private readonly logger = new Logger(QdrantAdapter.name);

  async ensureCollection(collectionName: string, dimensions: number): Promise<void> {
    // Check if exists
    const check = await fetch(`${QDRANT_URL}/collections/${collectionName}`);
    if (check.ok) return;

    // Create
    const response = await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: dimensions,
          distance: 'Cosine',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to create Qdrant collection: ${body}`);
    }

    this.logger.log(`Created Qdrant collection: ${collectionName} (${dimensions}d)`);
  }

  async upsert(collectionName: string, points: VectorPoint[]): Promise<void> {
    const response = await fetch(`${QDRANT_URL}/collections/${collectionName}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Qdrant upsert error: ${body}`);
      throw new Error(`Qdrant upsert failed: ${response.status}`);
    }
  }

  async search(collectionName: string, params: VectorSearchParams): Promise<VectorSearchResult[]> {
    const body: Record<string, unknown> = {
      vector: params.vector,
      limit: params.limit,
      with_payload: true,
    };

    if (params.scoreThreshold) {
      body.score_threshold = params.scoreThreshold;
    }

    if (params.filter) {
      body.filter = params.filter;
    }

    const response = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respBody = await response.text();
      this.logger.error(`Qdrant search error: ${respBody}`);
      throw new Error(`Qdrant search failed: ${response.status}`);
    }

    const data = await response.json() as {
      result: Array<{ id: string; score: number; payload: Record<string, unknown> }>;
    };

    return data.result.map((r) => ({
      id: typeof r.id === 'string' ? r.id : String(r.id),
      score: r.score,
      payload: r.payload,
    }));
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    const response = await fetch(`${QDRANT_URL}/collections/${collectionName}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: ids }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Qdrant delete error: ${body}`);
    }
  }
}

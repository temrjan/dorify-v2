export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface VectorSearchParams {
  vector: number[];
  limit: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}

export interface VectorStorePort {
  upsert(collectionName: string, points: VectorPoint[]): Promise<void>;
  search(collectionName: string, params: VectorSearchParams): Promise<VectorSearchResult[]>;
  delete(collectionName: string, ids: string[]): Promise<void>;
  ensureCollection(collectionName: string, dimensions: number): Promise<void>;
}

export const VECTOR_STORE_PORT = Symbol('VECTOR_STORE_PORT');

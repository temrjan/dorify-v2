export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

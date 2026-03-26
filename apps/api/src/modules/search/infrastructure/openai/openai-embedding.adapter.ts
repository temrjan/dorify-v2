import { Injectable, Logger } from '@nestjs/common';
import type { EmbeddingPort } from '../../domain/ports/embedding.port';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

@Injectable()
export class OpenAiEmbeddingAdapter implements EmbeddingPort {
  private readonly logger = new Logger(OpenAiEmbeddingAdapter.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — embeddings will fail');
    }
  }

  getDimensions(): number {
    return DIMENSIONS;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: texts,
        dimensions: DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`OpenAI embedding error: ${response.status} ${body}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

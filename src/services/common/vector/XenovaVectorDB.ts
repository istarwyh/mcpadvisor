import { pipeline, env } from '@xenova/transformers';

// Configure transformers environment to avoid native module issues
try {
  // @ts-ignore - Disable sharp by preventing image processor usage
  if (typeof window === 'undefined') {
    // In Node.js environment, disable features that require native modules
    env.allowLocalModels = false;
    env.useFS = false;
    env.useBrowserCache = false;
  }
} catch (e) {
  // Ignore errors during initial setup
}
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../utils/logger.js';

type Metadata = {
  id: string;
  text: string;
  [key: string]: any;
};

type SearchResult = {
  text: string;
  metadata: Metadata;
  distance: number;
};

export class MemoryVectorDB {
  private documents: string[] = [];
  public metadatas: Metadata[] = [];
  private embeddings: number[][] = [];
  private embedder: any;
  private numDimensions: number;
  private isEmbedderReady: boolean = false;

  constructor({ numDimensions = 384, clearOnStart = true } = {}) {
    this.numDimensions = numDimensions;
    this.initializeEmbedder();
  }

  private async initializeEmbedder() {
    try {
      // @ts-ignore - Set mirror for users in China
      env.remoteHost = 'https://hf-mirror.com';
      // @ts-ignore - Disable node backend and image processing to avoid native module issues
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.wasmPaths =
        'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
      // @ts-ignore - Disable image processing to avoid sharp dependency
      env.useFS = false;
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );
      this.isEmbedderReady = true;
      logger.info('Vector embedder initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector embedder:', error);
      throw error;
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.isEmbedderReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getEmbedding(text);
    }
    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true,
      });
      return Array.from(output.data);
    } catch (error) {
      logger.error('Error generating embedding:', { error, text });
      throw error;
    }
  }

  public async add(
    text: string,
    metadata: Omit<Metadata, 'text'> = { id: uuidv4() },
  ) {
    const embedding = await this.getEmbedding(text);
    this.documents.push(text);
    this.metadatas.push({ id: uuidv4(), ...metadata, text });
    this.embeddings.push(embedding);
  }

  public async search(query: string, k: number = 5): Promise<SearchResult[]> {
    if (this.documents.length === 0) return [];

    const queryEmbedding = await this.getEmbedding(query);
    const results: SearchResult[] = [];

    for (let i = 0; i < this.documents.length; i++) {
      const dist = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
      results.push({
        text: this.documents[i],
        metadata: this.metadatas[i],
        distance: dist,
      });
    }

    // Sort by distance (higher is better for cosine similarity)
    return results.sort((a, b) => b.distance - a.distance).slice(0, k);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public getCount(): number {
    return this.documents.length;
  }

  public save() {
    // In-memory implementation doesn't need to save to disk
    logger.debug('Vector database state saved (in-memory)');
  }

  public clear() {
    this.documents = [];
    this.metadatas = [];
    this.embeddings = [];
    logger.info('Vector database cleared');
  }
}

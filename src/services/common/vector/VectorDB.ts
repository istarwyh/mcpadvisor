import { MemoryVectorDB } from './XenovaVectorDB.js';
import logger from '../../../utils/logger.js';

export class VectorDB {
  private db: MemoryVectorDB;
  public _collectionId: string;

  constructor() {
    this._collectionId = `nacos_mcp_router-collection-${process.pid}`;
    this.db = new MemoryVectorDB({ numDimensions: 384, clearOnStart: true });
    logger.info(
      `VectorDB initialized with collection ID: ${this._collectionId}`,
    );
  }

  public async start() {
    // MemoryVectorDB initialization is done in constructor
    logger.debug('VectorDB start called');
    return Promise.resolve();
  }

  public async isReady(): Promise<boolean> {
    // MemoryVectorDB is always ready
    return Promise.resolve(true);
  }

  async getCollectionCount(): Promise<number> {
    return this.db.getCount();
  }

  updateData(
    ids: string[],
    documents?: string[],
    metadatas?: Record<string, any>[],
  ): void {
    if (!documents) return;

    documents.forEach((doc, i) => {
      this.db.add(doc, { id: ids[i], ...(metadatas ? metadatas[i] : {}) });
    });

    this.db.save();
    logger.debug(`Updated vector database with ${documents.length} documents`);
  }

  async query(query: string, count: number): Promise<any> {
    logger.debug(`Querying vector database: ${query.substring(0, 50)}...`);
    const results = await this.db.search(query, count);

    const response = {
      ids: [results.map((r: any) => r.metadata.id)],
      documents: [results.map((r: any) => r.text)],
      metadatas: [results.map((r: any) => r.metadata)],
      distances: [results.map((r: any) => r.distance)],
      included: [],
    };

    logger.debug(`Found ${results.length} results for query`);
    return response;
  }

  async get(ids: string[]): Promise<any> {
    const all = this.db['metadatas'] || [];
    const found = all.filter((m: any) => ids.includes(m.id));

    const response = {
      ids,
      documents: found.map((m: any) => m.text),
      metadatas: found,
      included: [],
    };

    logger.debug(`Retrieved ${found.length} documents by ID`);
    return response;
  }

  async clear(): Promise<void> {
    this.db.clear();
    logger.info('Vector database cleared');
  }
}

export default VectorDB;

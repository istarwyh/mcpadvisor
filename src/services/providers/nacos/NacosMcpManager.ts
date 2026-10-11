import { setInterval, clearInterval } from 'node:timers';
import { NacosClient } from './NacosClient.js';
import { VectorDB } from '../../common/vector/VectorDB.js';
import logger from '../../../utils/logger.js';

export class McpManager {
  private nacosClient: NacosClient;
  private vectorDB: VectorDB;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncIntervalMs: number;

  constructor(
    nacosClient: NacosClient,
    vectorDB: VectorDB,
    syncIntervalMs: number = 5000,
  ) {
    this.nacosClient = nacosClient;
    this.vectorDB = vectorDB;
    this.syncIntervalMs = syncIntervalMs;
    logger.info('McpManager initialized');
  }

  async startSync() {
    logger.info('Starting MCP sync service');
    await this.syncNacosServices();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.syncNacosServices().catch(err => {
        logger.error('Error during periodic sync:', err);
      });
    }, this.syncIntervalMs);
  }

  async stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Stopped MCP sync service');
    }
  }

  private async syncNacosServices() {
    try {
      logger.debug('Syncing Nacos services to vector database');

      // Get all services from Nacos
      const services = await this.nacosClient.getAllServices();

      // Convert services to vector database format
      const ids: string[] = [];
      const documents: string[] = [];
      const metadatas: any[] = [];

      for (const service of services) {
        const serviceDetail = await this.nacosClient.getServiceDetail(
          service.name,
          service.groupName,
        );
        const docText = this.createDocumentText(serviceDetail);

        ids.push(
          serviceDetail.metadata?.id || `${service.name}-${service.groupName}`,
        );
        documents.push(docText);
        metadatas.push({
          ...serviceDetail.metadata,
          serviceName: service.name,
          groupName: service.groupName,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Update vector database
      this.vectorDB.updateData(ids, documents, metadatas);
      logger.info(`Synced ${services.length} services to vector database`);

      return services.length;
    } catch (error) {
      logger.error('Failed to sync Nacos services:', error);
      throw error;
    }
  }

  private createDocumentText(serviceDetail: any): string {
    // Create a text representation of the service for vector search
    const { serviceName, groupName, metadata = {} } = serviceDetail;
    const { description = '', tags = [], version = '1.0.0' } = metadata;

    return [
      `Service: ${serviceName}`,
      `Group: ${groupName}`,
      `Version: ${version}`,
      `Description: ${description}`,
      `Tags: ${tags.join(', ')}`,
      `Last Updated: ${new Date().toISOString()}`,
    ].join('\n');
  }

  async search(query: string, limit: number = 5) {
    try {
      logger.debug(`Searching for: ${query}`);
      const results = await this.vectorDB.query(query, limit);
      return results.metadatas[0] || [];
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  async getService(serviceName: string, groupName: string) {
    try {
      return await this.nacosClient.getServiceDetail(serviceName, groupName);
    } catch (error) {
      logger.error(
        `Failed to get service ${groupName}@@${serviceName}:`,
        error,
      );
      throw error;
    }
  }
}

export default McpManager;

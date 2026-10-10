import { URL } from 'node:url';
import type {
  MCPServerResponse,
  SearchProvider,
} from '../../../types/index.js';
import type { SearchParams } from '../../../types/search.js';
import { MemoryCache } from '../../common/cache/memoryCache.js';

const MARKETPLACE_URL = 'https://api.cline.bot/v1/mcp/marketplace';

export interface ClineSearchProviderConfig {
  /** Maximum time for both response headers and body (default: 10 seconds). */
  timeoutMs?: number;
  /** In-memory catalog lifetime (default: 5 minutes). */
  cacheTtlMs?: number;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapEntry(value: unknown): MCPServerResponse | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  const title = text(entry.name);
  let sourceUrl: string;
  try {
    const url = new URL(text(entry.githubUrl));
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/[^/]+\/[^/]+(?:\/.*)?$/.test(url.pathname)
    ) {
      return null;
    }
    sourceUrl = `https://github.com${url.pathname.replace(/\/$/, '').replace(/\.git$/, '')}`;
  } catch {
    return null;
  }
  if (!title) return null;
  return {
    id: text(entry.mcpId) || sourceUrl,
    title,
    description: text(entry.description),
    sourceUrl,
    categories: text(entry.category) ? [text(entry.category)] : [],
    tags: Array.isArray(entry.tags) ? entry.tags.map(text).filter(Boolean) : [],
    similarity: 0,
  };
}

/** Read-only, opt-in search of the public Cline catalog. No installation or model downloads. */
export class ClineSearchProvider implements SearchProvider {
  private readonly cache: MemoryCache<MCPServerResponse[]>;
  private readonly timeoutMs: number;
  private loading?: Promise<MCPServerResponse[]>;

  constructor(config: ClineSearchProviderConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? 10_000;
    const ttl = config.cacheTtlMs ?? 300_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error('Cline timeoutMs must be a positive finite number');
    }
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new Error('Cline cacheTtlMs must be a non-negative finite number');
    }
    this.cache = new MemoryCache(ttl);
  }

  async search(params: SearchParams): Promise<MCPServerResponse[]> {
    const terms = [
      ...new Set(
        [
          params.taskDescription,
          ...(params.keywords ?? []),
          ...(params.capabilities ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .split(/[\s,.;:!?()[\]{}/_-]+/)
          .filter(Boolean),
      ),
    ];
    if (!terms.length) return [];
    const catalog = await this.loadCatalog();
    return catalog
      .map(entry => {
        const searchable = [
          entry.title,
          entry.description,
          ...(entry.categories ?? []),
          ...(entry.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();
        const similarity =
          terms.filter(term => searchable.includes(term)).length / terms.length;
        // Clone arrays as well: callers must not mutate the cached catalog.
        return {
          ...entry,
          categories: [...(entry.categories ?? [])],
          tags: [...(entry.tags ?? [])],
          similarity,
        };
      })
      .filter(entry => entry.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity);
  }

  private async loadCatalog(): Promise<MCPServerResponse[]> {
    const cached = this.cache.get();
    if (cached) return cached;
    if (!this.loading) {
      this.loading = this.fetchCatalog().finally(() => {
        this.loading = undefined;
      });
    }
    return this.loading;
  }

  private async fetchCatalog(): Promise<MCPServerResponse[]> {
    const controller = new globalThis.AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(MARKETPLACE_URL, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          `Cline marketplace request failed with status ${response.status}`,
        );
      const data: unknown = await response.json();
      if (!Array.isArray(data))
        throw new Error('Cline marketplace response must be an array');
      const catalog = data
        .map(mapEntry)
        .filter((entry): entry is MCPServerResponse => entry !== null);
      // A changed schema must not silently poison the cache for its entire TTL.
      if (data.length && !catalog.length)
        throw new Error('Cline marketplace contains no valid entries');
      this.cache.set(catalog);
      return catalog;
    } finally {
      clearTimeout(timer);
    }
  }
}

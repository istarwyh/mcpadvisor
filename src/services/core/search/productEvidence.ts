import type { MCPServerResponse } from '../../../types/index.js';
import type { ProviderResult, SearchParams } from '../../../types/search.js';
import { extractSpecificProduct } from './meilisearchQuery.js';

const normalize = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function mention(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\p{Script=Latin}\\p{N}])${escaped}(?=$|[^\\p{Script=Latin}\\p{N}])`,
    'u',
  ).test(text);
}

function hasEvidence(server: MCPServerResponse, product: string): boolean {
  // Check each metadata field independently; a URL alone is not evidence.
  return [
    server.id,
    server.title,
    server.description,
    server.categories,
    server.tags,
  ]
    .flat()
    .filter((value): value is string => typeof value === 'string')
    .some(value => mention(normalize(value), product));
}

/**
 * Keep explicit product-specific requests from becoming unrelated fallback hits.
 * This is a bounded metadata-evidence gate, not an intent parser or a claim that
 * mentioning a product proves a dedicated integration. Unqualified queries,
 * exclusions and multi-product logic retain existing behavior.
 */
export function filterSpecificProductResults(
  params: SearchParams,
  groups: ProviderResult[],
): ProviderResult[] {
  const product = extractSpecificProduct(params.taskDescription);
  if (!product) return groups;
  return groups.map(group => ({
    ...group,
    results: group.results.filter(server => hasEvidence(server, product)),
  }));
}

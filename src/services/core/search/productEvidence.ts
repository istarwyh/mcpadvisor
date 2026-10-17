import type { MCPServerResponse } from '../../../types/index.js';
import type { ProviderResult, SearchParams } from '../../../types/search.js';
import { isGenericSpecificModifier } from './meilisearchQuery.js';

// Deliberately grammatical words, not the broader generic product vocabulary.
const LEFT_BOUNDARY_WORDS = new Set(
  'a an need want find recommend use using for with require requires connect'.split(
    ' ',
  ),
);

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
 * exclusions, multiword names and multi-product logic retain existing behavior.
 */
export function filterSpecificProductResults(
  params: SearchParams,
  groups: ProviderResult[],
): ProviderResult[] {
  const description = params.taskDescription.normalize('NFKC');
  // Do not reinterpret negative or alternative requirements as mandatory ones.
  if (
    /\b(?:not|no|without|except|exclude|excluding|rather than|instead of|or)\b|不|排除/iu.test(
      description,
    )
  )
    return groups;
  const qualifiers = [
    ...description.matchAll(
      /(?<![\p{Script=Latin}\p{N}])([\p{Script=Latin}][\p{Script=Latin}\p{N}._-]*)-specific\b/giu,
    ),
  ];
  // An unsupported qualifier must not disappear and turn a multi-product query
  // into a single-product requirement. Validate all suffixes before genericness.
  if ([...description.matchAll(/-specific\b/giu)].length !== qualifiers.length)
    return groups;
  for (const qualifier of qualifiers) {
    // Adjacent non-glue words may be part of a multiword name. Keep these queries
    // unchanged instead of reducing the requirement to its final word.
    const prefix = description.slice(0, qualifier.index);
    const adjacent = prefix.match(/([\p{Script=Latin}\p{N}._-]+)\s+$/u)?.[1];
    if (
      adjacent &&
      !LEFT_BOUNDARY_WORDS.has(adjacent) &&
      !(
        /-specific$/iu.test(adjacent) &&
        isGenericSpecificModifier(adjacent.replace(/-specific$/iu, ''))
      )
    )
      return groups;
  }
  const products = qualifiers.filter(
    match => !isGenericSpecificModifier(match[1]),
  );
  if (products.length !== 1) return groups;
  const qualifier = products[0];
  const product = normalize(qualifier[1]);
  return groups.map(group => ({
    ...group,
    results: group.results.filter(server => hasEvidence(server, product)),
  }));
}

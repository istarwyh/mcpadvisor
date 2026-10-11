import type { MCPServerResponse } from '../../../types/index.js';
interface ProviderResult {
  providerName: string;
  results: MCPServerResponse[];
}

export type RerankTestCase = [
  /* title */ string,
  /* provider results */ ProviderResult[],
  /* options */ Record<string, any>,
  /* expected titles */ string[],
];

export const caseTable: RerankTestCase[] = [
  [
    'sorts by similarity descending',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'Lower Similarity',
            description: '',
            sourceUrl: 'url-low',
            similarity: 0.75,
          } as MCPServerResponse,
        ],
      },
      {
        providerName: 'Provider2',
        results: [
          {
            title: 'Higher Similarity',
            description: '',
            sourceUrl: 'url-high',
            similarity: 0.9,
          } as MCPServerResponse,
        ],
      },
    ],
    {},
    ['Higher Similarity', 'Lower Similarity'],
  ],
  [
    'deduplicates using higher similarity then provider priority',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'Duplicate',
            description: '',
            sourceUrl: 'same-url',
            similarity: 0.8,
          } as MCPServerResponse,
        ],
      },
      {
        providerName: 'Provider2',
        results: [
          {
            title: 'Duplicate',
            description: '',
            sourceUrl: 'same-url',
            similarity: 0.8,
          } as MCPServerResponse,
        ],
      },
    ],
    {},
    ['Duplicate'],
  ],
  [
    'applies minSimilarity filter',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'Below Threshold',
            description: '',
            sourceUrl: 'url-below',
            similarity: 0.3,
          } as MCPServerResponse,
          {
            title: 'Above Threshold',
            description: '',
            sourceUrl: 'url-above',
            similarity: 0.7,
          } as MCPServerResponse,
        ],
      },
    ],
    { minSimilarity: 0.5 },
    ['Above Threshold'],
  ],
  [
    'respects limit option',
    [
      {
        providerName: 'Provider1',
        results: new Array(5).fill(null).map((_, idx) => ({
          title: `Server ${idx}`,
          description: '',
          sourceUrl: `url-${idx}`,
          similarity: 1 - idx * 0.1,
        })) as MCPServerResponse[],
      },
    ],
    { limit: 3 },
    ['Server 0', 'Server 1', 'Server 2'],
  ],
  [
    'respects limit option',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'Result 1',
            description: '',
            sourceUrl: 'url-1',
            similarity: 0.9,
          } as MCPServerResponse,
          {
            title: 'Result 2',
            description: '',
            sourceUrl: 'url-2',
            similarity: 0.8,
          } as MCPServerResponse,
          {
            title: 'Result 3',
            description: '',
            sourceUrl: 'url-3',
            similarity: 0.7,
          } as MCPServerResponse,
        ],
      },
    ],
    { limit: 2 },
    ['Result 1', 'Result 2'],
  ],
  [
    'uses existing score field when present',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'High Score',
            description: '',
            sourceUrl: 'url-high-score',
            similarity: 0.5, // Lower similarity
            score: 0.95, // But higher score
          } as MCPServerResponse,
          {
            title: 'Low Score',
            description: '',
            sourceUrl: 'url-low-score',
            similarity: 0.9, // Higher similarity
            score: 0.3, // But lower score
          } as MCPServerResponse,
        ],
      },
    ],
    {},
    ['High Score', 'Low Score'], // Should sort by score, not similarity
  ],
  [
    'calculates score from providerPriority * similarity when score is missing',
    [
      {
        providerName: 'Provider1', // Priority 1
        results: [
          {
            title: 'Provider1 Result',
            description: '',
            sourceUrl: 'url-p1',
            similarity: 0.8, // Score will be 1 * 0.8 = 0.8
          } as MCPServerResponse,
        ],
      },
      {
        providerName: 'Provider2', // Priority 2
        results: [
          {
            title: 'Provider2 Result',
            description: '',
            sourceUrl: 'url-p2',
            similarity: 0.6, // Score will be 2 * 0.6 = 1.2
          } as MCPServerResponse,
        ],
      },
    ],
    {},
    ['Provider2 Result', 'Provider1 Result'], // Provider2 should rank higher due to calculated score
  ],
  [
    'applies minScore filter correctly',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'High Score Result',
            description: '',
            sourceUrl: 'url-high',
            similarity: 0.9,
            score: 0.8,
          } as MCPServerResponse,
          {
            title: 'Low Score Result',
            description: '',
            sourceUrl: 'url-low',
            similarity: 0.7,
            score: 0.3,
          } as MCPServerResponse,
        ],
      },
    ],
    { minScore: 0.5 },
    ['High Score Result'], // Only high score result should pass the filter
  ],
  [
    'backward compatibility: minSimilarity works as minScore fallback',
    [
      {
        providerName: 'Provider1',
        results: [
          {
            title: 'High Similarity',
            description: '',
            sourceUrl: 'url-high',
            similarity: 0.8,
          } as MCPServerResponse,
          {
            title: 'Low Similarity',
            description: '',
            sourceUrl: 'url-low',
            similarity: 0.3,
          } as MCPServerResponse,
        ],
      },
    ],
    { minSimilarity: 0.5 }, // Should filter based on similarity when no score present
    ['High Similarity'],
  ],
];

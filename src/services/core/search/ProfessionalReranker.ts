import type { MCPServerResponse } from '../../../types/index.js';

export interface ProfessionalReranker {
  rerank(
    query: string,
    candidates: MCPServerResponse[],
  ): Promise<MCPServerResponse[]>;
}

/** Adapter for the separately started, local FlashRank service. */
export class FlashRankReranker implements ProfessionalReranker {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 5000,
  ) {
    const url = new URL(endpoint);
    if (
      url.username ||
      url.password ||
      !['http:', 'https:'].includes(url.protocol) ||
      (url.protocol === 'http:' &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    ) {
      throw new Error(
        'RERANK_URL must use HTTPS or local HTTP without embedded credentials',
      );
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new Error('Rerank timeout must be positive');
  }

  async rerank(
    query: string,
    candidates: MCPServerResponse[],
  ): Promise<MCPServerResponse[]> {
    if (!query.trim() || candidates.length < 2) return candidates;
    if (candidates.length > 50)
      throw new Error('FlashRank accepts at most 50 candidates');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: query.slice(0, 2048),
          documents: candidates.map(candidate =>
            [candidate.title, candidate.description].join('\n').slice(0, 8192),
          ),
        }),
      });
      if (!response.ok)
        throw new Error(`FlashRank returned HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const rows = (payload as { results?: unknown } | null)?.results;
      if (!Array.isArray(rows) || rows.length !== candidates.length)
        throw new Error('Invalid FlashRank result count');
      const seen = new Set<number>();
      const scores = new Map<number, number>();
      for (const row of rows) {
        if (!row || typeof row !== 'object')
          throw new Error('Invalid FlashRank result');
        const { index, relevance_score: score } = row as Record<
          string,
          unknown
        >;
        if (
          typeof index !== 'number' ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= candidates.length ||
          seen.has(index) ||
          typeof score !== 'number' ||
          !Number.isFinite(score) ||
          score < 0 ||
          score > 1
        ) {
          throw new Error('Invalid FlashRank result index or score');
        }
        seen.add(index);
        scores.set(index, score);
      }
      return candidates
        .map((candidate, index) => ({
          ...candidate,
          score: scores.get(index)!,
        }))
        .sort((a, b) => b.score - a.score);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** No model download, service startup or network request unless explicitly enabled. */
export function createOptionalProfessionalReranker(
  env: Record<string, string | undefined> = process.env,
): ProfessionalReranker | undefined {
  if (!env.RERANK_PROVIDER || env.RERANK_PROVIDER === 'none') return undefined;
  if (env.RERANK_PROVIDER !== 'flashrank')
    throw new Error('RERANK_PROVIDER must be none or flashrank');
  const timeout =
    env.RERANK_TIMEOUT_MS === undefined ? 5000 : Number(env.RERANK_TIMEOUT_MS);
  return new FlashRankReranker(
    env.RERANK_URL || 'http://127.0.0.1:8001/rerank',
    timeout,
  );
}

import { describe, test, expect } from 'vitest';
import { RerankMcpServer } from '../../../../services/core/search/RerankMcpService.js';
import { caseTable } from '../../../fixtures/search/rerankMcpService.cases.js';

describe('RerankMcpServer.reRank – parameterized baseline', () => {
  const reranker = new RerankMcpServer({
    Provider1: 1,
    Provider2: 2,
  });
  test.each(caseTable)(
    '%s',
    (_name, providerResults, options, expectedTitles) => {
      const results = reranker.reRank(providerResults, options);
      const receivedTitles = results.map(r => r.title);
      expect(receivedTitles).toEqual(expectedTitles);
    },
  );
});

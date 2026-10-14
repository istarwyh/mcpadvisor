import { describe, expect, it } from 'vitest';
import { buildMeilisearchQuery } from '../../../services/core/search/meilisearchQuery.js';
const catalog = {
  postgresql: {
    display_name: 'PostgreSQL',
    description: 'Read-only database access with schema inspection',
    tags: ['database', 'SQL'],
  },
  filesystem: {
    display_name: 'Filesystem',
    description: 'Read local files and directories',
    tags: ['file', 'filesystem'],
  },
  browser: {
    display_name: 'Browser Automation',
    description: 'Render JavaScript web pages',
    tags: ['browser', 'javascript', 'web'],
  },
};
describe('Meilisearch natural-language query planning', () => {
  it('preserves short literal and quoted queries', () => {
    expect(
      buildMeilisearchQuery({ taskDescription: 'PostgreSQL' }, catalog),
    ).toEqual({ query: 'PostgreSQL' });
    expect(
      buildMeilisearchQuery({ taskDescription: '"local files"' }, catalog),
    ).toEqual({ query: '"local files"' });
  });
  it('finds a named product beyond ten leading words', () => {
    const result = buildMeilisearchQuery(
      {
        taskDescription:
          'I want a useful way to work on a project with my existing PostgreSQL database',
      },
      catalog,
    );
    expect(result?.query.startsWith('postgresql')).toBe(true);
    expect(result?.query.split(' ').length).toBeLessThanOrEqual(10);
    expect(result?.matchingStrategy).toBe('last');
  });
  it('puts explicit retrieval terms before long prose', () => {
    const result = buildMeilisearchQuery(
      {
        taskDescription:
          'I need a useful tool to help with a lengthy task description that hides the important word',
        keywords: ['PostgreSQL'],
        capabilities: ['schema'],
      },
      catalog,
    );
    expect(result?.query.startsWith('postgresql schema')).toBe(true);
  });
  it('handles Chinese introductory wording and finite capability aliases', () => {
    expect(
      buildMeilisearchQuery(
        { taskDescription: '我需要查询数据库里的表' },
        catalog,
      )?.query,
    ).toContain('database');
    expect(
      buildMeilisearchQuery({ taskDescription: '请帮我读取本地文件' }, catalog)
        ?.query,
    ).toContain('file');
    expect(
      buildMeilisearchQuery(
        { taskDescription: '我想用 PostgreSQL 查询数据库' },
        catalog,
      )?.query.startsWith('postgresql'),
    ).toBe(true);
  });
  it('never turns an unknown or boilerplate-only task into a placeholder search', () => {
    expect(
      buildMeilisearchQuery({ taskDescription: '请帮我' }, catalog),
    ).toBeNull();
    expect(
      buildMeilisearchQuery(
        { taskDescription: '请帮我寻找独角兽传送门' },
        catalog,
      ),
    ).toBeNull();
  });
  it('retains an explicitly unknown product as the required leading anchor', () => {
    const result = buildMeilisearchQuery(
      {
        taskDescription:
          'I need a NeverKnown-specific MCP server for database queries',
      },
      catalog,
    );
    expect(result?.query.startsWith('neverknown')).toBe(true);
    expect(result?.matchingStrategy).toBe('last');
    expect(
      buildMeilisearchQuery(
        { taskDescription: '需要专门对接 NeverKnown 的数据库工具' },
        catalog,
      )?.query.startsWith('neverknown'),
    ).toBe(true);
  });
  it('does not promote incidental individual title words to product anchors', () => {
    const result = buildMeilisearchQuery(
      { taskDescription: 'I want automation for a web task' },
      catalog,
    );
    expect(result?.matchingStrategy).toBe('last');
  });
  it('keeps required products ahead of generic explicit terms and excludes direct negation', () => {
    for (const taskDescription of [
      'I need PostgreSQL',
      'I need a NeverKnown-specific database tool',
    ]) {
      const q = buildMeilisearchQuery(
        { taskDescription, capabilities: ['schema inspection'] },
        catalog,
      );
      expect(q?.query).toMatch(/^(postgresql|neverknown)/);
    }
    for (const taskDescription of [
      'I need a database tool, but not PostgreSQL',
      '我需要数据库工具，不要 PostgreSQL',
    ])
      expect(buildMeilisearchQuery({ taskDescription }, catalog)).toBeNull();
  });
  it('prepares quoted prose and keeps multiword product constraints intact', () => {
    expect(
      buildMeilisearchQuery(
        {
          taskDescription:
            'I want a useful way to work with a "PostgreSQL" database',
        },
        catalog,
      )?.query.startsWith('postgresql'),
    ).toBe(true);
    expect(
      buildMeilisearchQuery(
        { taskDescription: '需要专门对接 Apache Kafka 的数据库工具' },
        catalog,
      )?.query.startsWith('"apache kafka"'),
    ).toBe(true);
  });
});

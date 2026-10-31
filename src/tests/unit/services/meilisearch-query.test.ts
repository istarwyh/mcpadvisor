import { describe, expect, it } from 'vitest';
import {
  buildMeilisearchQuery,
  extractSpecificProduct,
} from '../../../services/core/search/meilisearchQuery.js';
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
    expect(
      buildMeilisearchQuery(
        { taskDescription: '"task-specific local files"' },
        catalog,
      ),
    ).toEqual({ query: '"task-specific local files"' });
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

  it('does not treat ordinary specific modifiers as mandatory product names', () => {
    for (const modifier of ['task', 'project', 'privacy', 'Task', 'Project']) {
      const actual = buildMeilisearchQuery(
        {
          taskDescription: `I need a ${modifier}-specific MCP server for local files`,
        },
        catalog,
      );
      expect(actual?.query).toBe('local files');
    }
    expect(
      buildMeilisearchQuery(
        {
          taskDescription: 'I need a project-specific PostgreSQL database tool',
        },
        catalog,
      )?.query.startsWith('postgresql'),
    ).toBe(true);
  });
  it('keeps the whole recognized name before a specific suffix', () => {
    const multiword = {
      ...catalog,
      kafka: { display_name: 'Apache Kafka', description: 'Stream events' },
    };
    expect(
      buildMeilisearchQuery(
        { taskDescription: 'I need an Apache Kafka-specific MCP integration' },
        multiword,
      )?.query.startsWith('"apache kafka"'),
    ).toBe(true);
    expect(
      buildMeilisearchQuery(
        { taskDescription: 'I need a postgresql-specific MCP server' },
        catalog,
      )?.query.startsWith('postgresql'),
    ).toBe(true);
  });
  it('keeps an explicit lowercase unknown name rather than generic fallback terms', () => {
    expect(
      buildMeilisearchQuery(
        { taskDescription: 'I need a neverknown-specific database tool' },
        catalog,
      )?.query.startsWith('neverknown'),
    ).toBe(true);
  });
  it('does not reintroduce a generic specific modifier through corpus vocabulary', () => {
    const withTasks = {
      ...catalog,
      tasks: {
        display_name: 'Workflow',
        description: 'Project and task management',
      },
    };
    expect(
      buildMeilisearchQuery(
        {
          taskDescription: 'I need a task-specific MCP server for local files',
        },
        withTasks,
      )?.query,
    ).toBe('local files');
  });
  it('keeps positive-only other-than phrases positive', () => {
    for (const taskDescription of [
      'I need nothing other than PostgreSQL',
      'I need no database other than PostgreSQL',
      'I need none other than PostgreSQL',
      'I need nothing except for PostgreSQL',
      'I need no database except for PostgreSQL',
    ])
      expect(
        buildMeilisearchQuery({ taskDescription }, catalog)?.query.startsWith(
          'postgresql',
        ),
      ).toBe(true);
  });
  it('handles short and repeated specific qualifiers without losing the real product', () => {
    for (const taskDescription of [
      'task-specific local files',
      'project-specific local files',
      'privacy-specific local files',
    ])
      expect(buildMeilisearchQuery({ taskDescription }, catalog)?.query).toBe(
        'local files',
      );
    expect(
      buildMeilisearchQuery(
        {
          taskDescription:
            'I need a task-specific NeverKnown-specific database tool',
        },
        catalog,
      )?.query.startsWith('neverknown'),
    ).toBe(true);
  });

  it('expands a specific suffix only to the product adjacent to that occurrence', () => {
    const products = {
      ...catalog,
      github: { display_name: 'GitHub', description: 'Repository API' },
      actions: {
        display_name: 'GitHub Actions',
        description: 'Deployment workflows',
      },
    };
    expect(
      buildMeilisearchQuery(
        {
          taskDescription:
            'I need a GitHub-specific MCP server for repositories; deployment already uses GitHub Actions',
        },
        products,
      )?.query.startsWith('github '),
    ).toBe(true);
    expect(
      buildMeilisearchQuery(
        {
          taskDescription:
            'I need a GitHub Actions-specific MCP server for deployment',
        },
        products,
      )?.query.startsWith('"github actions"'),
    ).toBe(true);
  });
  it.each([
    ['Find a Google Drive-specific MCP for searching files', 'google drive'],
    [
      'I need a Home Assistant-specific MCP for home automations',
      'home assistant',
    ],
    ['需要 AWS Cost Explorer 专用 MCP，分析云账单。', 'aws cost explorer'],
    ['请推荐 Firestore 专用 MCP，让助手连接我的数据库。', 'firestore'],
    ['帮我找 Sentry 专用的 MCP', 'sentry'],
    ['我要知舟工单 Pro 专用的 MCP，处理工单。', '知舟工单 pro'],
    [
      'Find a NeverKnown Actions-specific MCP for workflows',
      'neverknown actions',
    ],
    ['Use PostgreSQL-specific tools', 'postgresql'],
    ['I need a "Google Drive"-specific MCP', 'google drive'],
  ])(
    'extracts a complete explicit phrase independently of the catalog: %s',
    (taskDescription, product) => {
      expect(extractSpecificProduct(taskDescription)).toBe(product);
      const catalogs: Parameters<typeof buildMeilisearchQuery>[1][] = [
        {},
        catalog,
        {
          drive: { display_name: 'Drive' },
          home: { display_name: 'Assistant' },
        },
      ];
      for (const data of catalogs) {
        const actual = buildMeilisearchQuery({ taskDescription }, data);
        expect(
          actual?.query.startsWith(
            product.includes(' ') ? `"${product}"` : product,
          ),
        ).toBe(true);
        expect(actual?.matchingStrategy).toBe('last');
      }
    },
  );
  it.each([
    'I need a task-specific MCP',
    'I need a secure PostgreSQL-specific MCP',
    'I need a GitHub-specific and PostgreSQL-specific MCP',
    'I need a GitHub And PostgreSQL-specific MCP',
    'I need a -specific MCP',
    'GitHub-specific and -specific MCP',
    '不要 Sentry 专用 MCP',
    'Slack 和 Notion 专用 MCP',
    'Slack 专用或 Notion 专用 MCP',
    '任务专用 MCP',
  ])(
    'keeps unsupported or generic scope outside the new product grammar: %s',
    query => {
      expect(extractSpecificProduct(query)).toBeNull();
    },
  );
  it.each([
    '请推荐一个 Cloud Harbor 专用的 MCP',
    '请推荐 一个 Cloud Harbor 专用的 MCP',
    '帮我找一个 Cloud Harbor 专用 MCP',
    '请帮我推荐一个 Cloud Harbor 专用 MCP',
    '我需要一个Cloud Harbor专用 MCP',
    '我要一个 Cloud Harbor 专用 MCP',
  ])(
    'removes a Chinese introductory determiner without dropping product words: %s',
    taskDescription => {
      expect(extractSpecificProduct(taskDescription)).toBe('cloud harbor');
      expect(buildMeilisearchQuery({ taskDescription }, {})?.query).toBe(
        '"cloud harbor"',
      );
    },
  );
  it.each([
    'Could you find a NeverKnown Actions-specific MCP?',
    'I want to use a NeverKnown Actions-specific MCP',
    'I would like a NeverKnown Actions-specific MCP',
    'I am looking for a NeverKnown Actions-specific MCP',
    'Can you help me find a NeverKnown Actions-specific MCP',
    'Show me a NeverKnown Actions-specific MCP',
    'I need a task-specific tool. Find a NeverKnown Actions-specific MCP',
    'I need a NeverKnown Actions-specific MCP. I also need a task-specific tool',
    'Find a NeverKnown Actions-specific MCP for user-specific tasks',
  ])(
    'retains full unknown names with grammatical lead-ins and generic adjuncts: %s',
    taskDescription => {
      expect(extractSpecificProduct(taskDescription)).toBe(
        'neverknown actions',
      );
      expect(
        buildMeilisearchQuery({ taskDescription }, catalog)?.query.startsWith(
          '"neverknown actions"',
        ),
      ).toBe(true);
    },
  );
  it('does not mistake a generic final product word for an adjunct or split an internal dot', () => {
    expect(extractSpecificProduct('Find a Google Search-specific MCP')).toBe(
      'google search',
    );
    expect(extractSpecificProduct('Find an Acme.IO Pro-specific MCP')).toBe(
      'acme.io pro',
    );
  });
  it.each([
    ['Find a Code With Me-specific MCP', 'code with me'],
    ['Find a NeverKnown For Search-specific MCP', 'neverknown for search'],
    ['I need a Need for Speed-specific MCP', 'need for speed'],
    [
      'Find a tool-specific MCP for Google Drive-specific tasks',
      'google drive',
    ],
  ])(
    'never strips grammatical words inside a complete product name: %s',
    (taskDescription, product) => {
      expect(extractSpecificProduct(taskDescription)).toBe(product);
      expect(buildMeilisearchQuery({ taskDescription }, {})?.query).toBe(
        `"${product}"`,
      );
    },
  );
  it('preserves corpus lexical ordering for Han-only names while extracting the full requirement', () => {
    const hanCatalog = {
      notes: { display_name: 'Notes', description: '小红书关键词搜索笔记' },
      news: { display_name: 'News', description: '小红书热点新闻' },
    };
    expect(extractSpecificProduct('我想用小红书专用 MCP')).toBe('小红书');
    expect(
      buildMeilisearchQuery(
        { taskDescription: '我想用小红书专用 MCP 按关键词搜索笔记' },
        hanCatalog,
      )?.query.startsWith('小红书'),
    ).toBe(false);
  });
  it.each(['文件系统', '电子邮件', '知识图谱'])(
    'preserves known generic Chinese capability modifiers: %s',
    capability => {
      expect(extractSpecificProduct(`需要${capability}专用 MCP`)).toBeNull();
    },
  );
});

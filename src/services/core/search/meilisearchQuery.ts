import type { SearchParams } from '../../../types/search.js';

interface CatalogRecord {
  display_name?: unknown;
  description?: unknown;
  categories?: unknown;
  tags?: unknown;
}

// Linguistic glue and catalog boilerplate should not consume Meili's query budget.
const STOP_WORDS = new Set(
  `a an and are as at be been before but by can could do does for from get give has have how i if in into is it its me my need of on or our please should so that the their them then there these they this to us use want we what when where which with would you your will only first needs keeps gets nearly actual not no without mcp agent agents server servers service services tool tools integration integrations assistant assistants specific find looking help add connect 我 我们 你 您 的 了 在 是 有 和 与 或 要 想 需要 希望 可以 能 让 帮 帮我 请 一个 一种 什么 哪个 哪种 如何 支持 提供 服务 工具 集成 助手`.split(
    /\s+/,
  ),
);
// A deliberately finite glossary, not translation or a semantic model. These are
// general capability terms; product names and arbitrary constraints are not guessed.
const CAPABILITY_TERMS: ReadonlyArray<readonly [string, string]> = [
  ['文件系统', 'filesystem'],
  ['文件', 'file'],
  ['目录', 'directory'],
  ['数据库', 'database'],
  ['查询', 'query'],
  ['表结构', 'schema'],
  ['浏览器', 'browser'],
  ['网页', 'web'],
  ['抓取', 'scraping'],
  ['搜索', 'search'],
  ['日历', 'calendar'],
  ['电子邮件', 'email'],
  ['邮件', 'email'],
  ['笔记', 'notes'],
  ['文档', 'documentation'],
  ['代码', 'code'],
  ['软件库', 'library'],
  ['版本', 'version'],
  ['容器', 'container'],
  ['日志', 'logs'],
  ['监控', 'monitoring'],
  ['缓存', 'cache'],
  ['消息队列', 'queue'],
  ['消息', 'messages'],
  ['知识图谱', 'knowledge graph'],
  ['记忆', 'memory'],
  ['向量', 'vector'],
  ['表格', 'spreadsheet'],
  ['工作簿', 'workbook'],
  ['图表', 'chart'],
  ['图片', 'image'],
  ['图像', 'image'],
  ['音频', 'audio'],
  ['视频', 'video'],
  ['地图', 'maps'],
  ['路线', 'route'],
  ['火车', 'train'],
  ['铁路', 'rail'],
  ['博物馆', 'museum'],
  ['藏品', 'collection'],
  ['翻译', 'translation'],
  ['任务', 'task'],
  ['项目', 'project'],
  ['接口', 'api'],
  ['认证', 'authentication'],
];
const GENERIC_NAMES = new Set([
  ...STOP_WORDS,
  ...'task project privacy domain context language user application environment customer role workflow vendor organization industry platform framework purpose system requirement'.split(
    ' ',
  ),
  ...'api ai data code search web local time memory file files database knowledge information protocol context'.split(
    ' ',
  ),
]);
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });

function tokens(text: string): string[] {
  return [...segmenter.segment(text.normalize('NFKC').toLowerCase())]
    .filter(part => part.isWordLike)
    .map(part => part.segment)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
function literalMention(text: string, phrase: string, atEnd = false): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\p{Script=Latin}\\p{N}])${escaped}${atEnd ? '$' : '(?=$|[^\\p{Script=Latin}\\p{N}])'}`,
    'iu',
  ).test(text);
}

/** Prepare bounded lexical queries; does not change index settings or documents. */
export function buildMeilisearchQuery(
  params: SearchParams,
  catalog: Record<string, CatalogRecord>,
): { query: string; matchingStrategy?: 'last' } | null {
  const description = params.taskDescription.trim();
  const explicit = [...(params.keywords || []), ...(params.capabilities || [])]
    .map(value => value.trim())
    .filter(Boolean);
  const raw = [description, ...explicit].join(' ').trim();
  if (!/[\p{L}\p{N}]/u.test(raw)) return null;
  // Preserve literal/short keyword searches, including typo tolerance and quotes.
  const rawWords = raw.split(/\s+/);
  if (
    !explicit.length &&
    !/\p{Script=Han}/u.test(raw) &&
    (/^["“][\s\S]*["”]$/u.test(raw) ||
      (!/-specific\b/iu.test(raw) &&
        rawWords.length <= 5 &&
        rawWords.every(word => !STOP_WORDS.has(word.toLowerCase()))))
  )
    return { query: raw };

  const frequency = new Map<string, number>();
  const names = new Set<string>();
  for (const [id, record] of Object.entries(catalog)) {
    if (typeof record.display_name !== 'string') continue;
    const title = record.display_name;
    const text = [
      title,
      typeof record.description === 'string' ? record.description : '',
      ...strings(record.categories),
      ...strings(record.tags),
    ].join(' ');
    for (const word of new Set(tokens(text)))
      frequency.set(word, (frequency.get(word) || 0) + 1);
    for (const name of [
      title.toLowerCase(),
      id.replace(/[-_]/g, ' ').toLowerCase(),
    ])
      if (
        name.length >= 3 &&
        !GENERIC_NAMES.has(name) &&
        literalMention(description, name)
      )
        names.add(name);
  }
  // Do not reverse a direct product exclusion into a positive search anchor.
  // This lexical provider abstains; the other providers still see the full task.
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (
      new RegExp(
        `(?:\\b(?:not|no|exclude|excluding|except|rather than|instead of|without)\\s+(?:(?:use|using|the)\\s+)*|(?:不想使用|不想用|不希望使用|不要使用|不要|不用|不使用|排除|不考虑)\\s*)${escaped}(?=$|[^\\p{Script=Latin}\\p{N}])`,
        'iu',
      ).test(description)
    )
      return null;
  }
  // Preserve distinctive unknown product spellings next to an integration noun.
  // Capitalization alone is not enough: sentence-initial adjectives are not names.
  const unknownProduct = [
    ...description.matchAll(
      /\b([A-Z][A-Za-z0-9_-]*)\s+(?:database|integration|server|API|MCP|tool)\b/g,
    ),
  ]
    .map(match => match[1])
    .find(
      word =>
        (/[a-z][A-Z]|[0-9_]/.test(word) || /^[A-Z]{2,}$/.test(word)) &&
        !STOP_WORDS.has(word.toLowerCase()) &&
        !frequency.has(word.toLowerCase()),
    );
  // A generic modifier (task-specific, privacy-specific, etc.) is not a product.
  // Known names are case-insensitive; unknown names need distinctive spelling.
  const named = [...names].sort(
    (a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length,
  );
  const specificWords = [
    ...description.matchAll(/\b([a-z][\w.-]*)-specific\b/giu),
  ];
  const specificProducts: string[] = [];
  for (const match of specificWords) {
    const word = match[1];
    const prefix = description.slice(0, match.index + word.length);
    const recognized = named.find(name => literalMention(prefix, name, true));
    if (recognized) specificProducts.push(recognized);
    else if (GENERIC_NAMES.has(word.toLowerCase())) continue;
    else if (/[a-z][A-Z]|[0-9_]|^[A-Z]{2,}$/.test(word))
      specificProducts.push(word);
    // Do not weaken an ambiguous unknown qualifier into unrelated results.
    else return null;
  }
  const specific =
    specificProducts[0] ||
    description
      .match(/专门(?:对接|针对|连接)\s*([a-z][a-z0-9 ._-]*[a-z0-9])/iu)?.[1]
      ?.trim();
  const product = specific || unknownProduct || named[0];
  const anchors = [...(product ? [product] : []), ...explicit];
  const translated = CAPABILITY_TERMS.filter(([source]) =>
    description.includes(source),
  )
    .map(([, target]) => target)
    .join(' ');
  const lexicalDescription = description.replace(
    /\b([a-z][\w.-]*)-specific\b/giu,
    (phrase, word: string) =>
      GENERIC_NAMES.has(word.toLowerCase()) ? '' : phrase,
  );
  const normalized = tokens(`${lexicalDescription} ${translated}`).map(word => {
    if (frequency.has(word)) return word;
    if (word.endsWith('ies') && frequency.has(`${word.slice(0, -3)}y`))
      return `${word.slice(0, -3)}y`;
    if (word.endsWith('s') && frequency.has(word.slice(0, -1)))
      return word.slice(0, -1);
    if (frequency.has(`${word}s`)) return `${word}s`;
    if (word.endsWith('y') && frequency.has(`${word.slice(0, -1)}ies`))
      return `${word.slice(0, -1)}ies`;
    return word;
  });
  const terms = [...new Set(normalized)]
    .filter(word => frequency.has(word))
    .sort((a, b) => (frequency.get(a) || 0) - (frequency.get(b) || 0));
  // Put the caller's or named product anchor first so `last` cannot discard it
  // before filler. Otherwise lead with discriminative corpus-supported vocabulary. Multiword
  // anchors stay quoted so progressive relaxation cannot discard half a name.
  const selected = [
    ...new Set([
      ...anchors
        .map(value => {
          const clean = value
            .toLowerCase()
            .replace(/["“”]/g, '')
            .replace(/[-_/]+/g, ' ')
            .trim();
          return /[\p{L}\p{N}]/u.test(clean)
            ? /\s/.test(clean)
              ? `"${clean}"`
              : clean
            : '';
        })
        .filter(Boolean),
      ...terms,
    ]),
  ].slice(0, 10);
  if (!selected.length) return null; // Never turn an unrecognized task into q=''.
  return {
    query: selected.join(' '),
    matchingStrategy: 'last',
  };
}

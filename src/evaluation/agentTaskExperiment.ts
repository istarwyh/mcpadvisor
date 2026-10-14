import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { validateQueries, validateRankings } from './judgmentPool.js';
import { evaluateRun, type QueryJudgments } from './searchQuality.js';

export interface AgentTask {
  id: string;
  query: string;
  audience: 'developer' | 'user';
  language: 'en' | 'zh';
  split: 'development' | 'holdout';
  family: string;
  intent: string;
  critical: boolean;
}
export interface AgentTaskDataset {
  label: 'illustrative';
  queries: AgentTask[];
}
export interface AssessedTask extends QueryJudgments {
  answerability: 'answerable' | 'no-known-relevant';
  rationale: string;
}
export interface AgentTaskJudgments {
  label: 'illustrative';
  assessor: string;
  queries: AssessedTask[];
}
export const EXPERIMENT_K = 10;
export const CANDIDATE_ATTRIBUTES = [
  'title',
  'tags',
  'categories',
  'description',
];

export function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function validateAgentTasks(raw: unknown): AgentTaskDataset {
  const dataset = validateQueries(raw);
  if (dataset.label !== 'illustrative')
    throw new Error('Public-task experiments must remain illustrative');
  const families = new Map<string, string>();
  for (const item of dataset.queries) {
    const task = item as AgentTask;
    if (
      !['developer', 'user'].includes(task.audience) ||
      !['en', 'zh'].includes(task.language) ||
      !['development', 'holdout'].includes(task.split) ||
      typeof task.family !== 'string' ||
      !task.family.trim() ||
      typeof task.intent !== 'string' ||
      !task.intent.trim() ||
      typeof task.critical !== 'boolean'
    )
      throw new Error('Invalid task metadata');
    if (families.has(task.family) && families.get(task.family) !== task.split)
      throw new Error('Task families must not leak across splits');
    families.set(task.family, task.split);
  }
  for (const split of ['development', 'holdout'])
    if (!(dataset.queries as AgentTask[]).some(task => task.split === split))
      throw new Error('Both development and holdout tasks are required');
  return dataset as AgentTaskDataset;
}

/** Only a disposable loopback engine may be changed by the capture command. */
export function validateExperimentHost(host: string): string {
  const url = new URL(host);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('A numeric loopback engine URL is required');
  return url.origin;
}

/** Keep no-known-relevant queries visible without inventing positive grades. */
export function evaluateAgentTasks(
  rawTasks: unknown,
  rawJudgments: unknown,
  baselineInput: unknown,
  candidateInput: unknown,
  catalogIds: string[],
) {
  const tasks = validateAgentTasks(rawTasks);
  const baseline = validateRankings(tasks, baselineInput);
  const candidate = validateRankings(tasks, candidateInput);
  const judgments = rawJudgments as AgentTaskJudgments | null;
  if (
    judgments?.label !== 'illustrative' ||
    typeof judgments.assessor !== 'string' ||
    !judgments.assessor.trim() ||
    !Array.isArray(judgments.queries) ||
    judgments.queries.length !== tasks.queries.length ||
    new Set(judgments.queries.map(item => item?.id)).size !==
      tasks.queries.length
  )
    throw new Error('Complete, attributed illustrative judgments required');
  const catalog = new Set(catalogIds);
  if (!catalog.size || catalog.size !== catalogIds.length)
    throw new Error('A unique catalog is required');
  const rows = tasks.queries.map(task => {
    const judged = judgments.queries.find(item => item.id === task.id);
    if (
      !judged ||
      judged.query !== task.query ||
      !['answerable', 'no-known-relevant'].includes(judged.answerability) ||
      typeof judged.rationale !== 'string' ||
      !judged.rationale.trim() ||
      !judged.relevance ||
      typeof judged.relevance !== 'object' ||
      Array.isArray(judged.relevance)
    )
      throw new Error('Judgments must match the frozen task text');
    for (const [id, grade] of Object.entries(judged.relevance))
      if (
        !catalog.has(id) ||
        !Number.isInteger(grade) ||
        grade < 0 ||
        grade > 3
      )
        throw new Error('Every judgment needs a catalog ID and grade 0–3');
    for (const run of [baseline, candidate])
      for (const id of run[task.id])
        if (!catalog.has(id)) throw new Error('Ranking is outside the catalog');
        else if (!Object.hasOwn(judged.relevance, id))
          throw new Error(
            'All retrieved candidates must be independently judged',
          );
    // Grade 1 is weak/tangential in the frozen rubric, not a useful answer.
    const useful = Object.values(judged.relevance).some(grade => grade >= 2);
    if (useful !== (judged.answerability === 'answerable'))
      throw new Error('Answerability and useful grades disagree');
    return { task, judged };
  });
  const summarize = (selected: typeof rows) => {
    const answerable = selected
      .filter(row => row.judged.answerability === 'answerable')
      .map(row => row.judged);
    const noKnownRelevant = selected
      .filter(row => row.judged.answerability === 'no-known-relevant')
      .map(({ task, judged }) => ({
        id: task.id,
        query: task.query,
        rationale: judged.rationale,
        baselineReturned: baseline[task.id].length,
        candidateReturned: candidate[task.id].length,
      }));
    const a = answerable.length
      ? evaluateRun(answerable, baseline, EXPERIMENT_K)
      : null;
    const b = answerable.length
      ? evaluateRun(answerable, candidate, EXPERIMENT_K)
      : null;
    const usefulRecall = (run: Record<string, string[]>) =>
      answerable.length
        ? answerable.reduce((sum, query) => {
            const relevant = Object.entries(query.relevance)
              .filter(([, grade]) => grade >= 2)
              .map(([id]) => id);
            const found = run[query.id]
              .slice(0, EXPERIMENT_K)
              .filter(id => relevant.includes(id)).length;
            return sum + found / relevant.length;
          }, 0) / answerable.length
        : null;
    return {
      totalQueries: selected.length,
      scoredQueries: answerable.length,
      noKnownRelevant,
      baseline: a,
      candidate: b,
      // Existing Recall@K includes weak grade 1; gate useful answers separately.
      usefulRecall: {
        baseline: usefulRecall(baseline),
        candidate: usefulRecall(candidate),
      },
      meanNdcgDelta: a && b ? b.meanNdcg - a.meanNdcg : null,
      relativeNdcgChange:
        a && b && a.meanNdcg > 0
          ? (b.meanNdcg - a.meanNdcg) / a.meanNdcg
          : null,
      zeroResultQueries: {
        baseline: selected.filter(row => !baseline[row.task.id].length).length,
        candidate: selected.filter(row => !candidate[row.task.id].length)
          .length,
      },
    };
  };
  const development = summarize(
    rows.filter(r => r.task.split === 'development'),
  );
  const holdout = summarize(rows.filter(r => r.task.split === 'holdout'));
  const criticalRegressions = rows.flatMap(({ task, judged }) => {
    if (!task.critical || judged.answerability !== 'answerable') return [];
    const a = evaluateRun([judged], baseline, EXPERIMENT_K).meanNdcg;
    const b = evaluateRun([judged], candidate, EXPERIMENT_K).meanNdcg;
    const useful = (run: Record<string, string[]>) =>
      run[task.id].slice(0, EXPERIMENT_K).some(id => judged.relevance[id] >= 2);
    return b < a - 0.1 - 1e-12 || (useful(baseline) && !useful(candidate))
      ? [task.id]
      : [];
  });
  const unsupportedRegression = [development, holdout].some(split =>
    split.noKnownRelevant.some(
      row => row.baselineReturned === 0 && row.candidateReturned > 0,
    ),
  );
  const gatePassed =
    [development, holdout].every(
      split =>
        split.meanNdcgDelta !== null &&
        split.meanNdcgDelta > 1e-12 &&
        split.baseline &&
        split.candidate &&
        split.candidate.meanRecall >= split.baseline.meanRecall - 1e-12 &&
        split.usefulRecall.baseline !== null &&
        split.usefulRecall.candidate !== null &&
        split.usefulRecall.candidate >= split.usefulRecall.baseline - 1e-12,
    ) &&
    !criticalRegressions.length &&
    !unsupportedRegression;
  return {
    label: 'illustrative',
    assessor: judgments.assessor,
    taskHash: contentHash(tasks),
    judgmentHash: contentHash(judgments),
    development,
    holdout,
    slices: Object.fromEntries(
      ['en', 'zh', 'developer', 'user'].map(value => [
        value,
        summarize(
          rows.filter(
            r => r.task.language === value || r.task.audience === value,
          ),
        ),
      ]),
    ),
    gate: { passed: gatePassed, criticalRegressions, unsupportedRegression },
    decision: gatePassed
      ? 'Eligible for further review; this report does not change production settings.'
      : 'Do not promote this candidate. Retain production settings and report the negative result.',
    limitations: [
      'Agent-authored public scenarios and AI-assessed relevance, not real user logs or human labels.',
      'Recall is relative to known relevant items within the fixed catalog, not ecosystem coverage.',
      'No-known-relevant queries are reported separately, never silently dropped or counted as perfect nDCG.',
      'A small purposive development/holdout sample does not establish statistical significance or production gains.',
    ],
  };
}

/** Report entrypoints must bind every scored input to the completed capture. */
export function verifyExperimentEvidence(
  tasks: unknown,
  baseline: unknown,
  candidate: unknown,
  catalog: unknown,
  rawManifest: unknown,
  protocol: unknown,
) {
  if (
    !rawManifest ||
    typeof rawManifest !== 'object' ||
    Array.isArray(rawManifest)
  )
    throw new Error('A completed capture manifest is required');
  const manifest = rawManifest as Record<string, unknown>;
  const expected: Record<string, string> = {
    queryHash: contentHash(tasks),
    catalogHash: contentHash(catalog),
    baselineHash: contentHash(baseline),
    candidateHash: contentHash(candidate),
    protocolHash: contentHash(protocol),
    settingsHash: contentHash(manifest.settings),
  };
  if (
    manifest.complete !== true ||
    manifest.k !== EXPERIMENT_K ||
    manifest.meilisearchVersion !== '1.15.2'
  )
    throw new Error('Incomplete or incompatible capture');
  for (const [key, value] of Object.entries(expected))
    if (manifest[key] !== value)
      throw new Error(`Capture evidence mismatch: ${key}`);
  const plan = protocol as Record<string, unknown> | null;
  if (
    !plan ||
    plan.k !== manifest.k ||
    plan.meilisearchVersion !== manifest.meilisearchVersion ||
    (plan.queryPlannerSha256 &&
      plan.queryPlannerSha256 !== manifest.queryPlannerSha256)
  )
    throw new Error('Protocol does not match the captured experiment');
  const mode = plan.mode || 'field-priority';
  const settings = manifest.settings as Record<string, Record<string, unknown>>;
  if (
    !['field-priority', 'query-preparation'].includes(String(mode)) ||
    manifest.mode !== mode ||
    !settings?.baseline ||
    !settings?.candidate
  )
    throw new Error('Capture mode/settings do not match the protocol');
  for (const name of ['baseline', 'candidate']) {
    const attributes = plan[`${name}SearchableAttributes`];
    if (
      !Array.isArray(attributes) ||
      !attributes.length ||
      contentHash(settings[name].searchableAttributes) !==
        contentHash(attributes)
    )
      throw new Error(`Captured ${name} attributes do not match the protocol`);
  }
  const { searchableAttributes: baselineAttributes, ...baselineSettings } =
    settings.baseline;
  const { searchableAttributes: candidateAttributes, ...candidateSettings } =
    settings.candidate;
  if (
    contentHash(baselineSettings) !== contentHash(candidateSettings) ||
    (mode === 'query-preparation' &&
      (typeof plan.queryPlannerSha256 !== 'string' ||
        !plan.queryPlannerSha256 ||
        contentHash(baselineAttributes) !== contentHash(candidateAttributes)))
  )
    throw new Error(
      'Capture changes settings outside the intended intervention',
    );
  return {
    ...expected,
    manifestHash: contentHash(manifest),
    queryPlannerSha256: manifest.queryPlannerSha256 || null,
  };
}

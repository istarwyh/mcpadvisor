# Repeatable local search quality evaluation

Refs #13. Measure relevance before changing weights, adding embeddings or
claiming a percentage improvement. This first stage adds graded nDCG@K,
Recall@K, Precision@K, per-query results and an explicit unjudged-result count.
Duplicate result IDs, invalid grades and missing query runs fail evaluation.

```sh
pnpm build
node build/evaluation/evaluateSearch.js \
  --judgments evaluation/illustrative-judgments.json \
  --rankings evaluation/illustrative-rankings.json --k 10
```

These three queries and labels are illustrative test fixtures. Perfect scores
on them do not establish business relevance, satisfaction, catalog coverage or
the issue's 40%/50% improvement targets. The JSON report explicitly retains
that limitation. Precision uses K as its denominator even when fewer hits return.

For a real Meilisearch index, omit `--rankings` and supply `MEILI_EVAL_HOST`,
`MEILI_EVAL_INDEX` and optionally `MEILI_EVAL_API_KEY` as environment variables.
The tool reads internal and original catalog IDs only and does not alter index settings or documents. Keep
keys out of command arguments and output files. `--output report.json` saves
the report; `--compare candidate-rankings.json` compares on the exact same
queries and reports relative mean nDCG change, or null if baseline nDCG is zero.

Create a `label: "business"` dataset with actual query text and independently
reviewed server-ID grades: 3 highly relevant, 2 relevant, 1 weakly relevant,
0 irrelevant. Every query needs at least one positively judged result. Freeze
the catalog, index settings, labels and K across baseline/candidate runs; cover
English/Chinese queries, ambiguous tasks, different categories and zero-result
requests. Label candidate-only hits as well to reduce pooling bias.

Related delivery: #8 populates the local full-text catalog and retains actual
ranking scores and metadata; #9 adds optional CPU model reranking. Business
query labels, telemetry definitions and a reviewed embedding/model choice
remain necessary before claiming the broader #13 acceptance targets. This PR
does not invent popularity/activity metadata or close the entire roadmap.

For auto-indexed catalogs, evaluation uses `catalog_id` (the public source ID),
falling back to `id` only for legacy indexes where `catalog_id` is absent. This
keeps judgments keyed by original IDs consistent with application results even
when Meilisearch requires a hashed primary key. Invalid public ID types fail the
CLI with a generic error and nonzero exit, without printing connection details.
Actual-engine CI exercises both original and legacy IDs and verifies read-only
behavior; its judgments remain illustrative, not business acceptance evidence.

## Prepare independent judgments before scoring

`prepareJudgments` fills the missing step between query collection and scoring.
It accepts unlabeled queries, reads saved runs or a live Meilisearch index, and
pools the top K from every run. It never assigns relevance grades. The workflow
follows [Meilisearch's evaluation guidance](https://www.meilisearch.com/blog/search-relevance-metrics)
and the multi-run top-K pooling used in [TREC Deep Learning](https://www.microsoft.com/en-us/research/wp-content/uploads/2020/03/trec2019-deeplearning-overview-5e725254303da.pdf).
These references motivate the workflow, not a claim that this small pool is a
representative benchmark.

1. Freeze a local public catalog snapshot and a query file with the shape
   `{ "label": "illustrative", "queries": [{ "id": "files", "query": "local filesystem" }] }`.
   Use `business` only for actual representative queries; this label alone does
   not attest to independent review. No user queries are collected automatically.
2. Capture each configuration separately, keeping the catalog and query set
   fixed. With `MEILI_EVAL_HOST`, `MEILI_EVAL_INDEX` and optionally
   `MEILI_EVAL_API_KEY` in the environment:

   ```sh
   node build/evaluation/prepareJudgments.js \
     --queries queries.json --catalog data/mcp_server_list.json --k 10 \
     --output baseline-pool.json --rankings-output baseline.json
   ```

   Live mode only searches for public `catalog_id` (legacy `id` fallback); it
   never uploads data or changes index settings. Connection details are not
   included in errors or output. Repeat with the candidate configuration and
   different output names. Keep settings/version details with the experiment;
   the catalog hash identifies local catalog content, not live index identity.

3. Pool both runs, including candidate-only hits:

   ```sh
   node build/evaluation/prepareJudgments.js \
     --queries queries.json --catalog data/mcp_server_list.json --k 10 \
     --rankings baseline.json --rankings candidate.json --output pooled.json
   ```

   `--rankings` may repeat. Each run must cover exactly the query IDs, including
   `[]` for an empty result. Unknown public catalog IDs (even below K), duplicate
   results, duplicate catalog/query IDs and malformed inputs fail. Empty runs
   stay empty. Outputs must be new files; inputs and existing files are never
   overwritten. `--rankings-output` is permitted only for a single run.

4. Give assessors only `pooled.json`, not the run files. Each query's candidates
   use `candidateIds` for deterministic content-hash order independent of source
   system and original rank (JSON object keys may reorder numeric IDs); descriptions come from the frozen catalog. The pool includes
   no system labels, ranks or scores. This reduces presentation bias, but cannot
   hide recognizable server identities or guarantee unbiased judgments.
   `catalogSha256` hashes `JSON.stringify(catalog)` in original array/key order.
5. Independently replace every `null` with a grade 0–3 and retain the label.
   `null` is unjudged, not irrelevant. The existing evaluator rejects unfinished
   pools. It also requires a positive judgment for every query: for an empty or
   all-irrelevant pool, independently search the catalog for relevant items and
   add them, or explicitly exclude and report that query as not answerable by
   this metric. Never silently turn empty pools into successes or invent labels.
6. Run the existing evaluator with the reviewed pool as `--judgments`, baseline
   as `--rankings` and candidate as `--compare`. Broader catalog relevance may
   remain outside the pool, so Recall@K uses known relevant documents rather
   than claiming exhaustive catalog coverage. Do not equate offline gains with
   the satisfaction/coverage targets in #13.

### Reproducible public-catalog example

`evaluation/pooling-example/` contains **hand-authored synthetic rankings**, not
recorded engine results, and the existing illustrative query themes plus an
empty-result case. IDs are verified against `data/mcp_server_list.json`.
`playwright` appears only in the candidate browser run and must survive pooling.
The checked-in `unjudged-pool.json` is generated with:

```sh
pnpm build
node build/evaluation/prepareJudgments.js \
  --queries evaluation/pooling-example/queries.json \
  --catalog data/mcp_server_list.json --k 10 \
  --rankings evaluation/pooling-example/baseline.json \
  --rankings evaluation/pooling-example/candidate.json \
  --output /tmp/reproduced-pool.json
cmp evaluation/pooling-example/unjudged-pool.json /tmp/reproduced-pool.json
```

All grades deliberately remain null. The example validates preparation only;
it provides neither independent human labels nor measured recommendation gains.

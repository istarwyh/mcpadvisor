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

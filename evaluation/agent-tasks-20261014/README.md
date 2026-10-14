# Public Agent-task retrieval investigation (#13)

## Result and boundary

A bounded query-preparation repair improves retrieval of independently documented
expected items in an untouched 12-query validation set: **0/10 → 6/10 answerable
queries have a known positive in the top ten**. Total empty lists change from
10/12 to 1/12. Four answerable queries still miss their expected items; one
unsupported English request returns candidates both before and after the repair.
Nonempty retrieval is not automatically correct retrieval.

This is an actual isolated Meilisearch 1.15.2 experiment over all **212 records**
in this repository snapshot, not the entire MCP ecosystem. It executes the
actual query-planner source and mirrors application document/settings mapping.
It does **not** execute the whole provider/application or measure real-user
satisfaction, business outcomes, statistical significance, full-corpus recall,
precision, or nDCG. Public scenarios and expected items are AI-authored and
source-backed, not human judgments or user logs.

The application also queries other providers and merges/reranks their candidates.
A raw Meilisearch empty list must not be described as an empty end-to-end response.
The fix does not alter index settings, embedding services, credentials or ranking
rules, and has not been deployed.

## Diagnosis and repair

Previously the provider concatenated taskDescription, keywords and capabilities,
with the prose first. The handler and SearchService did not extract keywords or
translate this input. Meilisearch processes a bounded query word budget; its
`last` matching strategy progressively removes trailing terms. In real-engine
controls, `PostgreSQL` and `PostgreSQL unfindableprefix` returned the expected
database items, while `I need PostgreSQL`, `unfindableprefix PostgreSQL` and
`我需要 PostgreSQL` returned nothing. Merely switching field priority did not
address this failure. `frequency` recovered some controls but returned unrelated
results for a Chinese database query, so it was not adopted.

The new planner preserves short literal searches, moves explicit/named product
terms first, filters linguistic/catalog filler, selects corpus-supported lexical
terms and uses a finite Chinese capability glossary. Prepared queries retain
`last`, including on older engines. Known product exclusions conservatively
abstain; unsupported distinctive/product-specific names remain anchors. Empty
or punctuation-only prepared input never becomes a placeholder search.

This is not full translation or constraint understanding. Unknown ordinary proper
nouns and indirect negation remain incomplete; rare-word heuristics can select
an incidental term. Quoted multiword capabilities can tighten matching. The
corpus has only four descriptions containing Han characters. These limitations
are visible in the misses below; the glossary was not expanded after validation.

Official mechanism references:
- [Matching strategies](https://www.meilisearch.com/blog/matching-strategy)
- [Search API word budget](https://specs.meilisearch.dev/specifications/text/0118-search-api.html)
- [Frequency introduced in v1.9](https://www.meilisearch.com/blog/meilisearch-1-9)

## Frozen experiments

1. **Original field-priority experiment:** `queries.json`, `rubric.md`,
   `protocol.json`, `engine-run/`, `observations.json`. A separate author prepared
   24 bilingual Agent-developer/user queries, split by family into 16 development
   and eight holdout cases. All baseline/candidate rankings were identical;
   both had 23 empty lists. The independent pooled relevance assessment was not
   completed, so this remains an unscored negative result. The old files are
   unchanged. Its holdout has now been observed and is no longer untouched.
2. **Observed regression replay:** `query-fix-protocol.json`, `query-fix-run/`.
   The frozen new planner reduces empty lists from 23/24 to 4/24. All four
   deliberately unsupported cases stay empty. Many other returned items still
   need independent relevance assessment; no relevance gain is inferred from
   these counts alone.
3. **Independent fresh validation:** `fresh-validation.json`,
   `fresh-validation-sources.md`, `fresh-query-fix-protocol.json`,
   `fresh-query-fix-run/`, `fresh-query-fix-report.json`. A different author froze
   12 queries in six new bilingual families and source-backed expected items
   before the implementation agent saw them. The planner was independently
   reviewed and frozen at SHA-256
   `022b39b3a494f1ae18d6061fc321d5def530df3aaafdbbcecf0fe70007cad4e8`
   before opening/running this set. It was not retuned afterward.

Fresh known-positive hits: Prometheus Chinese, Postman English/Chinese, Figma
English/Chinese, and Home Assistant English. Misses: Prometheus English, Home
Assistant Chinese, and dialogue-to-audio English/Chinese. The unsupported Strava
English task remains nonempty, while Chinese stays empty. See per-query IDs and
raw rankings rather than treating the aggregate as a comprehensive quality score.

By audience, known-positive hits are 5/6 developer queries and 1/4 user queries;
English and Chinese each hit 3/5 answerable queries, with different family misses.
These are six families expressed in two languages, not 12 independent tasks.
See `RESULT_REVIEW.md` for independent source-based review of the misses.

The fresh gate requires increased known-positive-hit count, no loss of an
already-hit query, and no newly nonempty unsupported query. It passes for this
small set, but baseline had zero known-positive hits, so its regression evidence
is weak. This gate only supports review of a bounded recall repair; it does not
satisfy the original ranking-promotion gate or close #13.

## Reproduction and evidence binding

Prerequisites: Node 22.13+ and official Meilisearch 1.15.2. Start a new disposable
engine on numeric loopback with analytics disabled; never use production. The
capture refuses an existing output directory, applies the protocol's searchable
attributes, executes the frozen planner in query-preparation mode, and records
actual settings, run hashes, input hashes, source hash and a cleanup journal.
A manifest is marked complete only after cleanup succeeds. Ambiguous creation
responses are journaled and not blindly deleted; collisions are never treated as
owned indexes. If a capture fails, retain the journal and inspect it before retry.

```sh
meilisearch --http-addr 127.0.0.1:17713 \
  --db-path /tmp/mcp-agent-eval-new-data --no-analytics
# After health is available, in the same allowed process/network environment:
node scripts/evaluation/capture-agent-task-engine.mjs \
  evaluation/agent-tasks-20261014/fresh-validation.json \
  data/mcp_server_list.json \
  evaluation/agent-tasks-20261014/fresh-query-fix-protocol.json \
  /tmp/mcp-agent-eval-new-run
node scripts/evaluation/report-known-positive-engine.mjs \
  evaluation/agent-tasks-20261014/fresh-validation.json \
  /tmp/mcp-agent-eval-new-run/baseline.json \
  /tmp/mcp-agent-eval-new-run/candidate.json \
  data/mcp_server_list.json /tmp/mcp-agent-eval-new-run/manifest.json \
  evaluation/agent-tasks-20261014/fresh-query-fix-protocol.json \
  /tmp/mcp-agent-eval-new-report.json
node --test scripts/evaluation/*.test.mjs
# Stop your disposable engine afterward.
```

Use `queries.json` plus `query-fix-protocol.json` to replay the observed regression
set, or `queries.json` plus original `protocol.json` for the old field-priority
experiment. Never overwrite recorded runs. Hashes named `*ByteHash`/`*Sha256` are
raw bytes; parsed-input/run hashes use JSON.stringify. Reports bind queries,
corpus, rankings, protocol, mode and captured settings. The old legacy manifest
predates this stricter reporting contract and is retained as historical evidence.

For a later fully graded experiment, independently complete every pooled grade
and supplement relevant catalog items for empty results, then use
`report-agent-task-engine.mjs`. Grade-1 weak matches cannot mask losses of
useful grade-2/3 items. Unsupported tasks are reported separately, not silently
excluded or counted as perfect nDCG. Do not invent missing labels.

## Verification

See `STATUS.md` for exact local checks and remaining application/CI limitations.
The recorded runs removed their temporary indexes and the final engine index
list was empty. No production index/configuration was changed.

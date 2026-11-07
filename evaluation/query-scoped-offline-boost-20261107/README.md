# Query-scoped offline product boost

Related to issue #13. Previously every offline text search raised RedNote
candidates to at least 0.8, even when the query did not mention RedNote. After
weighting this injected a 0.56 candidate into unrelated searches such as an
unknown product query. The boost now requires an existing RedNote keyword in
both the query and candidate metadata.

This does not change weights, product evidence filtering, vector matching,
exclusions, catalog data or external providers. The existing alias recognition
is retained; this is not a new intent parser and does not solve negation or
unknown-product detection in general. Similarity from ordinary lexical/vector
matching can still produce false positives. It is not a broad relevance uplift
claim and does not complete issue #13.

The focused regression isolates the provider's text/merge paths using controlled
zero-similarity catalog rows and empty vector hits. It tests unrelated queries,
all existing aliases, a valid unrelated product and query-order isolation. Real
offline catalog coverage is a separate suite using SimpleEmbeddingProvider,
not a downloaded semantic model or human relevance judgments.

## Evidence and validation

`replay.json` records the same 16 existing public probes plus three diagnostic
queries before and after this change, against the real 212-row catalog through
SearchService with the deterministic SimpleEmbeddingProvider. Both runs
explicitly disabled semantic model loading; these are not blind holdout labels
or production measurements. Unknown `zzqxv` and weather queries change from two
boosted social results to no matches; daily task queries now rank Google Tasks
and Todoist first. Ordinary matching still produces false positives, including
some mixed-product probes. The Postgres diagnostic still has unrelated results.

The isolated regression fails 4 of 9 cases on the baseline and passes all 9 with
the fix. The separate real-catalog regression passes 3 cases. Validation:

- Full Vitest: 414 passed, 12 skipped, 20 todo.
- Offline suites: 29 passed, 1 skipped.
- Evaluation and e2e script unit tests: 51 passed.
- Protocol tests: 13 passed.
- `pnpm run check`: passed with 158 existing lint warnings.
- `pnpm run build` and test TypeScript check: passed.

No hosted gateway, fresh semantic model, Meilisearch integration, npm release or
production deployment was verified by this offline-only change.

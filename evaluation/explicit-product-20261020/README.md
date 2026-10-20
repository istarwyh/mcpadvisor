# Complete explicit product phrases

Related to [issue #13](https://github.com/istarwyh/mcpadvisor/issues/13).
This bounded change extends the existing product-evidence check to complete
multiword names and Chinese `专用` requests. The wider relevance roadmap remains
open.

## Behavior

- Parse one explicit product phrase from the query, independently of the catalog
  and returned candidates. Preserve the entire name, including unknown names:
  `Google Drive`, `AWS Cost Explorer`, `Home Assistant`, and `知舟工单 Pro` must
  not become a suffix-only or generic requirement.
- Keep Latin/mixed-script multiword retrieval anchors quoted. Preserve the prior
  corpus-based lexical ordering for Han-only names; prepending a broad product
  mention can admit weaker task matches through Meilisearch's `last` relaxation.
- Apply the same complete-phrase metadata check to direct Meilisearch results and
  to all SearchService provider groups before ranking, deduplication, top-k, and
  professional-reranker success/failure paths.
- Check ID, title, description, individual categories and individual tags.
  Description-only evidence supports Firestore/Firebase and the Home Assistant
  display-title mismatch. Do not combine words from unrelated fields/tags, and
  do not treat URLs alone as evidence. Retain surviving objects and scores.
- Preserve generic English modifiers and the existing finite Chinese capability
  glossary. Common request lead-ins, the Chinese determiner `一个`, sentence
  boundaries and later generic adjuncts must not become part of a product name.

A metadata mention is **not proof of dedicated functionality**, task suitability,
security, or a complete integration. This change does not add Boolean conjunction
or exclusion semantics, aliases, translation, a new model, ranking weights,
index settings, catalog changes, or a new provider architecture.

The grammar is intentionally bounded. Complex/ambiguous prose, exclusions,
alternatives, multiple mandatory products and unsupported punctuation remain
outside this slice. Product names that are ambiguous with request grammar should
be explicitly quoted, for example `"Need for Speed"-specific`.

## Validation provenance

Baseline: `769ea22683bc7875562983b6fdb6067d95e8257d`.

The 16 public probes in `../product-evidence-20261016/public-probes.json` are
regression replays, not a fresh holdout. An independent synthetic suite was frozen
before initial implementation review. Its first evaluation exposed a Chinese
introductory-determiner bug (37/38 pure-gate cases passed). Later code review also
found request-prefix/generic-adjunct regressions and a direct-provider `小红书`
retrieval broadening. These failures were corrected with explicit regression
coverage. Results after this exposure must be described as post-unblind regression
validation, not a fresh blind result or production uplift.

See [independent review](README-review.md), [per-case results](verification-results.json)
and [check status](validation-summary.json). Final exposed retests pass 38/38 gate
cases, 16/16 diagnostic cases and 11/11 controlled service cases. All six targeted
public aggregate contracts pass; the broad quality gate still fails. The
paths are direct Meilisearch, Meilisearch-only SearchService, default aggregation
and offline-only SearchService. Ordinary-query parity is checked separately.
Synthetic output contracts do not establish human relevance, nDCG, precision,
statistical significance, satisfaction, or the numerical targets in issue #13.

## Local check results

Final Node 24.19.0 checks pass: `pnpm run check` (zero errors, 159 existing lint
warnings), build, test-project types, 402 Vitest tests, 31 evaluation-script tests,
13 protocol/startup tests, four shell regressions, 14 real-engine integration tests
and four real MCP tests. Vitest retains 12 skipped and 20 todo cases.

A separate Node 22.23.3 run passes check/build/types, the 31/13/4 script suites and
four real MCP tests. Full Vitest has 401 passes and one failure; real-engine
integration has 12 passes and two failures. The existing exact-stderr CLI tests
receive an inherited `UNDICI-EHPA` experimental proxy warning before their
expected text. The same two failures reproduce on the unchanged baseline (11
other real-engine tests pass). Warnings were not suppressed and assertions were
not relaxed. Hosted Node 22 CI is tracked separately from these local results.

## Reproduce code checks

Use the repository's Node 22 and pinned pnpm 8.15.9 with the unchanged lockfile:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm run build
pnpm exec tsc --noEmit -p tsconfig.test.json
pnpm test
node --test scripts/evaluation/*.test.mjs
pnpm run test:protocol
node --test scripts/e2e/e2e.meilisearch.test.mjs
```

For real engine checks, start disposable Meilisearch 1.15.2 on numeric loopback
and run these commands in the same network namespace. The tests own and remove
only their unique indexes:

```sh
export MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17737
pnpm exec vitest run \
  src/tests/integration/providers/meilisearch-fulltext.test.ts \
  src/tests/integration/providers/meilisearch-evaluation.test.ts \
  src/tests/integration/providers/meilisearch-judgment-pool.test.ts
node --test tests/e2e/meilisearch-mcp.test.mjs
```

The legacy `pnpm run test:e2e` Inspector wrapper was attempted but could not start:
`mcp-inspector` is not installed. Its cleanup path returned zero despite the
startup failure, so it is **not counted as a passing UI suite**. No checks,
assertions, timeout thresholds, or workflow requirements were weakened. The real
MCP protocol suite is reported separately; it is not Inspector UI verification.

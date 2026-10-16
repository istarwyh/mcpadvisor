# Offline initialization single-flight

This report preserves the initial PR snapshot. The later
[stdio repair and new verification](../offline-stdio-20261016/README.md) resolves
the stdout pollution described below. Its diagnostic-only runtime changes have
new source hashes; the original frozen evidence here is unchanged.

Related to [issue #13](https://github.com/istarwyh/mcpadvisor/issues/13).
This is a bounded concurrency repair, not a ranking/model change or completion of
that issue. Parallel vector/text first access previously loaded the 212-record
catalog twice and appended 424 entries. Concurrent callers now await one complete
load, including insertion. `clear()` waits for an in-flight insertion batch before
clearing and reloading it.

## Independent frozen holdout

The independent author read the catalog/API contract, not the candidate or prior
query suites. `holdout/FREEZE.json` records the original freeze at
2026-10-15T20:03:30Z, before candidate changes and before revealing queries. Twelve
brand-qualified known-positive queries are intentionally a small preservation
holdout, not a general semantic benchmark. The final runtime source was frozen
after independent review, before unblinding:

- Baseline: `5c13693ca7e1fc6b3bde8f4d9b050f147ba10533`.
- Frozen engine SHA256: `2e1f19714c912d1cdb68fd428fcb75ad5098975115f830e96353a75a195f4190`.
- First source/test commit: `9d20703f81ca21701da13a48275d00a517512b35`.
- Captured candidate HEAD: `a86293c9590037c79b60db2b56f8f75f34835986` (only a unit-fixture type correction after the first commit).
- Later changes affect evaluation evidence, imports and CI triggers only; runtime
  bytes remain identical. Local commit IDs identify executed snapshots and are
  not assumed to be separately published commits.

There were eight first-run processes (baseline/candidate × sequential/concurrent ×
engine/provider), no retuning or query changes. Raw files, freeze hashes, harness,
provenance and result manifests are preserved under `holdout/`.

| Surface | Known-positive Hit@5 | MRR | Concurrent initialization calls |
| --- | --- | --- | --- |
| Engine | 12/12 unchanged | 1.0 unchanged | 12 → 1 |
| OfflineSearchProvider | 10/12 unchanged | 0.548611 unchanged | 24 → 1 |

All candidate sequential top-5 identities/scores exactly preserve the corresponding
baseline sequential results. Candidate concurrent and warm outputs match those
sequential results. Warm extra initialization is zero; a separate instance still
initializes once. Redis and Pandoc remain existing provider misses. Baseline
concurrent results differ from sequential results on all twelve cases.

The raw comparators retain `pass: false`: they also count baseline concurrency
mismatches. `holdout/results/INTERPRETATION.json` explicitly separates these from
zero candidate criterion failures. Their generic wording about a fixed fallback
mode is inaccurate: natural production embedding selection was unchanged and its
actual identity was not recorded. Do not infer a model from the result values.

## Actual Meilisearch and aggregate replay

`observed-capture.json` is a fresh-build replay of the 16 already-observed PR #34
cases, using actual Meilisearch 1.15.2, its application provider, isolated
SearchService, and default SearchService with offline enabled. This is not another
blind validation. It binds complete source/build hashes and verifies unchanged
inputs. Both replay runs recorded SimpleEmbeddingProvider through existing application fallback; this does not establish the separate holdout model identity. The baseline dependency symlink appears as an untracked file; tracked
source is clean. Candidate source was clean at capture commit
`4b1d45b2984542e8f4ead7f1032760b3f6084109`.

- Default offline loader calls: 2 → 1; addEntry calls: 424 → 212.
- All 16 direct-provider and isolated-service result lists/scores are identical.
- Default aggregate results are identical except bc11 swaps the fourth/fifth
  unrelated result. Both versions still incorrectly return results for this
  unknown-product request. No positive-retention loss is observed.
- bc10 still has only one relevant service result; the accepted PR #34 limitation
  is not repaired. Exclusions and unknown-product aggregation remain unresolved.

Reproduce on two locked-dependency checkouts with a fresh local engine:

```sh
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17716 \
  node evaluation/offline-initialization-20261015/capture-observed.mjs \
  BASELINE_CHECKOUT CANDIDATE_CHECKOUT \
  evaluation/constraint-regressions-20261014/blind-suite.json NEW_OUTPUT.json
```

## Real MCP protocol evidence and limits

`mcp-capture.json` uses the full catalog, real local Meilisearch, default offline
aggregation, and actual ServerService over stdio. Four concurrent tool requests
returned responses without tool errors, with one load and 212 addEntry calls.
These are observed calls, not independent counts of successful mutations. Engine
source/build hashes match the full observed capture above.

**This is not clean default-offline protocol compliance:** unchanged debug logging
writes non-JSON lines to stdout, producing 31 parser errors. Those errors are
preserved. The existing four MCP tests pass with offline disabled and a two-record
fixture; they do not validate this default-offline logging behavior. No Inspector
UI test was run. Disposable indexes were absent after capture (`remaining-indexes.json`).

```sh
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17715 \
  node evaluation/offline-initialization-20261015/capture-mcp.mjs NEW_OUTPUT.json
```

## Verification and honest failed attempts

See `validation-summary.json`. Production build, test-project types, six new
concurrency regressions, 13 actual engine integration tests, four existing MCP
protocol tests and 35 Node/shell regressions pass. Full Vitest with one worker:
258 passed, 11 skipped, 20 todo. A prior two-worker run had one offline timeout
(257 passed); unchanged baseline offline tests subsequently pass, as does the
complete bounded rerun. This remains timing-sensitive, not a secretly relaxed test.

Independent code review found a clear-during-insertion regression in the initial
wrapper; it was fixed before holdout execution and now has a deterministic test.
The pre-fix baseline fails four of the initial five new concurrency tests. Initial
test types lacked a required fixture similarity field; corrected without runtime
changes. The first replay correctly rejected its evidence because its runner was
being hardened during execution; only the later stable replay is used. Initial
pnpm invocation used an unwritable home cache; retry used the repository's pinned
pnpm 8.15.9 and writable cache. Initial capture lint found missing explicit URL
imports; those were added without changing runtime behavior or frozen artifacts.

Pre-existing concurrent fallback-path changes and failed-load recovery semantics
remain out of scope. No new production ranking, model, global-index direction,
release or business-quality target is claimed. Issue #13 remains open.

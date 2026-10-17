# Bounded product-specific evidence gate

Related to issue #13. SearchService now requires literal candidate metadata
evidence for a clear-boundary, single Latin-token `<product>-specific` request.
The check runs before deduplication, top-k and optional professional reranking,
including their failure fallback. This stops unrelated offline recommendations
from replacing an explicitly named unsupported product.

Evidence is checked separately in ID, title, description, categories and tags.
A URL alone does not qualify. Ranking weights, surviving result objects, catalog,
index settings and transport behavior are unchanged. A metadata mention is not
proof of a dedicated integration or full task fit.

## Deliberately narrow scope

Generic task/project/privacy-specific modifiers, exclusions, alternatives,
multiple products, multiword names and unsupported qualifiers retain existing
behavior. Adjacent non-glue words also leave a query unchanged. Capitalized
boundary verbs such as `Use PostgreSQL-specific ...` are not recognized by the
conservative lowercase boundary list. Latin product evidence may adjoin Chinese
text, but Chinese product-intent understanding is not implemented.

Independent pre-unblind review rejected an earlier result-dependent multiword
expansion. The retained implementation never derives a requirement from the
returned candidate set and scope-checks every suffix before dropping generic
modifiers. The broader issue, the accepted bc10 ranking limitation and existing
formatted scores above 100% remain open; those scores are not confidence estimates.

## Frozen experiment and public projection

- Baseline: `9b409117b356e36ce157ef980493cbe1856a8ad4`.
- Independent 16-probe suite: frozen at 2026-10-16 20:06:26 UTC from the public
  212-record catalog, without reading the implementation or earlier suites.
- Original suite SHA256:
  `2d02decec84f1e79cff0da8f3fe034cbe3886c7fadf7dade5f5b74602b02ddb9`.
- Production candidate: frozen at 20:13:52 UTC as local runtime commit
  `8b073cdd68662ec06d67f7c7a7719dcc467ad3b8`.
- productEvidence.ts SHA256:
  `755453cdde77185d1914cf13e0dac0be487d4161af2b122529387fc049841d6a`.

Production was not retuned after unblinding. `public-probes.json` is a minimal
projection of the original frozen suite: all IDs, queries, accepted IDs,
expectations and reasoning are unchanged; repeated catalog metadata and authoring
provenance were removed. Its different byte hash is
`315bef16aa1d60dd73bbf89bd783c1b0d4dd0e8da1776d23170a1d619049b821`.
It is not presented as the original frozen byte sequence.

Raw execution records remain outside this public branch. Local filesystem paths,
environment diagnostics, raw stdout/stderr and duplicated catalog metadata are
not published. `verification-results.json` contains the reviewed per-case IDs,
output-contract results, relevant hashes and protocol/parity statistics. The
scripts reproduce the same queries against local disposable indexes.

These are AI-authored synthetic catalog probes, not production traffic or human
relevance labels. The broad output-contract gate remains **FAIL**.

| Path | All 16 output contracts | Targeted p01/p04 |
| --- | --- | --- |
| Direct real Meilisearch | 11 → 11 | 2/2 → 2/2 |
| Isolated SearchService | 11 → 11 | 2/2 → 2/2 |
| Default aggregate / raw MCP | 4 → 6 | 0/2 → 2/2 |
| Offline-only SearchService | 3 → 5 | 0/2 → 2/2 |

Only p01 (Slack-specific) and p04 (unsupported QuasarDesk-specific) changed in the
aggregate and offline paths. No accepted-ID loss or pass-to-fail regression was
observed. Chinese dedicated requests, multiword names, mandatory conjunctions and
several generic-task misses remain failures. Two targeted examples do not establish
broad relevance uplift, precision, nDCG, statistical significance or satisfaction.

The real engine was Meilisearch 1.15.2. The application selected
SimpleEmbeddingProvider through normal fallback. All 32 actual stdio tool
responses exactly matched formatted aggregate outputs; all 36 stdout messages
passed independent JSON-RPC validation, with zero protocol/tool errors. Disposable
indexes were removed. Other online providers and the optional professional service
were not configured in this experiment; professional filtering/fallback has unit
coverage. The raw MCP manifest omitted tsconfig.json; the service capture included
it, and all shared source/build hashes agreed.

## Checks and retained limitations

See `validation-summary.json` for exact stage status and commands.

- Final full Vitest: 291 passed, 11 skipped, 20 todo.
- Production build and test-project types passed. ESLint: zero errors, 161 existing
  warnings; source formatting passed.
- Real-engine integration: 13 passed. Existing MCP protocol: 4 passed. Raw
  default-offline/diagnostic subprocess tests: 8 passed. Node/shell regressions:
  31 + 4 passed. Independent scoped code review passed before freeze.
- Earlier full candidate runs timed out in the existing first offline RedNote
  search. The baseline full run passed 258 tests; both isolated offline runs passed
  6 with one skipped. A post-unblind, test-only mock now prevents an unused eager
  model download in the new offline-disabled unit suite. The full rerun passed,
  but this does not prove the earlier timeout's cause. Production and frozen
  quality inputs were unchanged; earlier failures are preserved in the summary.
- First raw MCP attempt hit the evaluation client's 30-second timeout during cold
  model loading. A separate evaluation-only client used 120 seconds for the
  successful retry. No application or regression-test timeout was increased.
- An initial integration selection contained eight old cases that early-returned.
  They are not counted; the final CI-equivalent three suites passed 13 real tests.
- Local Node: 24.19.0. Dependencies were reused with an identical lockfile, not
  freshly installed. The pnpm wrapper could not initialize its store; direct
  installed ESLint/Prettier equivalents passed. CI uses Node 22 and a locked fresh
  install. Packaged CLI/native sharp startup and Inspector UI were not run.

## Reproduce

Install the same locked dependencies in both checkouts. Start disposable
Meilisearch 1.15.2 on numeric loopback in the same execution/network namespace.
The first command freshly builds both checkouts; the second uses those builds.
Generated raw files are ignored by Git and should be inspected before any sharing.

```sh
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17724 \
  node evaluation/product-evidence-20261016/capture.mjs \
  BASELINE_CHECKOUT CANDIDATE_CHECKOUT \
  evaluation/product-evidence-20261016/public-probes.json NEW_CAPTURE.raw.json

MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17724 \
  node evaluation/product-evidence-20261016/capture-mcp.mjs \
  BASELINE_CHECKOUT CANDIDATE_CHECKOUT \
  evaluation/product-evidence-20261016/public-probes.json NEW_MCP.raw.json
```

Both refuse to overwrite outputs. Recheck the complete broad contract, including
known failures, rather than interpreting nonempty or newly empty results as
success. No merge, release or deployment is part of this draft.

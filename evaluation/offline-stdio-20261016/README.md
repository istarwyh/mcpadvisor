# Default-offline MCP stdout repair

Follow-up within [PR #35](https://github.com/istarwyh/mcpadvisor/pull/35), related to
[issue #13](https://github.com/istarwyh/mcpadvisor/issues/13). This closes the
protocol defect discovered in the original single-flight evaluation; it does not
complete issue #13 or change ranking, models, search configuration, or results.

## Repair

- Existing offline, configuration-loader and installation-extractor diagnostics
  retain their messages but write to stderr instead of stdout.
- Every Winston console level writes to stderr. Explicit
  `ENABLE_CONSOLE_LOGGING=true` now enables its requested destination without
  also requiring file logging. Default silence and file logging remain intact.
- No process-wide console monkey-patching or stdout filtering is used. SSE-only
  banners and intentionally stdout-producing standalone evaluation CLIs are unchanged.
- Seven subprocess regressions run in Core CI after the production build.

## Raw stdio evidence

`baseline.json` captures the previous PR head
`a7ff4e5fc1f872cd565159025e4bcd09fd3437a3`; `candidate.json` captures runtime commit
`3cd5a6919753f768ab07b5eda6cad7fc14ef320b`. Both manifests bind source/build,
catalog and harness hashes. Complete stdout and stderr bytes are retained next
to each JSON manifest. The fixture was copied into the baseline checkout without
changing its production source. Capture manifests use UTC timestamps; console
logger timestamps can use the executor's local timezone.
Commit IDs above identify executed local snapshots. Publication uses the connected
GitHub API because this cloud shell has no push credentials; its published commit
ID can differ, while the exact Git tree is verified against the local tree.
No credentials or persistent access are added.

| Observation | Baseline | Candidate |
| --- | ---: | ---: |
| Valid JSON-RPC messages (initialize/list/four calls) | 6 | 6 |
| Malformed stdout lines | 31 | 0 |
| Successful recommendation responses | 4 | 4 |
| Catalog entries loaded | 212 | 212 |

All four cold responses are exactly equal, including ordering and scores/text.
The full catalog and default `new SearchService()` offline configuration are
used. This reproducible fixture explicitly makes model fetch fail, exercising
production SimpleEmbeddingProvider fallback without a model download. It is a
protocol regression test, not a relevance benchmark or independent holdout.

The regression suite additionally exercises four concurrent requests, an
identical warm response, invalid input followed by successful discovery, full
loading exactly once, default/console/main modes, and startup messages on stderr.
Separate child processes exercise config and installation diagnostics plus all
five logger levels in default/console/file/main modes, including file contents.
Every stdout line is parsed and validated against the SDK JSON-RPC schema;
trailing incomplete output is rejected. Successful responses cannot hide bad lines.

## Actual engine and normal embedding selection

`combined-meili-mcp.json` reruns the original capture harness unchanged against
real Meilisearch 1.15.2, full-catalog MeilisearchSearchProvider and default-enabled
offline SearchService, over actual ServerService stdio. Model selection and
network behavior are not substituted in this replay. It records:

- Four responses, zero parser errors and zero tool errors.
- One actual offline loader call, 212 actual addEntry calls and 212 Meilisearch
  documents. Instrumentation counts calls, not an independent mutation audit.
- Source/build hashes unchanged during capture; runtime commit
  `3cd5a6919753f768ab07b5eda6cad7fc14ef320b`.
- No disposable indexes left (`remaining-indexes.json`).

The old harness's generic limitations text is retained verbatim; the numerical
`errors` field and new raw-stdio evidence establish the repaired channel behavior.
This does not imply new recommendation quality or successful Inspector UI coverage.

## Verification and failed attempts

- Production TypeScript build and test-project type check pass.
- Full Vitest, serial worker: 258 pass, 11 skip, 20 todo.
- Real-engine integration: 13 pass; existing real MCP protocol: 4 pass.
- New raw-stdio/config/logger subprocess regressions: 7 pass.
- Node/shell regressions: 35 pass.
- Repository lint: 0 errors, 161 existing warnings; source formatting passes.
- Independent static code/test/artifact review: no scoped blockers.
- Local runtime is Node 24.19.0; dependencies match the committed lockfile.
  GitHub CI uses Node 22 and is tracked on the published head separately.

Before the repair, all three newly added offline protocol cases failed on malformed
stdout. The separate actual `build/index.js` CLI-startup attempt failed before
`main` because this existing cloud dependency installation lacks the nested
`@xenova/transformers` sharp-linux-x64 native binding. Those experimental CLI tests
were not kept or represented as passing. ServerService startup is covered; full
packaged CLI startup remains unverified here. No unrelated dependency repair is
included.

The first local engine launch ran in a different execution network namespace from
its clients, so integration checks returned ECONNREFUSED and the initial combined
capture could not inspect/clean the index. Its failed report is retained as
`failed-combined-meili-mcp.json`; it is not success evidence. Running the disposable
engine and clients in one command fixed the environment issue; all relevant tests
and the combined replay then passed. No application change was needed for this retry.

## Reproduce

Build each checkout with its locked dependencies. For the old baseline, copy
`tests/e2e/fixtures/offline-stdio-server.mjs` from this revision into the same
relative location. Then, from the candidate checkout:

```sh
node --test tests/e2e/offline-stdio.test.mjs
node evaluation/offline-stdio-20261016/capture.mjs BASELINE_CHECKOUT NEW_BASELINE.json
node evaluation/offline-stdio-20261016/capture.mjs . NEW_CANDIDATE.json
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17718 \
  node evaluation/offline-initialization-20261015/capture-mcp.mjs NEW_COMBINED.json
```

For the last command, run a disposable local engine on that loopback address in
the same execution/network namespace. No existing or remote index is used.

Remaining issue #13 limits are unchanged: English exclusions, unknown-product
false positives, the accepted bc10 aggregate-ranking limitation, independent
relevance labels and real-user feedback remain open. Inspector UI was not run.

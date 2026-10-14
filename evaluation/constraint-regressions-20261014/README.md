# Query-constraint regression follow-up

Related to issue #13 and the post-merge review of PR #33. The proposed production
change is limited to two review fixes:

1. Do not treat ordinary `task-specific`, `project-specific` or `privacy-specific`
   modifiers as products. Keep literal quoted searches, nearby complete known names,
   and explicit unknown-product safeguards. Ambiguous unknown `-specific` names
   abstain rather than silently degrading into generic recommendations.
2. Capture the actual checkout revision, dirty state and source byte hashes. Reject
   source changes during capture and mismatched report provenance. Old immutable
   artifacts are identified as `legacy-unverified`.

The initial `except for` / `other than` expansion was rejected: it lost positive
GitLab/Discord results when the request also excluded a different product. That
production change has been removed. The initial independent negative experiment
is preserved below; exclusion handling remains a known issue, not a solved claim.

Review references:

- https://github.com/istarwyh/mcpadvisor/pull/33#discussion_r4268055156
- https://github.com/istarwyh/mcpadvisor/pull/33#discussion_r4268055168
- https://github.com/istarwyh/mcpadvisor/pull/33#discussion_r4268055181

Official implementation references:

- https://www.meilisearch.com/blog/matching-strategy
- https://specs.meilisearch.dev/specifications/text/0118-search-api.html

Meilisearch's `last` strategy can progressively relax trailing terms, so anchoring
an excluded product is unsafe. This repair keeps the existing engine settings and
strategy. It retains the existing conservative Meili-only abstention on recognized
product exclusions; it does not implement a general Boolean intent parser or change
other providers.

## Initial independent validation and withdrawal

`blind-suite.json` was authored independently using the fixed public catalog,
without reading the planner or previous holdouts. Its original bytes are preserved.
The file's frozenAtUtc is a minute-level marker; the actual file/hash freeze completed
at 20:07:55 UTC, before candidate freeze and unblinding.

- Suite SHA256: `38aebde39de98272aa67215811b00afb8b794204cb944d42ac6bade47e09e81a`
- Candidate planner SHA256 frozen after independent review, before unblinding:
  `bd9d12389364720bdf502f2d6633dbac907995f14eb989aea8314999541177bc`
- Baseline: `d5ec5356d509617baaffbda8eaf77d077963dca7`
- 16 probes: 10 core, 5 preservation smoke and 1 exploratory near-spelling case.
- The initial frozen planner was not retuned before the independent evaluation.
  It failed positive-retention gates and was withdrawn. `initial-capture.json` and
  `initial-report.json` preserve that negative result (candidate `a45aef420527fd117d39b4d28c1adec694c7ddb9`).
- The safety-subset planner SHA256 is
  `5348aaed138475a9af467d0859aa57b22f5a5f46f32aa622bbe46ac70d5a43ef`.
  Reusing these 16 cases is explicitly an **observed regression replay**, not fresh
  independent validation. No new blind-test claim is made.
- The original baseline dirty flag reflects only an untracked dependency symlink;
  the tracked diff was empty and the planner source matched the baseline revision.
- Initial runs used `SimpleEmbeddingProvider` through existing application fallback.
  The offline path logged 424 entries for a 212-record source, showing duplicate
  initialization; its results are reported as observed, without changing that code.
- Initial runtime logs have checkout paths normalized for portability. The report
  retains the original log hash. The initial raw capture retains its exact bytes.

Initial result over 15 non-exploratory probes: provider 11→12, isolated service
9→12, default service 9→10. These counts do not establish acceptance: the provider
lost positive targets in bc03/bc04; default aggregation still returned excluded
products and unrelated results for unknown products. This is why the exclusion
change was removed instead of treating the net count as a success.

## Replay

Install the same locked dependencies in both checkouts. The runner performs a fresh
TypeScript build itself and checks source/build snapshots before and after capture. Start a
fresh Meilisearch 1.15.2 bound to numeric loopback, without production data. Then:

```sh
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17714 \
  node evaluation/constraint-regressions-20261014/capture.mjs \
  BASELINE_CHECKOUT CANDIDATE_CHECKOUT \
  evaluation/constraint-regressions-20261014/blind-suite.json NEW_OUTPUT.json
```

The runner records actual source state, fresh-build compiler version, all compiled
file hashes and returned service scores. It checks the suite and planner hashes, shares the 212-record catalog,
uses the compiled application provider and controller, and removes only indexes it
created. It separately captures direct Meili (up to ten raw provider results), actual
SearchService with offline disabled (top five), and the default service with offline
fallback enabled (top five). Per-suite judgments use the first five direct provider
results for positives and all returned provider results for forbidden products.
Other online providers and optional professional reranking are not configured.
Runtime stderr should be retained for model-fallback warnings.

The standalone `scripts/evaluation/capture-agent-task-engine.mjs` remains an
engine-only experiment, whose original baseline is the raw query. Its provenance
fix is tested independently; do not confuse its baseline with this previous-planner
application comparison.

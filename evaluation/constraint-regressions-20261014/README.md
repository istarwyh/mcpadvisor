# Query-constraint regression follow-up

Related to issue #13 and the post-merge review of PR #33. This bounded change
addresses three review findings, without claiming completion of the quality roadmap:

1. Do not turn `except for` / `other than` product exclusions into required positive
   anchors. Support common whitespace/quote forms and preserve positive-only
   expressions such as `nothing other than X`.
2. Do not treat ordinary `task-specific`, `project-specific` or `privacy-specific`
   modifiers as products. Keep literal quoted searches, nearby complete known names,
   and explicit unknown-product safeguards. Ambiguous unknown `-specific` names
   abstain rather than silently degrading into generic recommendations.
3. Capture the actual checkout revision, dirty state and source byte hashes. Reject
   source changes during capture and mismatched report provenance. Old immutable
   artifacts are identified as `legacy-unverified`; their historical sourceCommit
   metadata is not retroactively presented as verified.

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

## Frozen independent validation

`blind-suite.json` was authored independently using the fixed public catalog,
without reading the planner or previous holdouts. Its original bytes are preserved.
The file's frozenAtUtc is a minute-level marker; the actual file/hash freeze completed
at 20:07:55 UTC, before candidate freeze and unblinding.

- Suite SHA256: `38aebde39de98272aa67215811b00afb8b794204cb944d42ac6bade47e09e81a`
- Candidate planner SHA256 frozen after independent review, before unblinding:
  `bd9d12389364720bdf502f2d6633dbac907995f14eb989aea8314999541177bc`
- Baseline: `d5ec5356d509617baaffbda8eaf77d077963dca7`
- 16 probes: 10 core, 5 preservation smoke and 1 exploratory near-spelling case.
- No planner tuning after unblinding. The raw results retain failures and distinguish
  empty-safe results from useful answers.

## Replay

Build baseline and candidate checkouts with the same locked dependencies. Start a
fresh Meilisearch 1.15.2 bound to numeric loopback, without production data. Then:

```sh
MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17714 \
  node evaluation/constraint-regressions-20261014/capture.mjs \
  BASELINE_CHECKOUT CANDIDATE_CHECKOUT \
  evaluation/constraint-regressions-20261014/blind-suite.json NEW_OUTPUT.json
```

The runner checks the frozen suite and planner hashes, shares the 212-record catalog,
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

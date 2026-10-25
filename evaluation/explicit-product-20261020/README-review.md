# Independent bounded product-query validation

Related to issue #13. This evaluates one explicit, complete `<product>-specific`
or `<product> 专用` requirement, not arbitrary natural-language intent or dedicated
integration capability. The broad output-contract gate remains **FAIL**.

## Provenance and what changed during review

- Baseline: `769ea22683bc7875562983b6fdb6067d95e8257d`.
- The new synthetic suite was frozen at `2026-10-20T20:07:14.753296Z`, before
  inspecting candidate code/results. Its 38 gate cases, 12 catalog contracts and
  five ordinary-query parity probes are preserved in `independent-probes.json`.
- SHA256: `7c7fde7cd7ba694d4d156543277f611510196d33ed8e445fefcee31ad389d994`.
- The older 16 public probes are **regression replay**, not new holdout evidence.
- Initial gate result: **15/38 baseline → 37/38 first frozen candidate**.
  Review found a Chinese determiner incorrectly included in the product name.
- After unblinding, additional diagnostics found English request lead-ins being
  swallowed into product names, generic-adjunct handling shortening full names,
  and known Chinese capability terms misclassified as products. These were fixed.
- An initial direct-provider p03 regression added a hot-news integration to a note
  access request. Preserving the prior Han lexical ordering and applying the
  complete metadata-evidence gate to direct results restored the earlier result.
- Final exposed retest: **38/38** original gate cases and **16/16** separately
  recorded diagnostics. These are not fresh blind validation after retuning.

`verification-results.json` preserves baseline, first candidate and final results,
including initial failures and intermediate diagnostic failures. It uses public
catalog data and synthetic fixtures, not private user queries or human labels.

## Final real-engine comparison

Real Meilisearch 1.15.2, 212 unchanged catalog records. SearchService default limit
5 and similarity thresholds were unchanged. Normal model fallback selected
SimpleEmbeddingProvider. Each run used its own disposable index, then removed it.

| Contracts                   | Direct provider | Isolated service | Default aggregate | Offline only |
| --------------------------- | --------------: | ---------------: | ----------------: | -----------: |
| New 12, baseline → final    |          7 → 10 |          11 → 11 |            0 → 11 |        0 → 9 |
| Public 16, baseline → final |         11 → 11 |          11 → 11 |            6 → 12 |       5 → 10 |

All six targeted public aggregate cases pass: p02, p05, p09, p10, p11 and p12.
No baseline pass-to-fail contract was observed in the final four-path replay.
All five ordinary-query results, including scores and order, were byte-identical
in all four paths. Independent controlled SearchService top-k/professional-ranker
success/failure checks passed **11/11** final, versus **5/11** baseline.

These counts are illustrative output contracts. They are not precision, nDCG,
satisfaction, statistical significance or production quality uplift.

## Remaining failures and limits

- c04 Confluence is retrieved at similarity 0.2222, then removed by the existing
  service minimum of 0.4. It is a real remaining positive-retention failure.
- Direct c03/c10 include a record mentioning Google Maps without demonstrating the
  full requested route-planning capability. Metadata evidence is not task-fit proof.
- Public p03 aggregate/offline still include a hot-news server alongside RedNote.
  Both mention the product, but only the latter documents the requested note access.
- Offline-only misses remain, including some valid description-only evidence.
- Conjunctions, exclusions, arbitrary paraphrases, adjective-prefixed requirements
  and general Boolean reasoning are not implemented by this bounded grammar.
- Existing generic-query retrieval/ranking failures remain. No ranking weights,
  catalog data or index settings were changed by the product-query repair.
- The evaluator did not run raw MCP stdio replay, other online providers, an actual
  remote professional reranker, packaged CLI/native sharp startup or Inspector UI.
  Repository-wide tests and protocol checks are reported separately by the PR.

## Source binding

All final evaluator checks used these production source hashes:

| File under src/services/core/search | SHA256                                                           |
| ----------------------------------- | ---------------------------------------------------------------- |
| meilisearchQuery.ts                 | d5093c6a83840395c27a861559955757b6a2a9b66876984f0c20f187cdccd05d |
| productEvidence.ts                  | d59cdac789b464ecddde0ac2e29f00d366e5010c127a85c171883444157a8fdb |
| MeilisearchSearchProvider.ts        | 8690f45b0a00d0b07199a812c55744f02e29edd00ba3ebe79e7076655ff83476 |

Catalog SHA256:
`c323f16b1a24075f21655fb15780db9f4af3e105bc9a40b698f2c9b2e4205e50`.
Locked dependency file SHA256:
`078de757230eaa74e847442186dabd2c4794426f80c06d4385e9d041df553fc1`.
Evaluation used Node 24.19.0 and TypeScript 5.8.3. A fresh pinned pnpm 8.15.9
frozen install was reused by evaluator clones. Source files were rechecked after
fresh compilation and capture. Frozen runtime snapshots were uncommitted;
production file hashes, not the baseline HEAD alone, identify each candidate.

## Reproduce

Install locked dependencies in both checkouts. Start a disposable Meilisearch
1.15.2 instance on numeric loopback. If process/network namespaces are isolated,
start the engine and capture in the same shell. These tools create/remove only a
random evaluation index and refuse to overwrite output files.

```sh
node evaluation/explicit-product-20261020/gate-check.mjs \
  CHECKOUT evaluation/explicit-product-20261020/independent-probes.json NEW_GATE.json
node evaluation/explicit-product-20261020/diagnostic-check.mjs \
  CHECKOUT evaluation/explicit-product-20261020/diagnostic-probes.json NEW_DIAGNOSTICS.json
node evaluation/explicit-product-20261020/capture.mjs \
  CHECKOUT evaluation/explicit-product-20261020/independent-probes.json \
  NEW_OUTPUT_PREFIX http://127.0.0.1:17736
node evaluation/explicit-product-20261020/service-check.mjs \
  CHECKOUT evaluation/explicit-product-20261020/independent-probes.json NEW_SERVICE.json
```

Run capture before service-check so compiled code is freshly bound to the source.
Run once per checkout, using separate new output names. The capture includes all
new catalog probes, the unchanged public 16, and five ordinary parity queries.
Inspect local raw diagnostic output before sharing it; only the compact reviewed
projection is checked into this evaluation artifact.

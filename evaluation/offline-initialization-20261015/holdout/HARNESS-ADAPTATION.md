# Harness adaptation, before execution

The direct-engine cohort implements the frozen protocol through supplied public API signatures. Query vectors use production getTextEmbedding and normalizeVector; catalog rows and embeddings are never mocked. The initialization gate wraps OfflineDataLoader.loadFallbackDataWithEmbeddings and calls the original method with its original receiver and arguments.

A supplementary provider cohort uses the same frozen queries and catalog, OfflineSearchProvider({fallbackDataPath, minSimilarity:0.1}).search(query), sequentially and concurrently in fresh processes. Since provider options expose no result limit, retain returned_count and evaluate its first five results. Compare provider candidate against provider baseline, never against the direct-engine rankings. The provider cohort is explicitly supplementary, added at the coordinator's request before execution. Neither the frozen fixture nor original protocol changes.

Four processes per revision: engine sequential, engine concurrent, provider sequential, provider concurrent. No retry or query selection after seeing results. Harness/API failures are reported before any adapter correction and rerun. Record environment/provider diagnostics in log files.

# Independent source-based result review

A separate AI scenario author rechecked the frozen expected items and actual
rankings after the candidate was frozen and measured. No queries or relevance
labels were changed. This is AI review, not human annotation.

All six successful queries retrieve a pre-labeled grade-3 item at rank 1.
Known-positive hit counts are 0/10 → 6/10; developer queries hit 5/6, user queries
1/4; English and Chinese each hit 3/5 answerable queries. The sample comprises
six bilingual families, not 12 independent tasks.

The four answerable misses all return nonempty lists:
- FV-D01-en: `time`, not the expected `prometheus`. The Time server documents
  current-time/timezone conversion, not PromQL metric queries.
  [Time documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/time)
- FV-U01-zh: `promptx` and `rednote-mcp`, not `home-assistant`. Their documented
  role/tool-development and Xiaohongshu-access features do not establish
  ready-made home-light state/control support.
  [PromptX](https://github.com/Deepractice/PromptX),
  [RedNote](https://github.com/ifuryst/rednote-mcp)
- FV-U02-en: `virtual-location-google-street-view-etc`, not the expected speech
  tools. Its documented travel/image functionality does not establish
  text-to-speech output.
  [Project documentation](https://github.com/mfukushim/map-traveler-mcp)
- FV-U02-zh: `promptx`; general extension potential is not documented ready-made
  text-to-audio capability.

For the unsupported Strava English task, baseline returns four items and the
candidate returns `devrev`. Its documented knowledge/object access does not
provide the requested Strava rides/GPS integration.
[DevRev documentation](https://raw.githubusercontent.com/kpsunil97/devrev-mcp-server/main/README.md)
The Chinese unsupported task stays empty. The report's
`newlyNonemptyUnsupportedQueries` counts queries switching from empty to nonempty;
it does not assert that returned IDs are unchanged or that abstention is solved.

Expected items are non-exhaustive; unjudged candidates remain unjudged. These
observations do not create complete precision or nDCG labels. Home Assistant
support assumes a compatible hub. Hugging Face Spaces' grade-2 expected item has
project-succession caveats documented in the frozen sources; none of the six
successful hits relies on that item.

Because baseline has no known-positive hit, the no-loss gate is trivially
satisfied on this set. The observed benefit supports only a bounded Meilisearch
branch repair entering code review, not general natural-language search quality
or production acceptance. User capability searches and unsupported-task handling
remain clear follow-up gaps requiring a newly frozen validation set.

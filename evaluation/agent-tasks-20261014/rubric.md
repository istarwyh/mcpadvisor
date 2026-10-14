# MCPAdvisor public-task development benchmark: 2026-10-14

## Status and scope

- Label: **illustrative**.
- Provenance: **Agent-authored public scenarios; not user logs**.
- These are synthetic discovery needs for agent developers and agent users. They are not observed customer demand, business relevance labels, an unbiased traffic sample, or proof of product quality.
- Candidate corpus: exactly the 212 existing records in `data/mcp_server_list.json`. No new servers, document chunks, or external search results may enter the candidate corpus. Public documentation may support judgments about an existing record.
- Corpus file SHA-256: `c323f16b1a24075f21655fb15780db9f4af3e105bc9a40b698f2c9b2e4205e50`.
- Queries frozen at **2026-10-14T06:30:33Z**, before running MCPAdvisor retrieval on these scenarios or viewing candidate configurations or rankings. The task designer read only the public catalog and primary public capability documentation. No candidate judgments have been made in these files.
- Frozen `queries.json` SHA-256: `e5223a0ebffe7a74a893c00c7a24ef79ac1e438f96c038ca73ae628cd21294bd`.

## Sampling and split contract

There are exactly 24 queries: 12 developer, 12 user, 12 English and 12 Chinese. They form 12 bilingual semantic pairs. Both languages retain the same task and constraints. They are correlated observations, not 24 independent tasks.

Development has 16 queries from eight families: D01–D04 and U01–U04. Holdout has eight queries from four families: D05–D06 and U05–U06. Development contains four queries in each audience/language combination; holdout contains two in each combination. Every family belongs wholly to one split. Never move a translated variant into the other split.

Twenty queries are expected answerable. Four queries, from D04 and U06, are intentionally unsupported within this frozen corpus and their explicit direct-integration constraints. Development and holdout each contain one unsupported bilingual family.

The mix includes broad needs with several plausible implementations (rendered web content, local-note recovery, museum research), capability-focused requests (selective schemas, version-matched documentation), exact-product needs (PostgreSQL, Google Calendar, Docker), and explicit no-match cases. This is a coverage-oriented small development set; its proportions do not estimate real-world demand.

Freeze the complete query text, metadata, family assignments and this rubric before creating evaluation rankings or labels. Tune retrieval, weights, thresholds and prompts using development only. Keep holdout results out of selection; evaluate the selected configuration on holdout after selection is final. If holdout feedback influences another change, that split is no longer untouched holdout. Record a new experiment and use a newly designed holdout for future selection claims.

## Unit of relevance

Judge one **query × catalog record**, using the query's actual goal and constraints. Several records can deserve the same high score. Do not make one preselected server the only acceptable answer. The source list below documents why the scenario is plausible; it is not an answer key or exhaustive positive list.

Inspect primary maintainer documentation: README tool definitions, documented inputs/outputs, supported backend, deployment requirements and restrictions. Use the catalog to identify the record. Do not infer a capability from a product name, a tag, a broad marketing claim, another server's capability, or theoretical programmability alone. A generic executor is not automatically a direct integration with every product.

Use documented capability, never source rank, retrieved position, retrieval score, candidate configuration, popularity, GitHub stars, or which system supplied the record. A later judge should receive candidate records in a fixed neutral or randomized order with retrieval metadata removed. Record concise reasoning and a supporting primary-source URL for each nontrivial judgment, including unmet constraints. Missing or inaccessible documentation means evidence is incomplete; distinguish that from a verified lack of capability. Do not silently treat unjudged items as irrelevant.

## Relevance scale

- **0 — Irrelevant:** no documented capability that meaningfully advances the requested task; wrong domain or product with no usable connection to the need.
- **1 — Partial / weak:** tangential or preparatory help, a substantial missing core capability, a speculative/custom integration, or only an explicitly excluded route. This does not constitute a useful task match.
- **2 — Useful, but constraints unmet:** directly helps accomplish a material part of the core task, but one or more requested capabilities, scope conditions or output requirements remain unmet. State the gap; do not conceal it behind broad relevance.
- **3 — Strong:** documented capabilities satisfy the intent and all material stated constraints, with ordinary supported setup. No invented extension, unsupported guarantee, or excluded workaround is needed.

A high score means a documented capability match, not verified execution, operational reliability, security certification, ongoing maintenance, or access already granted. Ordinary installation, permitted credentials and backend setup are acceptable unless the query rules them out. Do not require entirely read-only servers when the query only requires a non-mutating workflow. Extra write tools do not disqualify a server that can perform the requested observations without using them.

For unsupported queries, evaluate each record honestly under the same scale. An explicit no-match/abstention is the expected system-level behavior when no qualifying documented record exists. A plausible neighboring technology or generic tool is not a strong match. Do not fabricate a positive to make ranking metrics calculable; report unsupported-query false-positive and abstention outcomes separately. If later primary evidence establishes a genuine satisfying in-corpus record, flag a benchmark defect and version the correction with evidence; do not relabel silently after seeing which candidate benefits.

`critical: true` is a preregistered audit subset, not a label weight: D01's reporting/read-only context, D05's observation-only diagnosis, and the explicit-integration restrictions in D04/U06 need particular scrutiny for harmful scope expansion or false positive recommendations. Report failures in this subset separately. The flag does not override the 0–3 scale.

## Family-level judging reminders

- D01 / postgres_reporting: existing PostgreSQL connectivity, schema inspection and SELECT-style reporting with a supplied read-only role. No data export requirement. Do not confuse support for read-only queries with proof of a security boundary.
- D02 / rendered_web_content: obtain rendered page content suitable for Markdown comparison. Search snippets or URL discovery alone leave the main need unsatisfied. No particular scraping vendor is required.
- D03 / selective_openapi_exploration: incremental operation discovery plus parameter/body/response inspection. Merely calling an arbitrary HTTP endpoint is different from exploring its schema.
- D04 / native_kafka_broker: built-in Kafka topic listing and direct broker message consumption. Shell, browser, generic gateway and newly written adapter routes are expressly excluded.
- D05 / docker_failure_observation: local Docker container listing, recent logs and runtime statistics. The workflow can avoid mutations even if the server offers other tools.
- D06 / version_matched_library_docs: documentation and examples tied to a named library/version. Generic web search without version-aware evidence only partially addresses the need.
- U01 / recover_local_note_context: search note contents, retrieve original Markdown notes and allow local storage. Filename-only search and mandatory cloud migration leave gaps. No particular note application is specified.
- U02 / google_calendar_availability: inspect both Google calendars and obtain enough availability/event data to find an unoccupied half hour. The agent can reason about overlaps; no invitation should be necessary.
- U03 / museum_art_references: museum collection discovery, author/date metadata and inspectable images. The agent supplies the presentation reasoning. Image generation is not collection retrieval; image access does not imply permission to republish.
- U04 / local_xlsx_improvement: a local XLSX edit path for formulas, currency formatting and an in-workbook chart without requiring installed Microsoft Excel. Returning a standalone chart alone is incomplete.
- U05 / dutch_rail_disruptions: live Dutch train information including departures, platforms and disruptions. General maps and route estimates are insufficient substitutes for rail service status.
- U06 / dedicated_zoom_recordings: a dedicated Zoom server with already documented recording-list and download-link tools. The scenario assumes an eligible recording plan; browser, general gateway and custom-extension routes are excluded.

## Verified task-design sources

The following primary pages were opened and inspected through web access on **2026-10-14 UTC**. They establish capability vocabulary and realistic tasks, not grades. These live URLs are not immutable documentation snapshots; record a version/date again if subsequent judging finds changed capabilities. Documentation lookup does not expand the 212-record corpus.

1. D01: [Archived reference PostgreSQL server](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres). Documents table schemas and SQL in read-only transactions. The catalog points to the original umbrella repository; this archived location preserves the reference component. Archive status must not be disguised as a current maintenance endorsement.
2. D02: [Firecrawl MCP maintainer README](https://github.com/firecrawl/firecrawl-mcp-server) and [Firecrawl scrape documentation](https://docs.firecrawl.dev/features/scrape). The original catalog repository URL redirects to the maintained repository. Documents page extraction, structured/Markdown content and page interaction. Do not assume that every API feature is exposed as an MCP tool.
3. D03: [OpenAPI schema server README](https://github.com/hannesj/mcp-openapi-schema). Documents endpoint discovery and selective parameter, request-body, response-schema and component tools.
4. D04: [Apache Kafka quickstart](https://kafka.apache.org/41/getting-started/quickstart/). Establishes Kafka topics and producer/consumer broker operations. The complete catalog has no literal Kafka occurrence. This absence is corpus evidence, not proof that Kafka MCP servers do not exist elsewhere.
5. D05: [Docker MCP README](https://github.com/ckreiling/mcp-server-docker). Documents container listing/log tools and log/statistics resources. It also offers mutation tools, so capability and workflow authorization must remain distinct.
6. D06: [Context7 maintainer README](https://github.com/upstash/context7). Documents library resolution and documentation retrieval with version-specific usage. It does not guarantee coverage or correctness for every package version.
7. U01: [Basic Memory README](https://github.com/basicmachines-co/basic-memory) and [Obsidian MCP README](https://github.com/StevenStavrakis/obsidian-mcp). Documents local Markdown-based knowledge/search and local vault content retrieval respectively. The latter needs a configured Obsidian vault, so that prerequisite must not be invented for an arbitrary folder. The catalog's separate `calclavia/mcp-obsidian` URL returned 404 during design and was not treated as verified evidence.
8. U02: [Google Calendar MCP README](https://github.com/nspady/google-calendar-mcp). Documents multi-calendar events, free/busy queries and conflict checking. Authentication mode can limit invitation behavior, which this scenario does not require.
9. U03: [Rijksmuseum MCP README](https://github.com/r-huijts/rijksmuseum-mcp). Documents collection search, artwork metadata and detailed images. This supports a museum-art research scenario without requiring that museum to be the sole acceptable answer.
10. U04: [Excel MCP README](https://github.com/haris-musa/excel-mcp-server). Documents direct workbook editing, formulas, formats and charts without an Excel installation.
11. U05: [NS MCP README](https://github.com/r-huijts/ns-mcp-server). Documents real-time departures/platforms, journey planning and disruptions using the NS API.
12. U06: [Zoom Meetings API documentation, Cloud Recording section](https://developers.zoom.us/docs/api/meetings/). Documents recording-list responses and download information, subject to account/plan permissions. The catalog has no dedicated Zoom integration; the only literal `zoom` match is unrelated GIS functionality. This is an in-corpus no-match scenario, not a claim that Zoom lacks such APIs or external integrations.
13. D04/U06 boundary check: [Fastn MCP README](https://github.com/fastn-ai/fastn-mcp). The catalog URL redirects here. This is a generic connector discovery/execution gateway; a large connector count alone does not establish a dedicated built-in integration satisfying either scenario's exclusions.

## Reporting limits

Keep development and holdout results separate. Show audience/language and critical-subset breakdowns, retain paired-family identity, and avoid treating English/Chinese paraphrases as independent evidence of generalization. Any uncertainty estimate or resampling should group by family. With only 12 constructed families, present the result as illustrative development evidence. It cannot establish user satisfaction, production readiness, statistical superiority on real traffic, or reliable performance beyond this corpus.

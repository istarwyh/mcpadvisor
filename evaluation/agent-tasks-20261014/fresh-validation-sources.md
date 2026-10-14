# Fresh retrieval validation: public illustrative fixtures

Frozen at 2026-10-14T07:04:50Z, before this assessor made or saw any candidate retrieval. The author and assessor are AI. These are not human labels, production queries or exhaustive relevance judgments.

## Freeze and scope

- Query file: `fresh-validation.json`
- Query bytes: 11835
- Query SHA-256: `1322c53b99075c051bceffa498aa5b21df76f09de37c0ab7d24883578bd1fbd2`
- Catalog: `data/mcp_server_list.json`, 212 entries, SHA-256 `c323f16b1a24075f21655fb15780db9f4af3e105bc9a40b698f2c9b2e4205e50`
- Previously observed query file: `queries.json`, SHA-256 `e5223a0ebffe7a74a893c00c7a24ef79ac1e438f96c038ca73ae628cd21294bd`; read only to avoid repeating task families.
- Exactly 12 new queries: six English/Chinese family pairs, three developer families and three user families; five answerable families and one catalog-bounded no-known-relevant family.
- Three product-focused families and three capability-focused families. PromQL is necessarily a specific query dialect in one capability-focused family.
- No retrieval implementation, candidate configuration, existing ranking, experiment file or candidate call was inspected. Only the two named final files were written.
- Do not edit these fixtures after inspecting results. If a substantive labeling defect is found, report it separately and version a future set rather than silently tuning this set.

## Label rubric and limits

Grade 3 means documented direct support for the task and stated preference. Grade 2 means documented support for the core task with a clear preference limitation. Unlisted catalog entries remain unjudged. Positive labels say nothing about deployment quality, account permissions, costs or operational safety. Maintainer URLs are live documents inspected on 2026-10-14; they are not immutable source snapshots.

## Evidence and decisions

### FV-D01: monitoring time-series queries

`prometheus` receives 3. Maintainer tools cover metric discovery and both instant and range PromQL queries. This differs from the prior Docker logs/runtime-inspection family.

Source: https://github.com/pab1it0/prometheus-mcp-server

### FV-D02: API test collection execution

`postman` receives 3. The server runs collections using Newman with environment inputs and failure details. This is test execution, distinct from prior OpenAPI document exploration.

Source: https://github.com/shannonlal/mcp-postman

### FV-D03: design metadata for implementation

`figma` receives 3. The documented workflow accepts a Figma frame link and provides relevant design metadata to coding agents.

Source: https://github.com/GLips/Figma-Context-MCP

### FV-U01: home lighting state and control

`home-assistant` receives 3 conditional on a compatible Home Assistant hub. Setup should verify that condition; the query intentionally describes a capability rather than naming a product. Documented entity reads and actions meet the task.

Source: https://github.com/voska/hass-mcp

Siri Shortcuts was reviewed as an alternative but not assigned a positive grade: its documented tools run existing user-created shortcuts, and the requested hub/state/control workflow is not established by that README alone.

Alternative reviewed: https://github.com/dvcrn/mcp-server-siri-shortcuts

### FV-U02: dialogue text to audio

`elevenlabs` receives 3 for full script/audio support. `huggingface-spaces` receives 2 for documented text-to-speech and audio-file output; multiple speakers are a preference, not a required constraint. Its README also says the project is superseded, so this is capability evidence rather than an unqualified current deployment recommendation.

Sources:
- https://github.com/mamertofabian/elevenlabs-mcp-server
- https://github.com/evalstate/mcp-hfspace

### FV-U03: dedicated ride-history and GPS access

No known relevant catalog entry is assigned. All 212 catalog IDs/descriptions were examined and the complete catalog text was checked for Strava and related fitness/cycling terms. No dedicated integration was identified. The Strava API documents the requested operations; that fact alone does not make a catalog entry relevant. Broad gateways, shell tools and browser automation do not satisfy the explicit constraints. This does not assert global ecosystem absence.

Sources:
- https://developers.strava.com/docs/reference/
- https://github.com/fastn-ai/fastn-mcp

## Assessor exposure

Existing query wording was inspected only to identify already-used task families. No prior labels or rankings were read. Primary repository READMEs and Strava's API reference supplied the judgments. The new families and expected IDs were withheld from the implementing agent until its candidate freeze.

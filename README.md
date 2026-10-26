# MCP Advisor

[English](README.md) | [简体中文](README_zh.md)

MCP Advisor helps an MCP client discover servers for a task and obtain installation
guidance. It aggregates search providers and returns recommendations; it does
**not** install a server, edit your client configuration, or verify a recommended
server's safety for you.

## Start here

1. **Use the current source:** follow the [Quick Start](docs/GETTING_STARTED.md)
   for MCP 2026-07-28 clients, stdio, or HTTP.
2. **Need an older client?** The published npm version `1.0.5` is a separate
   legacy release. Do not apply the current source's transport configuration to it.
3. **Develop or diagnose:** read [Contributing](CONTRIBUTING.md),
   [Architecture](docs/ARCHITECTURE.md), and [Technical Reference](docs/TECHNICAL_REFERENCE.md).
   For current protocol failures, start with the [migration guide](docs/MCP_2026_MIGRATION.md).

### Award and project background

MCP Advisor is developed by the `mcpadvisor` team, which won second prize at the
inaugural OceanBase AI Hackathon in 2025 (首届 OceanBase AI 黑客松大赛).
The [organizer's May 19 event report](https://www.modb.pro/db/1924452526657646592)
names the team and describes its MCP search and recommendation project; the event
concluded in Guangzhou on May 17, 2025.
The [author's OceanBase community post](https://ask.oceanbase.com/t/topic/35625183)
connects that project to this repository. This is historical recognition, not a
benchmark or endorsement of every current feature.

## What is available?

| Capability | Current-source status |
| --- | --- |
| `recommend-mcp-servers` | Task-based recommendations with optional keywords/capabilities |
| `install-mcp-server` | Installation guidance/configuration text only; no automatic installation |
| Meilisearch, Compass, GetMCP | Constructed by the CLI; external availability/configuration still matters |
| Offline provider | Enabled by SearchService by default; embeddings can require a model download |
| Nacos discovery | Opt-in; CLI requires address, username **and** password |
| Cline Marketplace | Implemented, opt-in via `CLINE_MARKETPLACE_ENABLED=true` |
| FlashRank reranking | Implemented, default off; separately started Python service and model |
| Search-quality evaluation | Evaluation tooling and illustrative fixtures; not proof of production quality |
| Automatic installation / quality guarantees | Not implemented / not established |

The active Meilisearch provider uses text search. Offline retrieval combines text
and vectors; this is not universal vector search, adaptive query weighting, or a
guarantee of five results. Online providers still run alongside offline data.

## Choose a runtime

### Current source (modern protocol)

Use Node.js 20+ for the application; Inspector 2.10.1 additionally requires Node.js
22.19+. Use the pinned pnpm 8.15.9 from `package.json`.

```sh
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node build/index.js
```

The default is stdio. Diagnostics must not go to stdout. For local HTTP:

```sh
TRANSPORT_TYPE=http SERVER_HOST=127.0.0.1 SERVER_PORT=3000 node build/index.js
```

Connect a compatible MCP 2026-07-28 client to `http://127.0.0.1:3000/mcp`.
See the [official SDK client example](docs/MCP_2026_MIGRATION.md#connect-with-the-official-sdk).
HTTP is stateless, with a fresh protocol server per request; provider caches can
remain process-scoped. Old SSE/REST modes are rejected and old HTTP paths return
410. Modern POST responses may still use SSE encoding. There is no built-in
authentication or cross-origin browser CORS: keep loopback binding unless you
provide an independently secured gateway. Hosting acceptance is not implied.

### Published npm 1.0.5 (legacy)

```sh
npx -y @xiaohui-wang/mcpadvisor@1.0.5
```

This selects the older published artifact, not the source above. Check its own
client compatibility and configuration. A source checkout still declaring version
1.0.5 does not mean those source changes have been published to npm.

### Third-party installers

Marketplace/Smithery listings and their installers are independently maintained.
Check the selected artifact/version, permissions, and transport before running
them. This guide does not certify that they deliver the current modern source.

## Configure and extend

The CLI does not read `SEARCH_PROVIDER`, `SEARCH_LIMIT`, or
`SEARCH_MIN_SIMILARITY`. Provider injection and `SearchOptions` belong to the
programmatic SearchService API, not invented environment flags.
Do not import SearchService from the npm root: the package entry is a CLI with
startup side effects. See the [source-checkout API examples](docs/TECHNICAL_REFERENCE.md).

| Topic | Guide |
| --- | --- |
| CLI, HTTP, Nacos credentials and programmatic options | [Quick Start](docs/GETTING_STARTED.md) |
| Local Meilisearch lifecycle | [Local Meilisearch](docs/MEILISEARCH_LOCAL.md) |
| Text-search behavior | [Full-text search](docs/full-text-search.md) |
| Optional Cline source | [Cline Marketplace](docs/cline-marketplace.md) |
| Optional local model service, failure fallback and privacy | [FlashRank](docs/professional-reranking.md) |
| Judgments, metrics and illustrative-data limits | [Search-quality evaluation](docs/search-quality-evaluation.md) |
| Inspector prerequisites and focused browser checks | [Inspector UI testing](docs/inspector-ui-testing.md) |
| Modern protocol and rollback boundaries | [MCP migration](docs/MCP_2026_MIGRATION.md) |
| Older operational diagnostics | [Troubleshooting](docs/TROUBLESHOOTING.md) |

Troubleshooting's hosting-related revision is tracked separately in PR #40; use
the migration guide for current transport behavior. No unmerged hosting
configuration is part of these instructions.

## Validate a change

```sh
pnpm run check
pnpm test
pnpm run build
pnpm run test:protocol
```

These cover lint/format, Vitest, production compilation, and focused offline
protocol/startup checks respectively. They do not prove live provider availability
or ranking quality. The aggregate Playwright suite is `pnpm run test:e2e`
(`scripts/e2e/e2e.run.sh`); it needs its documented browser/service prerequisites.
A selected Inspector spec is not the aggregate suite. See
[Contributing](CONTRIBUTING.md) and [Inspector UI testing](docs/inspector-ui-testing.md).

## Project direction and documentation

[Roadmap](docs/ROADMAP.md) preserves historical plans, not current delivery dates.
Cline and FlashRank are implemented optional features, not open implementation
TODOs. New provider integrations, quality claims, and deployment work need their
own scope and evidence.

The [documentation review record](docs/DOCUMENTATION_REVIEW.md) identifies the
source baseline, verification boundaries, and language-mirror policy.
Contributions are welcome through an issue and a focused, tested pull request.

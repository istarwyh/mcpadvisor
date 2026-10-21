# Inspector v2 UI validation

The generic UI runner uses the official `@modelcontextprotocol/inspector@2.10.1`
package, the version already used by the Meilisearch harness. It launches with
`--protocol-era modern` because MCPAdvisor's source server supports MCP
`2026-07-28`, not the Inspector's default legacy initialize handshake.
No global `mcp-inspector` installation is required. Node >=22.19.0 is required by
this Inspector release. First use downloads the pinned package through npm.

Install the repository's frozen dependencies with pnpm 8.15.9. If dependencies
were installed with `--ignore-scripts`, rebuild the existing `sharp` dependency
before starting the real server (`pnpm rebuild sharp`). Install this repository's
Playwright Chromium (`pnpm exec playwright install chromium`). These steps do not
require changing the lockfile or adding a similarly named third-party package.

Run the migrated Inspector suite:

```sh
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
```

Without a test path, the runner retains Playwright's default complete test
selection. Extra arguments after the mode are forwarded unchanged. The migrated
suite requires authentication rather than silently skipping when no token is set.
It checks modern connection/discovery and tool enumeration, the three existing
recommendation queries, installation guidance, client-side empty-input prevention and the existing
30-second response bound. The helper observes actual Inspector SSE responses and
matches each tool call by request ID; it does not replace responses. It also checks
that returned content is rendered in the UI.

These checks do not prove online provider coverage, ranking quality, deployment,
or installation of an MCP server. The installation tool generates guidance only.
The old Meilisearch environment-switching UI suite and its runner are separate and
are not migrated by this change; passing the selected Inspector suite must not be
reported as passing all E2E tests. Continue running the independent protocol,
evaluation, type, lint, build and unit-test gates.

Inspector secrets use memory-only storage. `mcp-inspector.log` is mode 0600 but
contains a short-lived authentication token. Playwright traces and error reports
can also include the authenticated URL. Keep those artifacts local, redact tokens
before sharing, and do not upload raw traces as CI artifacts.

Official documentation:
- https://github.com/modelcontextprotocol/inspector/blob/main/docs/mcp-server-configuration.md
- https://github.com/modelcontextprotocol/inspector/blob/main/docs/v1-to-v2-migration.md

# ChatMCP / MCP.so / MCPRouter hosting migration status

Checked on 2026-10-19. This note distinguishes a server directory, the historical
ChatMCP hosting contract, MCPRouter Cloud, and MCP Advisor's modern source
deployment. The ecosystem still advertises cloud-hosted servers; this does not
verify that the current MCP Advisor source can be deployed there.

## What the public evidence establishes

- [MCPRouter Cloud](https://mcprouter.co/) remains publicly offered in the same
  ecosystem. Its [official quickstart](https://docs.mcprouter.co/quickstart)
  describes hosted servers accessed with an API key and Streamable HTTP, such as
  `https://mcprouter.to/time`, using an Authorization Bearer header. Its examples
  use the legacy SDK client and initialization flow. This establishes an offered
  hosted gateway, not support for every later MCP protocol revision or a verified
  workflow for deploying this repository. No key was created or used here.
- The current [MCP Advisor listing](https://mcp.so/servers/mcpadvisor) provides an
  `npx` stdio configuration. Its descriptive SSE/REST text has not caught up with
  this repository's modern source. A directory listing is not evidence of a
  running hosted MCP Advisor instance.
- MCP.so's [remote-server directory](https://mcp.so/remote-servers) lists endpoints
  hosted by other providers. Its [submission form](https://mcp.so/submit?type=remote-server)
  accepts an already deployed URL and advertises a one-time $39 listing fee.
  That is a directory submission charge, not a quoted hosting plan or permission
  to deploy a process. No submission or purchase is part of this change.
- The published [ChatMCP hosting guide](https://github.com/chatmcp/docs/blob/3ecc50883dee346d32102aa19e2795d9adaef791/content/docs/server-hosting.mdx)
  still describes `RestServerTransport` and the historical `params`, `rest`,
  `npx`, and `docker` metadata. An [official example manifest](https://github.com/chatmcp/mcp-server-flomo/blob/89ba664d686d94d34f48bb5ec347a85a993d10a9/chatmcp.yaml)
  follows that format. Neither establishes an `http:` replacement schema or a
  `build.dockerfile` field for this integration.
- The current [deployment article](https://mcp.so/blog/deploy-mcp-server) discusses
  general self-hosting. It does not document a new ChatMCP managed-runtime API or
  prove that its gateway supports MCP `2026-07-28`.

**Conclusion:** cloud-hosted MCP access is still advertised through MCPRouter.
However, the public evidence does not establish a current self-service workflow
for deploying the new MCP Advisor source, its modern manifest schema, or support
for MCP `2026-07-28` through the hosted gateway. An account-specific control plane,
documented runtime contract, or an actual authorized deployment would be needed
to resolve those questions. Do not equate the MCP.so directory with that gateway,
or infer that the ecosystem has discontinued hosting.

If "hosting agreement" means commercial terms, the public
[terms of service](https://mcp.so/terms-of-service) are general service terms;
they do not establish a dedicated MCP hosting SLA, runtime specification, or
protocol-version guarantee. No new agreement is accepted by this repository update.

## The protocol boundary

The published [ChatMCP REST transport source](https://github.com/chatmcp/typescript-sdk/blob/96d0d60478eca9350b873108e3dcd6ae25b4bbb4/src/server/rest.ts)
implements a custom POST/JSON transport. The [parameter/auth helpers](https://github.com/chatmcp/typescript-sdk/blob/96d0d60478eca9350b873108e3dcd6ae25b4bbb4/src/utils/index.ts)
read launch parameters and an `auth` value from request metadata. These historical
helpers are not MCP Advisor's current authentication mechanism or a modern hosting
contract. The published [router transport](https://github.com/chatmcp/mcp-server-router/blob/d9bc61f4d170937b5bb38deb2022d0d3f8879a26/src/transport.ts)
still uses the legacy initialization/session flow. Published source is evidence
of that implementation, not proof of which revision any live service runs.

The separate Go [MCPRouter proxy implementation](https://github.com/chatmcp/mcprouter/blob/9e7285d632c7155e3c739a64b5ae0c52ab6a3294/handler/proxy/mcp.go)
is labelled Streamable HTTP but requires the old initialization/session flow.
Its [REST backend](https://github.com/chatmcp/mcprouter/blob/9e7285d632c7155e3c739a64b5ae0c52ab6a3294/service/mcpclient/rest.go)
and [stdio backend](https://github.com/chatmcp/mcprouter/blob/9e7285d632c7155e3c739a64b5ae0c52ab6a3294/service/mcpclient/stdio.go)
replace the request's `params._meta` with their own auth metadata. The REST path
also does not forward the modern MCP protocol/method headers. Consequently, that
published implementation is not a transparent path to this strict modern server.
The deployed cloud revision has not been identified or tested; do not turn this
source finding into a claim that the live service necessarily runs that code.

MCP Advisor's current source instead requires MCP `2026-07-28`, with explicit
modern client negotiation, on stdio or HTTP `/mcp`. HTTP uses POST requests with
SDK-managed protocol metadata and JSON or SSE response encoding. There is no old
initialization handshake, session ID, or standalone GET event stream. The archived
ChatMCP implementation is excluded from the production build and import graph.
See the [migration guide](./MCP_2026_MIGRATION.md#server-composition-and-wire-behavior).

Changing `rest.endpoint` from `/rest` to `/mcp` cannot perform this migration.
A process launched with `--mode=rest` will fail before serving, and a legacy
client still cannot use the modern server after a URL change. Do not invent an
`http:` YAML section, re-enable archived SDKs, or weaken `legacy: 'reject'` as an
undocumented compatibility bridge.

## Repository configuration and existing deployments

[`chatmcp.yaml`](../chatmcp.yaml) preserves the existing `params`/`rest`/`docker`
metadata, with explicit deprecation warnings, pending a verified platform
migration. Keeping the fields does not make them valid for the modern source.
This update does not disable or change a live hosted service.

The local npm launch is pinned to `@xiaohui-wang/mcpadvisor@1.0.5` and is explicitly
legacy-only. It is not a way to run the new source. The historical Docker example
still names an unverified floating image; do not execute it for a migration or
use it as an immutable rollback artifact. No matching Docker digest/tag is claimed.
Preserve an existing deployment's actual artifact and configuration together.

## Modern source deployment and acceptance

The new source transport is already implemented. It can be verified independently
of ChatMCP, without pretending that MCP.so operates the deployment:

1. Use a reviewed source commit containing the modern implementation, Node.js >=20
   (`.nvmrc`: 22), and the checked-in lockfile. Do not select it via npm `latest`.
2. Build and start an isolated loopback HTTP process. Remove old `ENDPOINT` and
   endpoint/message-path CLI settings first:

   ```bash
   nvm use
   pnpm install --frozen-lockfile
   pnpm run build
   node build/index.js --mode=http --host=127.0.0.1 --port=3000
   ```

3. In another terminal, check `http://127.0.0.1:3000/health`. Then use the
   [official SDK acceptance example](./MCP_2026_MIGRATION.md#connect-with-the-official-sdk)
   with client `2.3.1` explicitly pinned to MCP `2026-07-28`. Verify discovery,
   tool listing, resources, and a representative recommendation call. A health
   response alone is not a successful MCP connection or search-provider test.
4. Before any remote cutover, establish the provider's exact artifact/build,
   process command, environment variables, port routing, and proxy behavior.
   Confirm that its client/gateway preserves modern request metadata and JSON/SSE
   responses, rather than assuming all services labelled "Streamable HTTP" use
   the same protocol revision. Run the same tool call through the real gateway.
5. Provide TLS, authentication and network restrictions for **every** exposed
   route, including `/health` and `/api/sources`. Keep the loopback binding unless
   the deployment deliberately requires another address. Configure narrowly
   scoped Host/Origin hostnames per the [security guidance](./MCP_2026_MIGRATION.md#deployment-and-security).
   Host/Origin checks do not replace authentication or supply browser CORS support.
6. Only switch the intended client after those checks pass. Keep the prior
   deployment available for [explicit rollback](./MCP_2026_MIGRATION.md#rollback).
   Submitting a working endpoint to a directory is a separate step, with any
   publication, payment, terms, and data sharing approved separately.

Local transport checks include:

```bash
pnpm run check
pnpm run build
pnpm exec tsc --noEmit -p tsconfig.test.json
pnpm run test:protocol
pnpm exec vitest run src/tests/integration/server/stateless-http.test.ts
```

These exercise source-level stdio and HTTP behavior. Some tests isolate search or
installation dependencies; they do not validate a ChatMCP deployment, its proxy,
its authentication, or the health of every external provider. No live platform
migration, new npm publication, directory submission, or hosting purchase has
been performed for this documentation update.

## 中文结论

- MCP.so 当前目录收录现成的远程端点；提交页的 $39 是一次性目录发布费，不能当作托管报价。
  MCP Advisor 目录页目前只给 stdio 启动配置，不能据此确认存在托管实例。
- MCPRouter Cloud 仍公开提供云端服务器及带 API key 的 Streamable HTTP 网关，不能说
  ChatMCP 生态已停止托管。但公开教程和源码仍使用旧初始化／会话流程；公开 Go 网关还会
  覆盖请求元数据，不能直接接入当前严格现代服务。线上实际版本尚未验证。
- 未找到新版 MCP Advisor 自助部署流程、现代托管 YAML 契约或 MCP 2026-07-28 支持保证；
  目录收录、网关服务和托管本仓库是不同问题。
- 保留历史 `chatmcp.yaml` 元数据并加弃用警示，不默认停用已有托管；固定 npm 1.0.5
  仅供旧版本地启动。历史浮动 Docker 镜像没有通过版本核验，不能用作迁移或回滚制品。
- 新源码已迁移到现代 stdio／HTTP `/mcp`；更换 URL 不能替代客户端与网关协议升级。
  先按上面的源码启动方式验证，再通过真实托管入口验证工具调用、认证及代理行为后切换。
- 尚未实施线上 ChatMCP 迁移。需要明确的平台运行契约或获准访问的实际部署入口，才能
  确认托管迁移可行并完成验收；通用服务条款也不等于专用 MCP 托管 SLA。

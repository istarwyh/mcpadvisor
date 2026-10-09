# MCP Advisor Quick Start Guide

[English](./GETTING_STARTED.en.md) | [简体中文](./GETTING_STARTED.md)

This guide covers installing, configuring, and using MCP Advisor to help you get
started and make the most of its features.

This is the English translation of the [Chinese guide](./GETTING_STARTED.md).
English [technical reference](./TECHNICAL_REFERENCE.en.md) and
[troubleshooting](./TROUBLESHOOTING.en.md) guides are also available. Architecture
and contribution documents remain in Chinese. Runtime messages may also still
contain Chinese.

## Translation and Current-Source Updates

This English guide follows the Chinese guide's structure, with source-verified
corrections to configuration, response fields, logging, and verification steps.
These corrections are documented in the relevant sections; the Chinese original
is unchanged. The instructions were checked against source, not exercised in a
full installation or runtime test. Advanced reference examples marked historical
or illustrative are not supported configuration recipes.

## Contents

- [Installation Methods](#installation-methods)
  - [Integrate Through MCP Configuration (Recommended)](#integrate-through-mcp-configuration-recommended)
  - [NPM Package Installation](#npm-package-installation)
  - [Global Installation](#global-installation)
  - [Run Directly](#run-directly)
  - [Install Through Smithery](#install-through-smithery)
- [Basic Usage](#basic-usage)
  - [Find MCP Servers](#find-mcp-servers)
  - [Understand Search Results](#understand-search-results)
  - [Integrate with AI Assistants](#integrate-with-ai-assistants)
- [Configuration Options](#configuration-options)
  - [Environment Variables](#environment-variables)
  - [Configuration Files](#configuration-files)
  - [Transport Configuration](#transport-configuration)
- [Usage Tips](#usage-tips)
  - [Write Effective Queries](#write-effective-queries)
  - [Advanced Search Options](#advanced-search-options)
- [Common Troubleshooting](#common-troubleshooting)
  - [Installation Issues](#installation-issues)
  - [Configuration Issues](#configuration-issues)
  - [Runtime Issues](#runtime-issues)

## Installation Methods

### Integrate Through MCP Configuration (Recommended)

The fastest way to integrate MCP Advisor is through MCP configuration:

```json
{
  "mcpServers": {
    "mcpadvisor": {
      "command": "npx",
      "args": ["-y", "@xiaohui-wang/mcpadvisor"]
    }
  }
}
```

Add this configuration to your AI assistant's MCP settings file:

- **macOS (Claude Desktop)**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

For Linux or a different MCP client, use that client's documented settings path.
Restart your AI assistant after configuring it.

### NPM Package Installation

To integrate MCP Advisor into a project:

```bash
# Using npm
npm install @xiaohui-wang/mcpadvisor

# Using yarn
yarn add @xiaohui-wang/mcpadvisor

# Using pnpm
pnpm add @xiaohui-wang/mcpadvisor
```

### Global Installation

A global installation makes the `mcpadvisor` command available from any directory:

```bash
# Install globally
npm install -g @xiaohui-wang/mcpadvisor

# Run
mcpadvisor
```

### Run Directly

Run without a separate installation step:

```bash
# Run using npx (no separate installation required)
npx @xiaohui-wang/mcpadvisor

# Or select a version with npx
npx @xiaohui-wang/mcpadvisor@latest
```

### Install Through Smithery

Use [Smithery](https://smithery.ai/server/@istarwyh/mcpadvisor) to install
MCP Advisor for Claude Desktop automatically:

```bash
npx -y @smithery/cli install @istarwyh/mcpadvisor --client claude
```

## Basic Usage

### Find MCP Servers

MCP Advisor lets you discover and use MCP servers through natural-language
queries. Here are some examples:

#### 1. Direct Queries

Ask your AI assistant for MCP servers suited to a particular task:

```text
Which MCP servers can be used for vector database integration?
```

```text
Find MCP servers for natural language processing
```

#### 2. Feature-Oriented Queries

Ask for servers with specific capabilities:

```text
Find an MCP server for image generation
```

```text
I need an MCP server for image generation
```

#### 3. Task-Oriented Queries

Describe the task you want to complete:

```text
I need to analyze financial data. Which MCP server should I use?
```

```text
I need to analyze financial data, which MCP server should I use?
```

### Understand Search Results

MCP Advisor returns results containing the following information:

- **Server name**: The name of the MCP server
- **Description**: A brief description of the server's capabilities
- **GitHub URL**: A link to the server's repository
- **Relevance score**: How closely the server matches your query

The recommendation tool currently formats these fields as text. The following
JSON illustrates the underlying server data, not the exact MCP wire response.
The `sourceUrl` field follows [the current response type](../src/types/index.ts);
the Chinese source guide uses the older `github_url` example.

#### Example Result

```json
[
  {
    "title": "NLP Toolkit",
    "description": "Comprehensive natural language processing toolkit with sentiment analysis, entity recognition, and text summarization capabilities.",
    "sourceUrl": "https://github.com/example/nlp-toolkit",
    "similarity": 0.92
  }
]
```

### Integrate with AI Assistants

#### Claude Desktop

1. **Configure MCP Advisor**:

   Add the following configuration to `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "mcpadvisor": {
         "command": "npx",
         "args": ["-y", "@xiaohui-wang/mcpadvisor"]
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Start using it**:

   ```text
   Claude, please help me find an MCP server for database operations
   ```

#### Other AI Assistants

For other AI assistants that support the Model Context Protocol:

1. **Install MCP Advisor globally**:

   ```bash
   npm install -g @xiaohui-wang/mcpadvisor
   ```

2. **Configure the assistant to use MCP Advisor as a server**

3. **Consult your assistant's documentation for its specific MCP integration steps**

## Configuration Options

### Environment Variables

The tables below describe settings read by the current
[CLI entry point](../src/index.ts), [logger](../src/utils/logger.ts), and
[configuration modules](../src/config/constants.ts). They correct stale settings
in the Chinese source guide.

#### Core Configuration

| Variable              | Description                                         | Default  | Required |
| --------------------- | --------------------------------------------------- | -------- | -------- |
| `TRANSPORT_TYPE`      | Transport method (stdio, sse, rest)                 | `stdio`  | No       |
| `LOG_LEVEL`           | Log level (debug, info, warn, error)                | `info`   | No       |
| `ENABLE_FILE_LOGGING` | Enable file logging; create the log directory first | `false`  | No       |
| `LOGS_DIR`            | Directory for `all.log` and `error.log`             | `./logs` | No       |

`DEBUG=true` alone does not enable the current logger. For debug file logging in
a source checkout after building:

```bash
mkdir -p logs
ENABLE_FILE_LOGGING=true LOG_LEVEL=debug node build/index.js
```

#### HTTP Server Configuration (SSE/REST Transports)

| Variable      | Description        | Default     | Required |
| ------------- | ------------------ | ----------- | -------- |
| `SERVER_PORT` | HTTP server port   | `3000`      | No       |
| `SERVER_HOST` | HTTP server host   | `localhost` | No       |
| `ENDPOINT`    | REST endpoint path | `/rest`     | No       |

The CLI fixes the SSE path at `/sse`. It reads the `messagePath` command-line
parameter, defaulting to `/messages`. The source guide's `SSE_PATH` and
`MESSAGE_PATH` environment variables are not read by this entry point.

#### Search Configuration

[SearchService](../src/services/searchService.ts) defines defaults of `limit: 5`
and `minSimilarity: 0.4`; programmatic callers can provide search options as
shown under [Advanced Search Options](#advanced-search-options). The source
guide's `MIN_SIMILARITY`, `MAX_RESULTS`, `ENABLE_CACHE`, and `CACHE_TTL`
environment settings are not wired into this service and should not be used as
configuration instructions.

`VECTOR_ENGINE_TYPE` is read by the vector-engine implementation and defaults to
`oceanbase` in [constants.ts](../src/config/constants.ts), rather than the
source guide's `memory`. It is not a switch for selecting the CLI's provider
list. The CLI initializes Meilisearch, Compass, and GetMCP, with Nacos conditional
on its credentials and offline fallback managed by SearchService.

#### API Configuration

| Variable           | Description                          | Default                              | Required             |
| ------------------ | ------------------------------------ | ------------------------------------ | -------------------- |
| `COMPASS_API_BASE` | Base URL for the COMPASS API         | `https://registry.mcphub.io`         | No                   |
| `GETMCP_API_URL`   | GetMCP server-list URL               | `https://getmcp.io/api/servers.json` | No                   |
| `OCEANBASE_URL`    | OceanBase database connection string | None                                 | When using OceanBase |

For local/cloud Meilisearch settings, see the English
[Local Meilisearch Guide](./MEILISEARCH_LOCAL.md) and
[current configuration source](../src/config/meilisearch.ts).

#### Nacos Provider Configuration

The CLI only initializes Nacos when all three connection credentials below are
set. This corrects the source guide's conditional credential requirements.

| Environment Variable | Description                                | Default      | Required |
| -------------------- | ------------------------------------------ | ------------ | -------- |
| `NACOS_SERVER_ADDR`  | Nacos server address                       | None         | Yes      |
| `NACOS_USERNAME`     | Nacos username                             | None         | Yes      |
| `NACOS_PASSWORD`     | Nacos password                             | None         | Yes      |
| `MCP_HOST`           | MCP host passed to Nacos provider          | `localhost`  | No       |
| `MCP_PORT`           | MCP port passed to Nacos provider          | `3000`       | No       |
| `AUTH_TOKEN`         | Auth token passed to Nacos provider        | Empty string | No       |
| `NACOS_DEBUG`        | Enable Nacos debug mode when set to `true` | `false`      | No       |

The source guide's `NACOS_NAMESPACE`, `NACOS_GROUP`, and `MCP_SERVICE_NAME`
settings are not passed by this CLI entry point. Use the source-linked
configuration above rather than assuming those variables change its behavior.

#### Logging Configuration

`LOGS_DIR` selects the logger's output directory. `LOG_DIR` (or `LOGS_DIR` as its
fallback) instead selects directories for the
[log-reading MCP resource](../src/services/core/server/resources/LogResourceHandler.ts).
These are distinct settings, unlike the source guide's generic `LOG_DIR` row.

### Configuration Files

The current CLI does not automatically load `.mcpadvisorrc.json`.
The source guide's `.mcpadvisorrc.json` and `config/default.json` transport/search
examples are historical examples, not working alternatives to the CLI settings
above.

[configLoader.ts](../src/config/configLoader.ts) is used by the data-loading
service and supports a custom `CONFIG_FILE` plus MCP source overrides. This does
not mean it configures the CLI's transport or provider list. Consult that module
and [config/default.json](../config/default.json) when changing data sources.

### Transport Configuration

MCP Advisor supports multiple transports. The commands below assume a source
checkout with dependencies installed and `pnpm run build` already completed:

#### 1. Stdio Transport (Default)

Suitable for command-line tools:

```bash
node build/index.js
```

#### 2. SSE Transport

Suitable for web integration:

```bash
TRANSPORT_TYPE=sse SERVER_PORT=3000 node build/index.js
```

#### 3. REST Transport

Provides RESTful endpoints:

```bash
TRANSPORT_TYPE=rest SERVER_PORT=8080 ENDPOINT=/api/mcp node build/index.js
```

#### REST with File Logging

This example binds to localhost. The server has no built-in authentication layer;
binding to all interfaces as in the Chinese source guide is not production
hardening. Keep it local unless you have appropriate network restrictions and an
authenticated reverse proxy.

```bash
mkdir -p logs
TRANSPORT_TYPE=rest SERVER_PORT=8080 SERVER_HOST=localhost LOG_LEVEL=warn ENABLE_FILE_LOGGING=true node build/index.js
```

## Usage Tips

### Write Effective Queries

To get the best results from MCP Advisor:

#### 1. Be Specific

Include the capabilities you need:

```text
Find an MCP server for OCR that supports multiple languages
```

```text
Find an MCP server for OCR with support for multiple languages
```

#### 2. Include Domain Context

Mention your application domain:

```text
I need an MCP server for financial data analysis with compliance features
```

```text
MCP server for financial data analysis with regulatory compliance features
```

#### 3. Specify Technical Requirements

Include any technical constraints:

```text
Find a lightweight MCP server for offline image processing
```

```text
Find a lightweight MCP server for image processing that works offline
```

### Advanced Search Options

When using MCP Advisor programmatically, you can specify additional search
parameters. This uses the current public `SearchParams`/`SearchOptions` types;
the source guide's `includeMetadata` option is not defined in those types:

```typescript
const results = await searchService.search(
  { taskDescription: 'vector database' },
  { limit: 10, minSimilarity: 0.2 },
);
```

## Common Troubleshooting

### Installation Issues

#### 1. Permission Errors

Avoid using administrator privileges to work around a global-install problem.
Use the MCP configuration's `npx` invocation above, or a user-writable Node.js
installation. This replaces the source guide's `sudo npm install` workaround.

#### 2. Version Conflicts

Read the package manager's conflict details and use a compatible dependency
version. Do not use `--force` as the default fix; it can bypass compatibility
checks. The source guide's force-install example is not recommended here.

#### 3. Command Not Found

For a global npm installation, inspect the prefix:

```bash
npm prefix -g
```

On macOS/Linux, the command directory is the prefix's `bin` subdirectory. On
Windows, it is the prefix itself. Add the appropriate directory to PATH using
your operating system's settings, then reopen the terminal. This replaces the
source guide's `npm bin -g` command, which newer npm versions removed.

### Configuration Issues

#### 1. MCP Configuration Has No Effect

Check the configuration file path:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

On macOS, with Python available, check that the JSON is valid
(use your actual settings path on other platforms):

```bash
# Validate JSON formatting
python -m json.tool "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

#### 2. Environment Variables Have No Effect

Confirm your environment variable settings:

```bash
# Linux/macOS
echo $TRANSPORT_TYPE
export TRANSPORT_TYPE=sse

# Windows
echo %TRANSPORT_TYPE%
set TRANSPORT_TYPE=sse
```

### Runtime Issues

#### 1. Connection Refused

Make sure the server is running on the specified port and check your firewall
settings:

```bash
# Check port usage
netstat -an | grep 3000
lsof -i :3000

# Check service status
curl http://localhost:3000/health
```

#### 2. No Search Results

Try a more general query:

```text
# Change a specific query
"advanced machine learning vector database with GPU acceleration"

# To a more general query
"machine learning" or "vector database"
```

Check your network connection:

```bash
# Test connectivity to external APIs
curl -I https://getmcp.io/api/servers.json
ping registry.mcphub.io
```

#### 3. Performance Issues

Consider the following optimizations:

- Use more specific search terms
- Check server resources (CPU/memory)
- For programmatic callers, adjust the `limit` search option
- Do not rely on the source guide's `ENABLE_CACHE` or `MAX_RESULTS` variables;
  they are not read by the search service

### Verify the Installation

The CLI has no explicit `--version` or `--help` handling, so the source guide's
commands are not reliable installation checks. Instead, restart your configured
MCP client, confirm that it lists MCP Advisor's `recommend-mcp-servers` tool,
and run a query from [Basic Usage](#basic-usage).

For a built source checkout using SSE or REST, the HTTP server exposes `/health`:

```bash
curl http://localhost:3000/health
```

Use the port you configured. This health endpoint does not apply to stdio
transport, and a successful health response alone does not verify external
search providers.

---

If you encounter a problem that this guide does not cover:

1. Read the [Troubleshooting Guide](./TROUBLESHOOTING.en.md)
2. Check [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
3. Open a new issue to ask for help

For advanced configuration and technical details, see:

- [Technical Reference](./TECHNICAL_REFERENCE.en.md)
- [Architecture Documentation (Chinese)](./ARCHITECTURE.md)
- [Contributing Guide (Chinese)](../CONTRIBUTING.md)

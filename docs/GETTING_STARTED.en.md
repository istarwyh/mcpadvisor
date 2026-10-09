# MCP Advisor Quick Start Guide

[English](./GETTING_STARTED.en.md) | [简体中文](./GETTING_STARTED.md)

This guide covers installing, configuring, and using MCP Advisor to help you get
started and make the most of its features.

This is the English translation of the [Chinese guide](./GETTING_STARTED.md).
The linked technical, architecture, contribution, and troubleshooting documents
are currently in Chinese. Runtime messages may also still contain Chinese.

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

- **MacOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

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
- **Installation instructions**: How to install and configure the server
- **Relevance score**: How closely the server matches your query

#### Example Result

```json
[
  {
    "title": "NLP Toolkit",
    "description": "Comprehensive natural language processing toolkit with sentiment analysis, entity recognition, and text summarization capabilities.",
    "github_url": "https://github.com/example/nlp-toolkit",
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

MCP Advisor can be configured with the following environment variables.
All variables are optional unless otherwise noted.

#### Core Configuration

| Variable              | Description                          | Default | Required |
| --------------------- | ------------------------------------ | ------- | -------- |
| `TRANSPORT_TYPE`      | Transport method (stdio, sse, rest)  | `stdio` | No       |
| `LOG_LEVEL`           | Log level (debug, info, warn, error) | `info`  | No       |
| `DEBUG`               | Enable debug logging                 | `false` | No       |
| `ENABLE_FILE_LOGGING` | Enable file logging                  | `false` | No       |

#### HTTP Server Configuration (SSE/REST Transports)

| Variable       | Description           | Default     | Required |
| -------------- | --------------------- | ----------- | -------- |
| `SERVER_PORT`  | HTTP server port      | `3000`      | No       |
| `SERVER_HOST`  | HTTP server host      | `localhost` | No       |
| `SSE_PATH`     | SSE endpoint path     | `/sse`      | No       |
| `MESSAGE_PATH` | Message endpoint path | `/messages` | No       |
| `ENDPOINT`     | REST endpoint path    | `/rest`     | No       |

#### Search Configuration

| Variable             | Description                                         | Default  | Required |
| -------------------- | --------------------------------------------------- | -------- | -------- |
| `MIN_SIMILARITY`     | Minimum similarity score for search results         | `0.5`    | No       |
| `MAX_RESULTS`        | Maximum number of search results to return          | `10`     | No       |
| `ENABLE_CACHE`       | Enable search-result caching                        | `false`  | No       |
| `CACHE_TTL`          | Cached-result time to live (seconds)                | `3600`   | No       |
| `VECTOR_ENGINE_TYPE` | Vector engine type (memory, oceanbase, meilisearch) | `memory` | No       |

#### API Configuration

| Variable           | Description                          | Default                      | Required             |
| ------------------ | ------------------------------------ | ---------------------------- | -------------------- |
| `COMPASS_API_BASE` | Base URL for the COMPASS API         | `https://registry.mcphub.io` | No                   |
| `OCEANBASE_URL`    | OceanBase database connection string | -                            | When using OceanBase |

#### Nacos Provider Configuration

If you choose Nacos as a search provider:

| Environment Variable | Description                      | Default         | Required                         |
| -------------------- | -------------------------------- | --------------- | -------------------------------- |
| `NACOS_SERVER_ADDR`  | Nacos server address             | None            | Yes                              |
| `NACOS_NAMESPACE`    | Nacos namespace                  | `public`        | No                               |
| `NACOS_GROUP`        | Nacos group                      | `DEFAULT_GROUP` | No                               |
| `NACOS_USERNAME`     | Nacos username                   | None            | If Nacos requires authentication |
| `NACOS_PASSWORD`     | Nacos password                   | None            | If Nacos requires authentication |
| `MCP_SERVICE_NAME`   | Name of the MCP service in Nacos | `mcp-servers`   | No                               |

#### Logging Configuration

| Variable  | Description        | Default  | Required |
| --------- | ------------------ | -------- | -------- |
| `LOG_DIR` | Log file directory | `./logs` | No       |

### Configuration Files

You can also configure MCP Advisor using a configuration file.
Create `.mcpadvisorrc.json`:

```json
{
  "transport": "stdio",
  "port": 3000,
  "enableFileLogging": true,
  "logLevel": "info",
  "vectorEngineType": "memory",
  "search": {
    "provider": "hybrid",
    "limit": 5,
    "minSimilarity": 0.3
  }
}
```

Or use `config/default.json`:

```json
{
  "server": {
    "port": 3000,
    "transportType": "stdio"
  },
  "search": {
    "provider": "hybrid",
    "limit": 5,
    "minSimilarity": 0.3
  }
}
```

### Transport Configuration

MCP Advisor supports multiple transports:

#### 1. Stdio Transport (Default)

Suitable for command-line tools:

```bash
node build/index.js
```

#### 2. SSE Transport

Suitable for web integration:

```bash
TRANSPORT_TYPE=sse SERVER_PORT=3000 DEBUG=true ENABLE_FILE_LOGGING=true node build/index.js
```

#### 3. REST Transport

Provides RESTful endpoints:

```bash
TRANSPORT_TYPE=rest SERVER_PORT=8080 ENDPOINT=/api/mcp node build/index.js
```

#### Production Configuration Example

```bash
TRANSPORT_TYPE=rest SERVER_PORT=8080 SERVER_HOST=0.0.0.0 LOG_LEVEL=warn ENABLE_FILE_LOGGING=true node build/index.js
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
parameters:

```typescript
const results = await searchService.search('vector database', {
  limit: 10,
  minSimilarity: 0.2,
  includeMetadata: true,
});
```

## Common Troubleshooting

### Installation Issues

#### 1. Permission Errors

If you encounter permission errors, try using administrator privileges:

```bash
# macOS/Linux
sudo npm install -g @xiaohui-wang/mcpadvisor

# Windows (run Command Prompt as administrator)
npm install -g @xiaohui-wang/mcpadvisor
```

#### 2. Version Conflicts

If there are version conflicts with other packages:

```bash
npm install @xiaohui-wang/mcpadvisor --force
```

#### 3. Command Not Found

Make sure the global npm bin directory is in your PATH:

```bash
# Show the global npm path
npm bin -g

# Add it to PATH (macOS/Linux)
export PATH="$PATH:$(npm bin -g)"

# Windows
set PATH=%PATH%;%APPDATA%\npm
```

### Configuration Issues

#### 1. MCP Configuration Has No Effect

Check the configuration file path:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

Make sure the JSON is valid:

```bash
# Validate JSON formatting
cat ~/.../claude_desktop_config.json | python -m json.tool
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
curl -I https://api.getmcp.org
ping registry.mcphub.io
```

#### 3. Performance Issues

Consider the following optimizations:

- Use more specific search terms
- Check server resources (CPU/memory)
- Enable caching: `ENABLE_CACHE=true`
- Adjust the search limit: `MAX_RESULTS=5`

### Verify the Installation

Run the following commands to verify the installation:

```bash
# Check the version
mcpadvisor --version

# Or
npx @xiaohui-wang/mcpadvisor --version

# Test basic functionality
mcpadvisor --help
```

If the version number and help information are displayed, the installation was
successful.

---

If you encounter a problem that this guide does not cover:

1. Read the [Troubleshooting Guide (Chinese)](./TROUBLESHOOTING.md)
2. Check [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
3. Open a new issue to ask for help

For advanced configuration and technical details, see:

- [Technical Reference (Chinese)](./TECHNICAL_REFERENCE.md)
- [Architecture Documentation (Chinese)](./ARCHITECTURE.md)
- [Contributing Guide (Chinese)](../CONTRIBUTING.md)

# MCP installation guidance

## Requirements

For servers with installation metadata, return suitable commands/configuration to
the MCP client so a user can install and configure the server. Retain the server's
source and identity; use its actual documented package/repository rather than
inventing a package name.

## Current implementation and boundaries

The installation service retrieves README content and extracts configuration or
installation sections. First-party fallback instructions and client-specific
configuration guidance are in English. Third-party README content remains verbatim.
Configuration JSON must safely escape names, and client instructions must describe
the actual supported UI/configuration path. Producing a guide does not execute it
or guarantee that a third-party server is safe or compatible.

## Verification

Exercise README retrieval success/failure, both extraction modes, default guidance,
client configuration, escaped names and helpful error handling. No automatic server
installation or execution is implied by this requirements document.

The original Chinese source, including historical code examples and timelines, is
retained in [feature-support-installation.zh-CN.md](./feature-support-installation.zh-CN.md).

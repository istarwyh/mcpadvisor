# Configurable MCP metadata sources

## Requirements

Read MCP metadata from remote URLs and local files. Remote JSON catalogs can contain
names, descriptions, categories, tags and installations; local files may contain
client configurations or equivalent metadata. Sources and field mapping must be
configurable rather than tied to one provider's exact spelling.

Normalize aliases such as `name`, `server_name` and `serverName` into a shared
schema. Required identity/description/installation fields should be documented;
other optional fields may be retained for indexing. On startup, read configuration,
fetch/parse each selected source, validate it and prepare normalized records for
storage/search.

A client configuration file path is platform-dependent. Do not publish real user
paths or credentials in examples. `.env` alone is not automatically loaded by the
current CLI; explicitly export variables or preload dotenv where appropriate.

## Implementation and verification

This document is a requirements record, not a guarantee that arbitrary field
mapping or every local source format is already implemented. Test missing files,
invalid URLs, HTTP errors, malformed JSON, incompatible schemas and mixed sources;
report actual supported formats through the current technical reference.

The original Chinese source, including historical code examples and timelines, is
retained in [feature-support-config.zh-CN.md](./feature-support-config.zh-CN.md).

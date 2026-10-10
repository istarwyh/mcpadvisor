## 需求描述
支持元数据的配置，元数据主要用于描述 MCP 服务器的来源，MCP 需要被索引的字段路径。
MCP 服务器元数据支持 本地路径和 URL 两种方式。

## 技术实现

## 测试

## Requirements
1. Ingest metadata for MCP servers from multiple sources:
- Remote URLs (e.g., https://getmcp.io/api/servers.json) that return structured MCP Manifest responses in JSON format, containing fields such as name, description, categories, tags, installations, etc.
- Local files (e.g., /Users/me/Library/Application Support/Claude/claude_desktop_config.json) that include sample MCP installation configurations or related metadata.

2. Parse the data from these sources into a unified schema, enabling consistent storage in the datastore for future use.

3. Standard fields may include name, description, and installation_command, while other metadata fields are optional and can be indexed as needed.


Details
- There is a server config file to including following settings
 - mcp_sources: 
  - remote_urls: list of remote urls for mcp servers
  - local_files: list of files for local files
 - we also provide a list of fields mapping so that we can extract data and convert into the same fields of data.
 e.g., name could be extract the alias like name, server_name, serverName, etc
- when starting the server, it first read all configs and start fetching data from those resource one by one.
- once fetching the data, it extract all necessary data and put into corresponding fields. all fields of the object would be convert into a schemad data.
- those data would be saved into datasource for later usage for indexing and searching 




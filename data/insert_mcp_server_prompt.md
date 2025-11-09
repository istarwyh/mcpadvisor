请将下面的 GitHub 项目数据结构化为 MCP 服务器数据写入 ./mcp_server_list.json 文件，字段请严格按 JSON 输出：

```json
{
  "github": "<GitHub URL 必填>",
  "id": "<简短 id，建议与 npm 包或仓库同名>",
  "display_name": "<UI 显示名>",
  "description": "<≤120 字中文简介>",
  "homepage": "<项目官网，可与 github 相同>",
  "license": "<MIT / Apache-2.0 等>",
  "categories": ["<AI>", "<Documentation>", "<Developer Tools>"],
  "tags": ["<MCP>", "<Docs>", "<Code>"],

  "install": {
    "command": "<npx | bunx | deno | docker>",
    "args": ["-y", "<npm 包名或其它参数>"],
    "env": {
      "<ENV_NAME>": "${<ENV_NAME>}"
    }
  },

  "examples": [
    {
      "title": "<示例标题>",
      "description": "<一句话说明>",
      "prompt": "<tool 调用示例>"
    }
    // 可再加 1-2 个
  ],

  "arguments": {
    "<ENV_NAME>": {
      "description": "<环境变量用途>",
      "required": <true|false>,
      "example": "<示例值>"
    }
    // 可选
  }
}
```

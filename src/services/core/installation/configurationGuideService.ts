/**
 *  configuration guide服务
 * 负责为不同MCP客户端生成 configuration guide
 */

/**
 * MCP客户端类型
 */
export enum McpClientType {
  CLAUDE = 'claude',
  CLAUDE_DESKTOP = 'claude desktop',
  WINDSURF = 'windsurf',
  CASCADE = 'cascade',
  CURSOR = 'cursor',
  CLINE = 'cline',
  CHATGPT = 'chatgpt',
  OPENAI = 'openai',
  OTHER = 'other',
}

/**
 *  configuration guide服务
 * 负责为不同MCP客户端生成 configuration guide
 */
export class ConfigurationGuideService {
  /**
   * 生成MCP configuration guide
   * @param mcpName - MCP服务器名称
   * @param mcpClient - 用户使用的MCP客户端
   * @returns  configuration guide文本
   */
  public generateConfigurationGuide(
    mcpName: string,
    mcpClient: string = '',
  ): string {
    const clientType = this.normalizeClientType(mcpClient);
    const baseConfigTemplate =
      "Example only: replace command, args and env with the selected server repository's actual installation instructions.\n\n" +
      this.getBaseConfigTemplate(mcpName);

    switch (clientType) {
      case McpClientType.CLAUDE:
      case McpClientType.CLAUDE_DESKTOP:
        return this.getClaudeConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.WINDSURF:
      case McpClientType.CASCADE:
        return this.getWindsurfConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CURSOR:
        return this.getCursorConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CLINE:
        return this.getClineConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CHATGPT:
      case McpClientType.OPENAI:
        return this.getChatGptConfigGuide(mcpName);

      case McpClientType.OTHER:
      default:
        return this.getDefaultConfigGuide(mcpName, baseConfigTemplate);
    }
  }

  /**
   * 标准化客户端类型
   * @param mcpClient - 用户输入的客户端名称
   * @returns 标准化的客户端类型
   */
  private normalizeClientType(mcpClient: string): McpClientType {
    const clientLower = mcpClient.toLowerCase().trim();

    if (clientLower === 'claude' || clientLower === 'claude desktop') {
      return clientLower as McpClientType;
    }

    if (clientLower === 'windsurf' || clientLower === 'cascade') {
      return clientLower as McpClientType;
    }

    if (clientLower === 'cursor') {
      return McpClientType.CURSOR;
    }

    if (clientLower === 'cline') {
      return McpClientType.CLINE;
    }

    if (clientLower === 'chatgpt' || clientLower === 'openai') {
      return clientLower as McpClientType;
    }

    return McpClientType.OTHER;
  }

  /**
   * 获取基本配置模板
   * @param mcpName - MCP服务器名称
   * @returns 配置模板字符串
   */
  private getBaseConfigTemplate(mcpName: string): string {
    return JSON.stringify(
      {
        mcpServers: {
          [mcpName]: {
            command: 'npx',
            args: ['-y', '<actual-server-package>'],
            env: {},
          },
        },
      },
      null,
      2,
    );
  }

  /**
   * 获取Claude Desktop的 configuration guide
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns  configuration guide文本
   */
  private getClaudeConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Claude Desktop configuration guide

Add the configuration below to Claude Desktop's MCP configuration file:

${baseConfigTemplate}

Configuration file locations:
- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
- Windows: %AppData%\\Claude\\claude_desktop_config.json

Restart Claude Desktop after saving the configuration.`;
  }

  /**
   * 获取Windsurf/Cascade的 configuration guide
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns  configuration guide文本
   */
  private getWindsurfConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Windsurf/Cascade configuration guide

Add the configuration below to Windsurf's MCP configuration file:

${baseConfigTemplate}

Configuration file locations:
- MacOS/Linux: ~/.codeium/windsurf/mcp_config.json
- Windows: %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json

Restart Windsurf/Cascade after saving the configuration.`;
  }

  /**
   * 获取Cursor的 configuration guide
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns  configuration guide文本
   */
  private getCursorConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Cursor configuration guide

Add the configuration below to Cursor's MCP configuration file:

${baseConfigTemplate}

Configuration file locations:
- MacOS/Linux: ~/.cursor/mcp_config.json
- Windows: %USERPROFILE%\\.cursor\\mcp_config.json

Configuration steps:
1. Create the file if it does not exist
2. Add the configuration above
3. Restart Cursor
4. Enable MCP in Cursor's settings if required

Configuration can vary by Cursor version; consult its current official documentation.`;
  }

  /**
   * 获取Cline的 configuration guide
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns  configuration guide文本
   */
  private getClineConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Cline configuration guide

Open the MCP server configuration from the Cline extension's MCP Servers view.
Merge the example server entry below into the configuration, using the actual
command, package and environment variables documented by the selected server.

${baseConfigTemplate}

Save the configuration and reconnect the server in Cline. Consult Cline's
current documentation if the configuration controls differ in your version.`;
  }

  /**
   * 获取ChatGPT/OpenAI的 configuration guide
   * @param mcpName - MCP服务器名称
   * @returns  configuration guide文本
   */
  private getChatGptConfigGuide(mcpName: string): string {
    return `## ChatGPT/OpenAI MCP integration

ChatGPT connectors and OpenAI API integrations can use supported remote MCP
servers. The stdio command configuration used by desktop clients is not a
ChatGPT connector configuration.

Check your client's current connector settings and remote MCP requirements.
Use the server's documented remote endpoint and authentication method; never
paste credentials into a public configuration example.

For OpenAI API integrations, see:
https://platform.openai.com/docs/guides/tools-remote-mcp`;
  }

  /**
   * 获取默认 configuration guide
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns  configuration guide文本
   */
  private getDefaultConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## MCP configuration guide

Add the configuration below to your MCP client's configuration:

${baseConfigTemplate}

Common configuration file locations:
- Claude Desktop (macOS): ~/Library/Application Support/Claude/claude_desktop_config.json
- Claude Desktop (Windows): %AppData%\\Claude\\claude_desktop_config.json
- Windsurf/Cascade (MacOS/Linux): ~/.codeium/windsurf/mcp_config.json
- Windsurf/Cascade (Windows): %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json
- Cursor (MacOS/Linux): ~/.cursor/mcp_config.json
- Cursor (Windows): %USERPROFILE%\\.cursor\\mcp_config.json
- Cline: open the MCP server configuration from the extension's MCP Servers view

Restart your MCP client after saving the configuration.`;
  }
}

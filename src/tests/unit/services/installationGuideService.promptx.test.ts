import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstallationGuideService } from '../../../services/core/installation/installationGuideService.js';

describe('InstallationGuideService - PromptX Integration', () => {
  let service: InstallationGuideService;

  beforeEach(() => {
    service = new InstallationGuideService();
  });

  describe('PromptX MCP Server Configuration', () => {
    it('should correctly extract and format PromptX MCP configuration', async () => {
      const githubUrl = 'https://github.com/Deepractice/PromptX';
      const mcpName = 'PromptX';

      // Mock the README content with PromptX-style MCP configuration
      const mockReadmeContent = `
# PromptX

## 🚀 **一键启动，30秒完成配置**

打开配置文件，将下面的 \`promptx\` 配置代码复制进去。这是最简单的 **零配置模式**，PromptX 会自动为您处理一切。

\`\`\`json
{
  "mcpServers": {
    "promptx": {
      // 指定使用 npx 运行 promptx 服务
      "command": "npx",
      // '-y' 自动确认, '-f' 强制刷新缓存, 'dpml-prompt@snapshot' 使用最新版, 'mcp-server' 启动服务
      "args": ["-y", "-f", "dpml-prompt@snapshot", "mcp-server"]
    }
  }
}
\`\`\`

**🎯 就这么简单！** 保存文件并重启您的AI应用，PromptX 就已成功激活。

🔧 如果您想指定一个特定的文件夹作为 PromptX 的工作区，可以添加 \`env\` 环境变量。

\`\`\`json
{
  "mcpServers": {
    "promptx": {
      "command": "npx",
      "args": ["-y", "-f", "dpml-prompt@snapshot", "mcp-server"],
      "env": {
        // PROMPTX_WORKSPACE: 自定义工作空间路径 (可选，系统会自动识别)
        // Windows: "D:\\\\path\\\\to\\\\your\\\\project" (注意使用双反斜杠)
        // macOS/Linux: "/Users/username/path/your/project"
        "PROMPTX_WORKSPACE": "/your/custom/workspace/path"
      }
    }
  }
}
\`\`\`

### ⚙️ **工作原理**
PromptX 作为您和AI应用之间的"专业能力中间件"，通过标准的 MCP协议 进行通信。

#### **支持MCP的AI应用**

| AI应用 | 状态 | 配置文件位置 | 特性 |
|--------|--------|-----------|------|
| **Claude Desktop** | ✅ 官方支持 | Windows: \`%APPDATA%\\Claude\\claude_desktop_config.json\`<br/>macOS: \`~/Library/Application Support/Claude/claude_desktop_config.json\` | Anthropic官方客户端，MCP原生支持 |
| **Cursor** | ✅ 支持 | 通过MCP设置面板配置 | 智能代码编辑器，开发者友好 |
| **Windsurf** | ✅ 支持 | IDE内MCP配置面板 | Codeium推出的AI原生IDE |
`;

      // Mock the fetchGitHubReadme function
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockReadmeContent),
      } as Response);

      try {
        const guide = await service.generateInstallationGuide(
          githubUrl,
          mcpName,
        );

        // Verify that the guide contains MCP-specific content
        expect(guide).toContain('MCP server configuration');
        expect(guide).toContain('Model Context Protocol');
        expect(guide).toContain('integrated through');

        // Verify that it contains the JSON configuration
        expect(guide).toContain('"mcpServers"');
        expect(guide).toContain('"command": "npx"');
        expect(guide).toContain('dpml-prompt@snapshot');

        // Verify Claude Desktop configuration guidance
        expect(guide).toContain('Claude Desktop configuration');
        expect(guide).toContain('claude_desktop_config.json');
        expect(guide).toContain('%APPDATA%');
        expect(guide).toContain('~/Library/Application Support/Claude');

        // Verify NPX-specific guidance
        expect(guide).toContain('Notes');
        expect(guide).toContain('Node.js');
        expect(guide).toContain('first run may download dependencies');

        // Verify environment variable guidance
        expect(guide).toContain('Environment variables');
        expect(guide).toContain('env');

        // Verify other MCP clients are mentioned
        expect(guide).toContain('Other MCP clients');
        expect(guide).toContain('Cursor');
        expect(guide).toContain('Windsurf');

        console.log('Generated guide for PromptX:');
        console.log(guide);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle traditional installation when no MCP config is found', async () => {
      const githubUrl = 'https://github.com/example/traditional-project';
      const mcpName = 'TraditionalProject';

      // Mock README without MCP configuration
      const mockReadmeContent = `
# Traditional Project

## Installation

1. Clone the repository
2. Install dependencies with npm install
3. Run the project with npm start

## Usage

This is a traditional Node.js project.
`;

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockReadmeContent),
      } as Response);

      try {
        const guide = await service.generateInstallationGuide(
          githubUrl,
          mcpName,
        );

        // Should not contain MCP-specific content
        expect(guide).not.toContain('MCP server configuration');
        expect(guide).not.toContain('claude_desktop_config');

        // Should contain traditional installation guidance
        expect(guide).toContain('Installation steps');
        expect(guide).toContain('Clone the repository');
        expect(guide).toContain('General installation steps');
        expect(guide).toContain('git clone');
        expect(guide).toContain('npm install');

        console.log('Generated guide for traditional project:');
        console.log(guide);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should extract JSON config blocks even without clear section headers', async () => {
      const githubUrl = 'https://github.com/example/mcp-minimal';
      const mcpName = 'MCPMinimal';

      // Mock README with JSON config but no clear headers
      const mockReadmeContent = `
# MCP Minimal

Add this to your configuration:

\`\`\`json
{
  "mcpServers": {
    "minimal": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
\`\`\`

That's it!
`;

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockReadmeContent),
      } as Response);

      try {
        const guide = await service.generateInstallationGuide(
          githubUrl,
          mcpName,
        );

        // Should detect and extract MCP configuration
        expect(guide).toContain('MCP server configuration');
        expect(guide).toContain('"mcpServers"');
        expect(guide).toContain('"command": "node"');
        expect(guide).toContain('server.js');

        console.log('Generated guide for minimal MCP project:');
        console.log(guide);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

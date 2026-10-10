import { describe, expect, it } from 'vitest';
import { ConfigurationGuideService } from '../../../services/core/installation/configurationGuideService.js';
import { InstallationGuideService } from '../../../services/core/installation/installationGuideService.js';
import { InstallMcpServerToolHandler } from '../../../services/core/server/tools/InstallMcpServerToolHandler.js';
import { RecommendMcpServerToolHandler } from '../../../services/core/server/tools/RecommendMcpServerToolHandler.js';
import { SearchService } from '../../../services/searchService.js';

describe('English user-facing MCP guidance', () => {
  it.each([
    'claude',
    'Claude Desktop',
    'windsurf',
    'cascade',
    'cursor',
    'cline',
    'chatgpt',
    'openai',
    'unknown',
    '',
  ])('provides English configuration guidance for %s', client => {
    const guide = new ConfigurationGuideService().generateConfigurationGuide(
      'filesystem',
      client,
    );
    expect(guide).not.toMatch(/[\p{Script=Han}]/u);
    expect(guide).toMatch(/configuration|integration/);
  });

  it('uses valid JSON when a server name contains quotes', () => {
    const guide = new ConfigurationGuideService().generateConfigurationGuide(
      'server"name',
      'claude',
    );
    const start = guide.indexOf('{');
    const end = guide.lastIndexOf('}');
    expect(
      JSON.parse(guide.slice(start, end + 1)).mcpServers['server"name'].command,
    ).toBe('npx');
  });

  it.each([
    null,
    '# Project\nNo installation instructions.',
    '# Installation\nRun npm install.',
  ])('provides English installation and fallback guidance', async readme => {
    const service = new InstallationGuideService({
      extractReadmeContent: async () => readme,
    });
    const guide = await service.generateInstallationGuide(
      'https://github.com/example/server',
      'server',
    );
    expect(guide).not.toMatch(/[\p{Script=Han}]/u);
    expect(guide).toContain('https://github.com/example/server');
    expect(guide).toContain('Installation');
  });

  it('returns English fallback guidance on a README retrieval error', async () => {
    const service = new InstallationGuideService({
      extractReadmeContent: async () => {
        throw new Error('offline');
      },
    });
    const guide = await service.generateInstallationGuide(
      'https://github.com/example/server',
      'server',
    );
    expect(guide).toContain('README could not be retrieved');
    expect(guide).not.toMatch(/[\p{Script=Han}]/u);
  });

  it('exposes English tool and parameter descriptions without changing wire names', () => {
    const install = new InstallMcpServerToolHandler().getToolDefinition();
    const recommend = new RecommendMcpServerToolHandler(
      new SearchService([], { enabled: false }),
    ).getToolDefinition();
    expect(install.name).toBe('install-mcp-server');
    expect(recommend.name).toBe('recommend-mcp-servers');
    for (const tool of [install, recommend]) {
      expect(tool.description).not.toMatch(/[\p{Script=Han}]/u);
      for (const field of Object.values(tool.inputSchema.properties)) {
        expect(field.description).not.toMatch(/[\p{Script=Han}]/u);
      }
    }
  });

  it('preserves third-party README content rather than changing its commands or prose', async () => {
    const text =
      '# Installation\nRun npm install --production.\n用户提供的说明。';
    const service = new InstallationGuideService({
      extractReadmeContent: async () => text,
    });
    expect(
      await service.generateInstallationGuide(
        'https://github.com/example/server',
        'server',
      ),
    ).toContain('用户提供的说明');
  });
});

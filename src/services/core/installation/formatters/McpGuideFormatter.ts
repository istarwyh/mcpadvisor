import { IInstallationGuideFormatter } from '../interfaces/IInstallationGuideFormatter.js';
import {
  InstallationGuideContext,
  GuideGenerationResult,
  InstallationContentType,
} from '../types/InstallationGuideTypes.js';

/**
 * MCP guide formatter
 * Specialized in formatting MCP server installation guides
 */
export class McpGuideFormatter implements IInstallationGuideFormatter {
  /**
   * Format MCP installation guide based on context
   * @param context - Installation guide context
   * @returns Formatted guide result
   */
  public formatGuide(context: InstallationGuideContext): GuideGenerationResult {
    try {
      let guide = `Installation and configuration guide for ${context.mcpName} MCP server.\n\n`;
      guide += `GitHub repository: ${context.githubUrl}\n\n`;
      guide += `## MCP server configuration\n\n`;
      guide += `This MCP (Model Context Protocol) server is integrated through your client's configuration:\n\n`;

      if (context.installationSection) {
        guide += `${context.installationSection.content}\n\n`;
        guide += this.generateMcpSpecificGuidance(
          context.installationSection.content,
        );
      }

      guide += this.generateHelpSection(context.githubUrl);

      return {
        content: guide,
        type: InstallationContentType.MCP_CONFIGURATION,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        type: InstallationContentType.MCP_CONFIGURATION,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if this formatter can handle the given context
   * @param context - Installation guide context
   * @returns True if this formatter can handle the context
   */
  public canHandle(context: InstallationGuideContext): boolean {
    return (
      context.installationSection?.type ===
      InstallationContentType.MCP_CONFIGURATION
    );
  }

  /**
   * Get the priority of this formatter (higher number = higher priority)
   * @returns Priority number
   */
  public getPriority(): number {
    return 100; // High priority for MCP configurations
  }

  /**
   * Generate MCP-specific configuration guidance
   * @param installationContent - Installation section content
   * @returns MCP-specific guidance
   */
  private generateMcpSpecificGuidance(installationContent: string): string {
    let guidance = `## Configuration details\n\n`;

    // Claude Desktop configuration guidance
    if (this.containsClaudeDesktopConfig(installationContent)) {
      guidance += this.generateClaudeDesktopGuidance();
    }

    // Other MCP clients guidance
    if (this.containsOtherMcpClients(installationContent)) {
      guidance += this.generateOtherClientsGuidance();
    }

    // Environment variables guidance
    if (this.containsEnvironmentVariables(installationContent)) {
      guidance += this.generateEnvironmentVariablesGuidance();
    }

    // NPX-specific guidance
    if (this.containsNpxUsage(installationContent)) {
      guidance += this.generateNpxGuidance();
    }

    return guidance;
  }

  /**
   * Check if content contains Claude Desktop configuration
   * @param content - Content to check
   * @returns True if contains Claude Desktop config
   */
  private containsClaudeDesktopConfig(content: string): boolean {
    return (
      content.includes('claude_desktop_config') ||
      content.includes('Claude Desktop')
    );
  }

  /**
   * Check if content mentions other MCP clients
   * @param content - Content to check
   * @returns True if mentions other clients
   */
  private containsOtherMcpClients(content: string): boolean {
    return content.includes('Cursor') || content.includes('Windsurf');
  }

  /**
   * Check if content contains environment variables
   * @param content - Content to check
   * @returns True if contains env vars
   */
  private containsEnvironmentVariables(content: string): boolean {
    return (
      content.includes('"env"') ||
      content.includes('环境变量') ||
      /environment variables/i.test(content)
    );
  }

  /**
   * Check if content uses NPX
   * @param content - Content to check
   * @returns True if uses NPX
   */
  private containsNpxUsage(content: string): boolean {
    return content.includes('npx');
  }

  /**
   * Generate Claude Desktop configuration guidance
   * @returns Claude Desktop guidance
   */
  private generateClaudeDesktopGuidance(): string {
    let guidance = `### Claude Desktop configuration\n\n`;
    guidance += `1. Locate the Claude Desktop configuration file:\n`;
    guidance += `   - **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`\n`;
    guidance += `   - **macOS**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`\n`;
    guidance += `   - **Linux**: \`~/.config/claude/claude_desktop_config.json\`\n\n`;
    guidance += `2. Add the JSON configuration above to the file\n`;
    guidance += `3. Save the file and restart Claude Desktop\n\n`;
    return guidance;
  }

  /**
   * Generate other MCP clients guidance
   * @returns Other clients guidance
   */
  private generateOtherClientsGuidance(): string {
    let guidance = `### Other MCP clients\n\n`;
    guidance += `For other clients, such as Cursor and Windsurf, follow the client's current MCP configuration documentation.\n\n`;
    return guidance;
  }

  /**
   * Generate environment variables guidance
   * @returns Environment variables guidance
   */
  private generateEnvironmentVariablesGuidance(): string {
    let guidance = `### Environment variables\n\n`;
    guidance += `To customize the working directory or other settings, add an \`env\` field to the configuration.\n\n`;
    return guidance;
  }

  /**
   * Generate NPX usage guidance
   * @returns NPX guidance
   */
  private generateNpxGuidance(): string {
    let guidance = `### Notes\n\n`;
    guidance += `- This server uses \`npx\`; make sure Node.js is installed\n`;
    guidance += `- The first run may download dependencies\n`;
    guidance += `- For network failures, verify connectivity and your configured npm registry\n\n`;
    return guidance;
  }

  /**
   * Generate help section
   * @param githubUrl - GitHub repository URL
   * @returns Help section
   */
  private generateHelpSection(githubUrl: string): string {
    let help = `## Need help?\n\n`;
    help += `If you encounter installation problems:\n`;
    help += `- Check the project's [Issues page](${githubUrl}/issues)\n`;
    help += `- Open an issue with the error and reproduction steps\n`;
    help += `- Check the project documentation for more details\n`;
    return help;
  }
}

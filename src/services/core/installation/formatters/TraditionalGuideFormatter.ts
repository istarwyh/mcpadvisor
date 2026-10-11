import { IInstallationGuideFormatter } from '../interfaces/IInstallationGuideFormatter.js';
import {
  InstallationGuideContext,
  GuideGenerationResult,
  InstallationContentType,
} from '../types/InstallationGuideTypes.js';

/**
 * Traditional guide formatter
 * Specialized in formatting traditional installation guides
 */
export class TraditionalGuideFormatter implements IInstallationGuideFormatter {
  /**
   * Format traditional installation guide based on context
   * @param context - Installation guide context
   * @returns Formatted guide result
   */
  public formatGuide(context: InstallationGuideContext): GuideGenerationResult {
    try {
      let guide = `Installation and configuration guide for ${context.mcpName} MCP server.\n\n`;
      guide += `GitHub repository: ${context.githubUrl}\n\n`;

      if (context.installationSection) {
        guide += `## Installation steps\n\n`;
        guide += `From the project's README:\n\n${context.installationSection.content}\n\n`;
      } else {
        guide += `## Project information\n\n`;
        guide += `The README has no dedicated installation section. Start with the project information below.\n\n`;
      }

      guide += this.generateTraditionalInstallationGuidance(
        context.githubUrl,
        context.repoName,
      );
      guide += this.generateHelpSection(context.githubUrl);

      return {
        content: guide,
        type: InstallationContentType.TRADITIONAL_INSTALLATION,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        type: InstallationContentType.TRADITIONAL_INSTALLATION,
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
        InstallationContentType.TRADITIONAL_INSTALLATION ||
      context.installationSection === null
    );
  }

  /**
   * Get the priority of this formatter (higher number = higher priority)
   * @returns Priority number
   */
  public getPriority(): number {
    return 10; // Low priority as fallback
  }

  /**
   * Generate traditional installation guidance
   * @param githubUrl - GitHub repository URL
   * @param repoName - Repository name
   * @returns Traditional installation guidance
   */
  private generateTraditionalInstallationGuidance(
    githubUrl: string,
    repoName: string,
  ): string {
    let guidance = `## General installation steps\n\n`;
    guidance += `For a typical Node.js project, use these steps as a starting point and check the repository's instructions:\n\n`;
    guidance += `1. **Clone the repository**:\n`;
    guidance += `   \`\`\`bash\n   git clone ${githubUrl}\n   \`\`\`\n\n`;
    guidance += `2. **Enter the project directory**:\n`;
    guidance += `   \`\`\`bash\n   cd ${repoName}\n   \`\`\`\n\n`;
    guidance += `3. **Install dependencies**:\n`;
    guidance += `   \`\`\`bash\n   npm install\n   # or\n   yarn install\n   # or\n   pnpm install\n   \`\`\`\n\n`;

    guidance += `## Configuration and execution\n\n`;
    guidance += `After installation, you may need to:\n\n`;
    guidance += `- Check the repository's environment-variable requirements (see \`.env.example\` file)\n`;
    guidance += `- Check \`package.json\` for server startup scripts\n`;
    guidance += `- Read the project documentation for application integration\n`;
    guidance += `- For an MCP server, follow your MCP client's configuration instructions\n\n`;

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

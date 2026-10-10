import { IReadmeContentExtractor } from './interfaces/IReadmeContentExtractor.js';
import {
  InstallationGuideContext,
  InstallationContentType,
} from './types/InstallationGuideTypes.js';
import { GitHubReadmeExtractor } from './extractors/GitHubReadmeExtractor.js';
import { ExtractorFactory } from './factories/ExtractorFactory.js';
import { FormatterFactory } from './factories/FormatterFactory.js';
import logger from '../../../utils/logger.js';

/**
 * Installation Guide Service
 * Follows SOLID principles with dependency injection and separation of concerns
 *
 * Single Responsibility: Orchestrates the installation guide generation process
 * Open/Closed: Extensible through new extractors and formatters without modification
 * Liskov Substitution: All extractors and formatters are interchangeable
 * Interface Segregation: Focused interfaces for specific responsibilities
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
export class InstallationGuideService {
  private readonly readmeExtractor: IReadmeContentExtractor;

  /**
   * Constructor with dependency injection
   * @param readmeExtractor - README content extractor (defaults to GitHub extractor)
   */
  constructor(readmeExtractor?: IReadmeContentExtractor) {
    this.readmeExtractor = readmeExtractor || new GitHubReadmeExtractor();
  }

  /**
   * Generate MCP installation guide
   * Main orchestration method that coordinates different components
   *
   * @param githubUrl - GitHub repository URL
   * @param mcpName - MCP name
   * @returns Installation guide content
   */
  public async generateInstallationGuide(
    githubUrl: string,
    mcpName: string,
  ): Promise<string> {
    try {
      // Step 1: Extract README content
      const readmeContent =
        await this.readmeExtractor.extractReadmeContent(githubUrl);

      if (!readmeContent) {
        return this.generateDefaultGuide(mcpName, githubUrl);
      }

      // Step 2: Create installation guide context
      const context = await this.createInstallationGuideContext(
        readmeContent,
        mcpName,
        githubUrl,
      );

      // Step 3: Select appropriate formatter and generate guide
      const formatter = FormatterFactory.getBestFormatter(context);
      const result = formatter.formatGuide(context);

      if (!result.success) {
        logger.error(`Failed to format guide: ${result.error}`);
        return this.generateDefaultGuide(mcpName, githubUrl);
      }

      return result.content;
    } catch (error) {
      logger.error(
        `Failed to generate installation guide: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.generateDefaultGuide(mcpName, githubUrl);
    }
  }

  /**
   * Create installation guide context by extracting relevant information
   * @param readmeContent - README content
   * @param mcpName - MCP name
   * @param githubUrl - GitHub repository URL
   * @returns Installation guide context
   */

  private async createInstallationGuideContext(
    readmeContent: string,
    mcpName: string,
    githubUrl: string,
  ): Promise<InstallationGuideContext> {
    // Extract repository name from URL
    const repoName = this.extractRepoName(githubUrl);

    // Select best extractor for the content
    const extractor = ExtractorFactory.getBestExtractor(readmeContent);

    // Extract installation section
    const installationSection =
      extractor.extractInstallationSection(readmeContent);

    return {
      mcpName,
      githubUrl,
      repoName,
      installationSection,
    };
  }

  /**
   * Generate default installation guide when README is not available
   * @param mcpName - MCP name
   * @param githubUrl - GitHub repository URL
   * @returns Default installation guide
   */
  private generateDefaultGuide(mcpName: string, githubUrl: string): string {
    const repoName = this.extractRepoName(githubUrl);

    let guide = `Installation and configuration guide for ${mcpName} MCP server.\n\n`;
    guide += `GitHub repository: ${githubUrl}\n\n`;
    guide += `## Installation steps\n\n`;
    guide += `The repository README could not be retrieved. These generic steps may help; verify the actual requirements in the repository:\n\n`;

    guide += `1. **Clone the repository**:\n`;
    guide += `   \`\`\`bash\n   git clone ${githubUrl}\n   \`\`\`\n\n`;
    guide += `2. **Enter the project directory**:\n`;
    guide += `   \`\`\`bash\n   cd ${repoName}\n   \`\`\`\n\n`;
    guide += `3. **Install dependencies**:\n`;
    guide += `   \`\`\`bash\n   npm install\n   \`\`\`\n\n`;
    guide += `4. **Read the project documentation**:\n`;
    guide += `   Check README.md, package.json and other repository documentation for the actual installation and configuration steps.\n\n`;

    guide += `## MCP configuration\n\n`;
    guide += `For an MCP server, you may need to:\n\n`;
    guide += `1. Read the repository's MCP client configuration instructions\n`;
    guide += `2. Add the server configuration to Claude Desktop or your selected MCP client\n`;
    guide += `3. Restart the client to load the configuration\n\n`;

    guide += `## Need help?\n\n`;
    guide += `- Check the project's [GitHub page](${githubUrl}) for current documentation\n`;
    guide += `- Check the project's [Issues page](${githubUrl}/issues) for known problems and solutions\n`;
    guide += `- Open an issue with the error and reproduction steps\n`;

    return guide;
  }

  /**
   * Extract repository name from GitHub URL
   * @param githubUrl - GitHub repository URL
   * @returns Repository name
   */
  /**
   * Extract repository name from GitHub URL
   * (kept public for backward-compatibility with existing tests)
   */
  private extractRepoName(githubUrl: string): string {
    try {
      const url = new URL(githubUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      let repo = pathParts[1] || 'unknown-repo';
      // Remove .git suffix if present for compatibility with legacy tests
      if (repo.endsWith('.git')) {
        repo = repo.replace(/\.git$/i, '');
      }
      return repo;
    } catch {
      return 'unknown-repo';
    }
  }
}

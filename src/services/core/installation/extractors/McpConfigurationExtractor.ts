import { IInstallationSectionExtractor } from '../interfaces/IInstallationSectionExtractor.js';
import {
  InstallationSection,
  InstallationContentType,
} from '../types/InstallationGuideTypes.js';

/**
 * MCP configuration extractor
 * Specialized in extracting MCP server configuration sections from README content
 */
export class McpConfigurationExtractor
  implements IInstallationSectionExtractor
{
  private readonly mcpKeywords = [
    'mcp',
    'mcpservers',
    'mcp server',
    'claude_desktop_config',
    'claude desktop',
    'model context protocol',
    'config.json',
    '配置文件',
    '一键启动',
    '30秒完成配置',
    '接入',
  ];

  /**
   * Extract MCP configuration section from README content
   * @param readmeContent - README content to extract from
   * @returns Installation section data or null if not found
   */
  public extractInstallationSection(
    readmeContent: string,
  ): InstallationSection | null {
    console.log(
      'First 500 characters of the README:',
      readmeContent.substring(0, 500),
    );

    // Try to find MCP configuration sections by headings
    const mcpConfigSection =
      this.extractMcpConfigSectionByHeadings(readmeContent);
    if (mcpConfigSection) {
      return {
        content: mcpConfigSection,
        type: InstallationContentType.MCP_CONFIGURATION,
        hasJsonConfig: this.containsJsonConfig(mcpConfigSection),
        mcpKeywords: this.findMcpKeywords(mcpConfigSection),
      };
    }

    // Try to extract JSON config blocks directly
    const jsonConfigSection = this.extractJsonConfigParagraphs(readmeContent);
    if (jsonConfigSection) {
      return {
        content: jsonConfigSection,
        type: InstallationContentType.MCP_CONFIGURATION,
        hasJsonConfig: true,
        mcpKeywords: this.findMcpKeywords(jsonConfigSection),
      };
    }

    return null;
  }

  /**
   * Check if this extractor can handle the given content
   * @param readmeContent - README content to check
   * @returns True if this extractor can handle the content
   */
  public canHandle(readmeContent: string): boolean {
    return this.containsMcpConfiguration(readmeContent);
  }

  /**
   * Get the priority of this extractor (higher number = higher priority)
   * @returns Priority number
   */
  public getPriority(): number {
    return 100; // High priority for MCP configurations
  }

  /**
   * Extract MCP configuration section by analyzing headings
   * @param readmeContent - README content
   * @returns MCP configuration section or null
   */
  private extractMcpConfigSectionByHeadings(
    readmeContent: string,
  ): string | null {
    const headings = this.extractHeadings(readmeContent);
    console.log('All discovered headings:', headings);

    // Find headings that contain MCP-related keywords
    const mcpHeadings = headings.filter(heading =>
      this.mcpKeywords.some(keyword =>
        heading.toLowerCase().includes(keyword.toLowerCase()),
      ),
    );

    console.log('Found MCP configuration headings:', mcpHeadings.join(', '));

    if (mcpHeadings.length > 0) {
      // Use the first MCP-related heading
      const targetHeading = mcpHeadings[0];
      const headingIndex = readmeContent.indexOf(targetHeading);
      return this.extractSectionContent(
        readmeContent,
        targetHeading,
        headingIndex,
      );
    }

    return null;
  }

  /**
   * Extract JSON configuration paragraphs that contain MCP config
   * @param readmeContent - README content
   * @returns JSON config section or null
   */
  private extractJsonConfigParagraphs(readmeContent: string): string | null {
    const jsonBlocks = this.extractJsonBlocks(readmeContent);

    for (const block of jsonBlocks) {
      if (this.containsMcpConfiguration(block)) {
        // Find the paragraph containing this JSON block
        const blockIndex = readmeContent.indexOf(block);
        const paragraphStart = this.findParagraphStart(
          readmeContent,
          blockIndex,
        );
        const paragraphEnd = this.findParagraphEnd(
          readmeContent,
          blockIndex + block.length,
        );

        return readmeContent.substring(paragraphStart, paragraphEnd).trim();
      }
    }

    return null;
  }

  /**
   * Check if content contains MCP configuration
   * @param content - Content to check
   * @returns True if contains MCP configuration
   */
  private containsMcpConfiguration(content: string): boolean {
    const lowerContent = content.toLowerCase();

    // Check for MCP-specific indicators
    const mcpIndicators = [
      '"mcpservers"',
      'mcpservers',
      'claude_desktop_config',
      'model context protocol',
      '"command"',
      '"args"',
    ];

    return (
      mcpIndicators.some(indicator => lowerContent.includes(indicator)) ||
      this.mcpKeywords.some(keyword =>
        lowerContent.includes(keyword.toLowerCase()),
      )
    );
  }

  /**
   * Check if content contains JSON configuration
   * @param content - Content to check
   * @returns True if contains JSON config
   */
  private containsJsonConfig(content: string): boolean {
    return (
      content.includes('"mcpServers"') ||
      content.includes('"command"') ||
      content.includes('"args"')
    );
  }

  /**
   * Find MCP keywords in content
   * @param content - Content to search
   * @returns Array of found keywords
   */
  private findMcpKeywords(content: string): string[] {
    const lowerContent = content.toLowerCase();
    return this.mcpKeywords.filter(keyword =>
      lowerContent.includes(keyword.toLowerCase()),
    );
  }

  /**
   * Extract headings from README content
   * @param content - README content
   * @returns Array of headings
   */
  private extractHeadings(content: string): string[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: string[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[0].trim());
    }

    return headings;
  }

  /**
   * Extract JSON blocks from content
   * @param content - Content to search
   * @returns Array of JSON blocks
   */
  private extractJsonBlocks(content: string): string[] {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
    const blocks: string[] = [];
    let match;

    while ((match = jsonBlockRegex.exec(content)) !== null) {
      blocks.push(match[1].trim());
    }

    return blocks;
  }

  /**
   * Extract section content under a specific heading
   * @param content - Full content
   * @param heading - Target heading
   * @param headingIndex - Index of the heading
   * @returns Section content
   */
  private extractSectionContent(
    content: string,
    heading: string,
    headingIndex: number,
  ): string {
    const headingLevel = (heading.match(/^#+/) || [''])[0].length;
    const afterHeading = content.substring(headingIndex + heading.length);

    // Find the next heading of the same or higher level
    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, 'm');
    const nextHeadingMatch = afterHeading.match(nextHeadingRegex);

    if (nextHeadingMatch) {
      const nextHeadingIndex = afterHeading.indexOf(nextHeadingMatch[0]);
      return (heading + afterHeading.substring(0, nextHeadingIndex)).trim();
    }

    // If no next heading found, take the rest of the content
    return (heading + afterHeading).trim();
  }

  /**
   * Find the start of a paragraph containing the given index
   * @param content - Full content
   * @param index - Target index
   * @returns Start index of paragraph
   */
  private findParagraphStart(content: string, index: number): number {
    let start = index;
    while (start > 0 && content[start - 1] !== '\n') {
      start--;
    }

    // Go back to find the actual paragraph start (after double newline)
    while (
      start > 1 &&
      !(content[start - 2] === '\n' && content[start - 1] === '\n')
    ) {
      start--;
    }

    return start;
  }

  /**
   * Find the end of a paragraph starting from the given index
   * @param content - Full content
   * @param index - Start index
   * @returns End index of paragraph
   */
  private findParagraphEnd(content: string, index: number): number {
    let end = index;
    let newlineCount = 0;

    while (end < content.length) {
      if (content[end] === '\n') {
        newlineCount++;
        if (newlineCount >= 2) {
          break;
        }
      } else if (content[end] !== '\r') {
        newlineCount = 0;
      }
      end++;
    }

    return end;
  }
}

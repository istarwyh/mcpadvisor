import { IInstallationSectionExtractor } from '../interfaces/IInstallationSectionExtractor.js';
import {
  InstallationSection,
  InstallationContentType,
} from '../types/InstallationGuideTypes.js';

/**
 * Traditional installation extractor
 * Specialized in extracting traditional installation sections from README content
 */
export class TraditionalInstallationExtractor
  implements IInstallationSectionExtractor
{
  private readonly installationKeywords = [
    'installation',
    '安装',
    'setup',
    '设置',
    'getting started',
    '开始',
    'quick start',
    '快速开始',
    'install',
    'how to install',
    '如何安装',
    'usage',
    '使用',
    'running',
    '运行',
  ];

  /**
   * Extract traditional installation section from README content
   * @param readmeContent - README content to extract from
   * @returns Installation section data or null if not found
   */
  public extractInstallationSection(
    readmeContent: string,
  ): InstallationSection | null {
    const headings = this.extractHeadings(readmeContent);
    console.log('All discovered headings:', headings);

    let bestScore = 0;
    let bestMatch: { heading: string; index: number } | null = null;

    // Score each heading based on installation keywords
    for (const heading of headings) {
      const lowerHeading = heading.toLowerCase();
      let score = 0;

      for (const keyword of this.installationKeywords) {
        if (lowerHeading.includes(keyword)) {
          // Exact match gets higher score
          if (
            lowerHeading === `## ${keyword}` ||
            lowerHeading === `# ${keyword}`
          ) {
            score += 10;
          } else {
            score += 5;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          heading,
          index: readmeContent.indexOf(heading),
        };
      }
    }

    if (bestMatch) {
      console.log('Best matching heading:', bestMatch.heading);
      const content = this.extractSectionContent(
        readmeContent,
        bestMatch.heading,
        bestMatch.index,
      );

      return {
        content,
        type: InstallationContentType.TRADITIONAL_INSTALLATION,
        hasJsonConfig: false,
        mcpKeywords: [],
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
    // This extractor can handle any content as a fallback
    return true;
  }

  /**
   * Get the priority of this extractor (higher number = higher priority)
   * @returns Priority number
   */
  public getPriority(): number {
    return 10; // Low priority as fallback
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
}

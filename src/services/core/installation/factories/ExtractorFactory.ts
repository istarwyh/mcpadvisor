import { IInstallationSectionExtractor } from '../interfaces/IInstallationSectionExtractor.js';
import { McpConfigurationExtractor } from '../extractors/McpConfigurationExtractor.js';
import { TraditionalInstallationExtractor } from '../extractors/TraditionalInstallationExtractor.js';

/**
 * Factory for creating installation section extractors
 * Implements the Factory pattern to select appropriate extractors
 */
export class ExtractorFactory {
  private static extractors: IInstallationSectionExtractor[] = [
    new McpConfigurationExtractor(),
    new TraditionalInstallationExtractor(),
  ];

  /**
   * Get the best extractor for the given README content
   * @param readmeContent - README content to analyze
   * @returns Best matching extractor
   */
  public static getBestExtractor(
    readmeContent: string,
  ): IInstallationSectionExtractor {
    // Find all extractors that can handle the content
    const capableExtractors = this.extractors.filter(extractor =>
      extractor.canHandle(readmeContent),
    );

    // Sort by priority (highest first)
    capableExtractors.sort((a, b) => b.getPriority() - a.getPriority());

    // Return the highest priority extractor, or fallback to traditional
    return capableExtractors[0] || new TraditionalInstallationExtractor();
  }

  /**
   * Get all available extractors
   * @returns Array of all extractors
   */
  public static getAllExtractors(): IInstallationSectionExtractor[] {
    return [...this.extractors];
  }

  /**
   * Register a new extractor
   * @param extractor - Extractor to register
   */
  public static registerExtractor(
    extractor: IInstallationSectionExtractor,
  ): void {
    this.extractors.push(extractor);
  }
}

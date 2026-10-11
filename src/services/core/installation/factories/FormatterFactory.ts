import { IInstallationGuideFormatter } from '../interfaces/IInstallationGuideFormatter.js';
import { InstallationGuideContext } from '../types/InstallationGuideTypes.js';
import { McpGuideFormatter } from '../formatters/McpGuideFormatter.js';
import { TraditionalGuideFormatter } from '../formatters/TraditionalGuideFormatter.js';

/**
 * Factory for creating installation guide formatters
 * Implements the Factory pattern to select appropriate formatters
 */
export class FormatterFactory {
  private static formatters: IInstallationGuideFormatter[] = [
    new McpGuideFormatter(),
    new TraditionalGuideFormatter(),
  ];

  /**
   * Get the best formatter for the given context
   * @param context - Installation guide context
   * @returns Best matching formatter
   */
  public static getBestFormatter(
    context: InstallationGuideContext,
  ): IInstallationGuideFormatter {
    // Find all formatters that can handle the context
    const capableFormatters = this.formatters.filter(formatter =>
      formatter.canHandle(context),
    );

    // Sort by priority (highest first)
    capableFormatters.sort((a, b) => b.getPriority() - a.getPriority());

    // Return the highest priority formatter, or fallback to traditional
    return capableFormatters[0] || new TraditionalGuideFormatter();
  }

  /**
   * Get all available formatters
   * @returns Array of all formatters
   */
  public static getAllFormatters(): IInstallationGuideFormatter[] {
    return [...this.formatters];
  }

  /**
   * Register a new formatter
   * @param formatter - Formatter to register
   */
  public static registerFormatter(
    formatter: IInstallationGuideFormatter,
  ): void {
    this.formatters.push(formatter);
  }
}

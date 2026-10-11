import {
  InstallationGuideContext,
  GuideGenerationResult,
} from '../types/InstallationGuideTypes.js';

/**
 * Interface for formatting installation guides
 */
export interface IInstallationGuideFormatter {
  /**
   * Format installation guide based on context
   * @param context - Installation guide context
   * @returns Formatted guide result
   */
  formatGuide(context: InstallationGuideContext): GuideGenerationResult;

  /**
   * Check if this formatter can handle the given context
   * @param context - Installation guide context
   * @returns True if this formatter can handle the context
   */
  canHandle(context: InstallationGuideContext): boolean;

  /**
   * Get the priority of this formatter (higher number = higher priority)
   * @returns Priority number
   */
  getPriority(): number;
}

import { ClineSearchProvider } from '../services/core/search/ClineSearchProvider.js';

/** Explicit opt-in; keep existing sources unchanged when unset or false. */
export function createOptionalClineProvider(
  enabled: string | undefined = process.env.CLINE_MARKETPLACE_ENABLED,
): ClineSearchProvider | undefined {
  if (enabled === undefined || enabled === '' || enabled === 'false') return;
  if (enabled !== 'true') {
    throw new Error('CLINE_MARKETPLACE_ENABLED must be "true" or "false"');
  }
  return new ClineSearchProvider();
}

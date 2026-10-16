import assert from 'node:assert/strict';
import { loadConfig } from '../../../build/config/configLoader.js';
import { McpConfigurationExtractor } from '../../../build/services/core/installation/extractors/McpConfigurationExtractor.js';
import { TraditionalInstallationExtractor } from '../../../build/services/core/installation/extractors/TraditionalInstallationExtractor.js';
import logger from '../../../build/utils/logger.js';

assert.equal(loadConfig().stdioRegression, true);
assert.ok(
  new McpConfigurationExtractor().extractInstallationSection(
    '# Example\n## MCP Configuration\n```json\n{"mcpServers":{"example":{"command":"example"}}}\n```',
  ),
);
assert.ok(
  new TraditionalInstallationExtractor().extractInstallationSection(
    '# Example\n## Installation\nRun npm install example.\n',
  ),
);
for (const level of ['error', 'warn', 'info', 'http', 'debug']) {
  logger[level](`STDIO_LOG_LEVEL_${level}`);
}

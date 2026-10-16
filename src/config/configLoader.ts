import config from 'config';
import path from 'path';
import fs from 'fs';

/**
 * Loads and merges configuration from multiple sources in order of precedence:
 * 1. Command line arguments
 * 2. Environment variables
 * 3. Custom config file specified by CONFIG_FILE env variable
 * 4. Additional MCP sources specified by MCP_SOURCES_FILE env variable
 * 5. Default config
 */
export function loadConfig() {
  try {
    // Check for custom config file from environment variable
    const customConfigPath = process.env.CONFIG_FILE;
    if (customConfigPath && fs.existsSync(customConfigPath)) {
      // Process.cwd() is used for relative paths
      const absolutePath = path.isAbsolute(customConfigPath)
        ? customConfigPath
        : path.join(process.cwd(), customConfigPath);

      console.error(`Loading custom config from: ${absolutePath}`);

      // For JSON files
      if (absolutePath.endsWith('.json')) {
        const customConfig = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
        return mergeConfigs(config, customConfig);
      }

      // For JS/TS files
      if (absolutePath.endsWith('.js') || absolutePath.endsWith('.ts')) {
        // Dynamic import for ESM
        return import(absolutePath).then(module =>
          mergeConfigs(config, module.default || module),
        );
      }
    }

    // Check for environment variable overrides for specific fields
    const envConfig = loadEnvironmentOverrides();
    return mergeConfigs(config, envConfig);
  } catch (error) {
    console.error('Error loading custom configuration:', error);
    return config; // Fallback to default config
  }
}

/**
 * Load configuration overrides from environment variables
 */
function loadEnvironmentOverrides() {
  const envConfig: Record<string, any> = {};

  // Load additional MCP sources from a separate file
  if (process.env.MCP_SOURCES_FILE) {
    try {
      const sourcesFilePath = process.env.MCP_SOURCES_FILE;
      const absolutePath = path.isAbsolute(sourcesFilePath)
        ? sourcesFilePath
        : path.join(process.cwd(), sourcesFilePath);

      if (fs.existsSync(absolutePath)) {
        const additionalSources = JSON.parse(
          fs.readFileSync(absolutePath, 'utf8'),
        );
        envConfig.mcp_sources = additionalSources.mcp_sources || {};
        if (additionalSources.mcp_index_fields) {
          envConfig.mcp_index_fields = additionalSources.mcp_index_fields;
        }
      }
    } catch (e) {
      console.error('Failed to parse MCP_SOURCES_FILE:', e);
    }
  }

  // MCP sources from environment variables
  if (process.env.MCP_REMOTE_URLS) {
    try {
      envConfig.mcp_sources = envConfig.mcp_sources || {};
      envConfig.mcp_sources.remote_urls = JSON.parse(
        process.env.MCP_REMOTE_URLS,
      );
    } catch (e) {
      console.error('Failed to parse MCP_REMOTE_URLS environment variable');
    }
  }

  if (process.env.MCP_LOCAL_FILES) {
    try {
      envConfig.mcp_sources = envConfig.mcp_sources || {};
      envConfig.mcp_sources.local_files = JSON.parse(
        process.env.MCP_LOCAL_FILES,
      );
    } catch (e) {
      console.error('Failed to parse MCP_LOCAL_FILES environment variable');
    }
  }

  // Index field mappings from environment variable
  if (process.env.MCP_INDEX_FIELDS) {
    try {
      envConfig.mcp_index_fields = JSON.parse(process.env.MCP_INDEX_FIELDS);
    } catch (e) {
      console.error('Failed to parse MCP_INDEX_FIELDS environment variable');
    }
  }

  return envConfig;
}

/**
 * Deep merge two configuration objects
 */
function mergeConfigs(baseConfig: any, overrideConfig: any): any {
  const result = { ...baseConfig };

  for (const key in overrideConfig) {
    if (Object.prototype.hasOwnProperty.call(overrideConfig, key)) {
      if (
        typeof overrideConfig[key] === 'object' &&
        overrideConfig[key] !== null &&
        !Array.isArray(overrideConfig[key]) &&
        typeof baseConfig[key] === 'object' &&
        baseConfig[key] !== null &&
        !Array.isArray(baseConfig[key])
      ) {
        result[key] = mergeConfigs(baseConfig[key], overrideConfig[key]);
      } else {
        result[key] = overrideConfig[key];
      }
    }
  }

  return result;
}

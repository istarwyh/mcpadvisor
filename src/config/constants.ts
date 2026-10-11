/**
 * Application constants
 */

export const COMPASS_API_BASE =
  process.env.COMPASS_API_BASE || 'https://registry.mcphub.io';
export const SERVER_NAME = 'mcpadvisor';
export const SERVER_VERSION = '1.0.0';

// OceanBase configuration
export const OCEANBASE_URL = process.env.OCEANBASE_URL;
export const DB_MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS || 20);
export const DB_TABLE_NAME = 'mcp_vector_data';
export const VECTOR_ENGINE_TYPE = process.env.VECTOR_ENGINE_TYPE || 'oceanbase';
export const GETMCP_API_URL =
  process.env.GETMCP_API_URL || 'https://getmcp.io/api/servers.json';
export const CACHE_TTL_MS = 3600000; // 1 hour

import {
  TransportType,
  type TransportConfig,
} from '../services/core/server/types.js';

/** Small local CLI parser; startup must not import the deprecated REST SDK. */
export function getParamValue(
  name: string,
  argv = process.argv.slice(2),
): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    for (const key of [`--${name}`, name]) {
      if (argv[i].startsWith(`${key}=`)) return argv[i].slice(key.length + 1);
      if (argv[i] === key) return argv[i + 1];
    }
  }
  return undefined;
}

export function readTransportConfiguration(
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): { type: TransportType; config: TransportConfig } {
  const mode = getParamValue('mode', argv) ?? env.TRANSPORT_TYPE ?? 'stdio';
  if (mode === 'sse' || mode === 'rest') {
    throw new Error(
      'Legacy sse/rest modes are retired. Use --mode=http (/mcp, MCP 2026-07-28) or modern stdio. See docs/MCP_2026_MIGRATION.md.',
    );
  }
  if (mode !== 'stdio' && mode !== 'http')
    throw new Error(`Unsupported transport mode: ${mode}. Use stdio or http.`);
  if (
    getParamValue('endpoint', argv) ||
    getParamValue('messagePath', argv) ||
    env.ENDPOINT
  ) {
    throw new Error(
      'Legacy endpoint/messagePath settings are retired. Streamable HTTP uses the fixed /mcp endpoint.',
    );
  }
  const port = Number(getParamValue('port', argv) ?? env.SERVER_PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('SERVER_PORT/--port must be an integer from 1 to 65535.');
  const responseMode = env.MCP_HTTP_RESPONSE_MODE ?? 'auto';
  if (!['auto', 'json', 'sse'].includes(responseMode))
    throw new Error('MCP_HTTP_RESPONSE_MODE must be auto, json or sse.');
  const hostnames = (value: string | undefined): string[] | undefined => {
    if (value === undefined) return undefined;
    const names = value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    if (!names.length)
      throw new Error('MCP allowed host/origin lists must not be empty.');
    return names;
  };
  return {
    type: mode === 'stdio' ? TransportType.STDIO : TransportType.HTTP,
    config: {
      port,
      host: getParamValue('host', argv) ?? env.SERVER_HOST ?? '127.0.0.1',
      allowedHostnames: hostnames(env.MCP_ALLOWED_HOSTS),
      allowedOriginHostnames: hostnames(env.MCP_ALLOWED_ORIGINS),
      responseMode: responseMode as TransportConfig['responseMode'],
    },
  };
}

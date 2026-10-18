import { describe, expect, it } from 'vitest';
import {
  getParamValue,
  readTransportConfiguration,
} from '../../../config/mcpTransport.js';

describe('modern transport configuration', () => {
  it('defaults to modern stdio and loopback HTTP configuration', () => {
    expect(readTransportConfiguration([], {})).toEqual({
      type: 'stdio',
      config: {
        port: 3000,
        host: '127.0.0.1',
        responseMode: 'auto',
        allowedHostnames: undefined,
        allowedOriginHostnames: undefined,
      },
    });
  });
  it.each(
    [['--mode=http'], ['--mode', 'http'], ['mode=http']].map(args => ({
      args,
    })),
  )('accepts explicit HTTP arguments %j', ({ args }) => {
    expect(readTransportConfiguration(args, {}).type).toBe('http');
  });
  it.each(['sse', 'rest', 'unknown'])(
    'rejects %s instead of silently falling back to stdio',
    mode => {
      expect(() =>
        readTransportConfiguration([], { TRANSPORT_TYPE: mode }),
      ).toThrow(/retired|Unsupported/);
    },
  );
  it('parses explicit security and response options', () => {
    expect(
      readTransportConfiguration(['--mode=http', '--port=4000'], {
        SERVER_HOST: '0.0.0.0',
        MCP_ALLOWED_HOSTS: 'api.example.com',
        MCP_ALLOWED_ORIGINS: 'app.example.com, localhost',
        MCP_HTTP_RESPONSE_MODE: 'sse',
      }),
    ).toMatchObject({
      type: 'http',
      config: {
        port: 4000,
        host: '0.0.0.0',
        allowedHostnames: ['api.example.com'],
        allowedOriginHostnames: ['app.example.com', 'localhost'],
        responseMode: 'sse',
      },
    });
  });
  it.each(['0', '-1', '65536', 'abc', '3000oops'])(
    'rejects invalid port %s',
    SERVER_PORT => {
      expect(() => readTransportConfiguration([], { SERVER_PORT })).toThrow(
        /SERVER_PORT/,
      );
    },
  );
  it('rejects ignored legacy configuration and invalid response mode', () => {
    expect(() =>
      readTransportConfiguration(['--endpoint=/custom'], {}),
    ).toThrow(/fixed \/mcp/);
    expect(() => readTransportConfiguration([], { ENDPOINT: '/rest' })).toThrow(
      /retired/,
    );
    expect(() =>
      readTransportConfiguration([], { MCP_HTTP_RESPONSE_MODE: 'bad' }),
    ).toThrow(/MCP_HTTP_RESPONSE_MODE/);
    expect(() =>
      readTransportConfiguration([], { MCP_ALLOWED_HOSTS: ' , ' }),
    ).toThrow(/must not be empty/);
    expect(getParamValue('absent', [])).toBeUndefined();
  });
});

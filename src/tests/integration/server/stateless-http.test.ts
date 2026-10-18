import { afterEach, describe, expect, it, vi } from 'vitest';
import { request as nodeRequest, type Server as HttpListener } from 'node:http';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { McpServer, type McpServerFactory } from '@modelcontextprotocol/server';
import type { SearchService } from '../../../services/searchService.js';
import type { SearchParams } from '../../../types/search.js';
import type { BaseResourceHandler } from '../../../services/core/server/resources/BaseResourceHandler.js';
import {
  createMcpServerFactory,
  MCP_PROTOCOL_VERSION,
} from '../../../services/core/server/stateless/McpServerFactory.js';
import { StatelessHttpServer } from '../../../services/core/server/stateless/StatelessHttpServer.js';

const installation = vi.hoisted(() => ({
  guide: vi.fn(
    async (url: string, name: string) => `Install ${name} from ${url}`,
  ),
  configuration: vi.fn(
    (name: string, client: string) => `Configure ${name} for ${client}`,
  ),
}));
vi.mock(
  '../../../services/core/installation/installationGuideService.js',
  () => ({
    InstallationGuideService: class {
      generateInstallationGuide = installation.guide;
    },
  }),
);
vi.mock(
  '../../../services/core/installation/configurationGuideService.js',
  () => ({
    ConfigurationGuideService: class {
      generateConfigurationGuide = installation.configuration;
    },
  }),
);
vi.mock('../../../utils/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
const CLIENT_KEY = 'io.modelcontextprotocol/clientInfo';
const CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities';
const SERVER_KEY = 'io.modelcontextprotocol/serverInfo';
const RESOURCE_URI = 'test-log://private/current';

type RpcId = string | number;
interface RpcRequest {
  jsonrpc: '2.0';
  id: RpcId;
  method: string;
  params: Record<string, unknown>;
}
interface RpcResponse {
  jsonrpc: '2.0';
  id: RpcId | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: Record<string, unknown> };
}
interface RunningServer {
  server: StatelessHttpServer;
  listener: HttpListener;
  url: string;
}
const running: RunningServer[] = [];
const clients: Client[] = [];

function envelope(clientName = 'http-fixture'): Record<string, unknown> {
  return {
    [VERSION_KEY]: MCP_PROTOCOL_VERSION,
    [CLIENT_KEY]: { name: clientName, version: '1.0.0' },
    [CAPABILITIES_KEY]: {},
  };
}

function request(
  method: string,
  params: Record<string, unknown> = {},
  id: RpcId = 'same-id',
): RpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: { _meta: envelope(), ...params },
  };
}

function headersFor(body: RpcRequest): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
    'Mcp-Method': body.method,
  });
  if (body.method === 'tools/call' || body.method === 'prompts/get') {
    headers.set('Mcp-Name', String(body.params.name));
  } else if (body.method === 'resources/read') {
    headers.set('Mcp-Name', String(body.params.uri));
  }
  return headers;
}

async function post(url: string, body: RpcRequest, headers = headersFor(body)) {
  const response = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, body: (await response.json()) as RpcResponse };
}

// Fetch can normalize Host; use Node's raw request API to send the exact hostile header.
async function postWithExactHost(
  url: string,
  body: RpcRequest,
  headers: Headers,
) {
  return new Promise<{ response: { status: number }; body: RpcResponse }>(
    (resolve, reject) => {
      const outgoing = nodeRequest(
        `${url}/mcp`,
        {
          method: 'POST',
          headers: Object.fromEntries(headers.entries()),
        },
        response => {
          let text = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            text += chunk;
          });
          response.on('error', reject);
          response.on('end', () => {
            try {
              resolve({
                response: { status: response.statusCode ?? 0 },
                body: JSON.parse(text) as RpcResponse,
              });
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      outgoing.on('error', reject);
      outgoing.end(JSON.stringify(body));
    },
  );
}

function businessFixture(marker = 'catalog') {
  const search = vi.fn(async (params: SearchParams) => [
    {
      title: `${marker}:${params.taskDescription}`,
      description: `Result owned by ${marker}`,
      sourceUrl: `https://example.test/${marker}`,
      similarity: 0.95,
    },
  ]);
  // The real recommendation handler is retained; only its external search boundary is replaced.
  const service = { search } as unknown as SearchService;
  const resources: BaseResourceHandler = {
    async listResources() {
      return [
        {
          uri: RESOURCE_URI,
          name: 'isolated test log',
          mimeType: 'text/plain',
        },
      ];
    },
    async readResource(uri) {
      return {
        contents: [{ uri, mimeType: 'text/plain', text: `private:${marker}` }],
      };
    },
    supportsUri: uri => uri === RESOURCE_URI,
  };
  return { search, factory: createMcpServerFactory(service, [resources]) };
}

async function start(
  factory: McpServerFactory,
  responseMode: 'auto' | 'sse' = 'auto',
) {
  const server = new StatelessHttpServer(factory, { port: 0, responseMode });
  const listener = server.getApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    listener.once('listening', resolve);
    listener.once('error', reject);
  });
  const address = listener.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected a TCP listener');
  const entry = { server, listener, url: `http://127.0.0.1:${address.port}` };
  running.push(entry);
  return entry;
}

function expectPrivateComplete(body: RpcResponse) {
  expect(body.error).toBeUndefined();
  expect(body.result).toMatchObject({
    resultType: 'complete',
    ttlMs: 0,
    cacheScope: 'private',
  });
  expect(body.result?._meta).toHaveProperty(SERVER_KEY);
}

function decodeSse(text: string): RpcResponse[] {
  return text.split(/\r?\n\r?\n/).flatMap(frame => {
    const data = frame
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n');
    return data ? [JSON.parse(data) as RpcResponse] : [];
  });
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.close()));
  await Promise.all(
    running.splice(0).map(async ({ server, listener }) => {
      await server.close();
      listener.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        listener.close(error => (error ? reject(error) : resolve()));
      });
    }),
  );
});

describe('modern stateless HTTP entry', () => {
  it('serves real list/call requests before optional discovery, without initialization or sessions', async () => {
    const fixture = businessFixture();
    const { url } = await start(fixture.factory);
    const listed = await post(url, request('tools/list'));
    expect(listed.response.status).toBe(200);
    expectPrivateComplete(listed.body);
    expect(listed.body.result?.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'recommend-mcp-servers' }),
        expect.objectContaining({ name: 'install-mcp-server' }),
      ]),
    );
    const called = await post(
      url,
      request('tools/call', {
        name: 'recommend-mcp-servers',
        arguments: {
          taskDescription: 'find database tools',
          keywords: ['database'],
          capabilities: ['read'],
        },
      }),
    );
    expect(called.response.status).toBe(200);
    expect(called.body.result).toMatchObject({
      resultType: 'complete',
      isError: false,
    });
    expect(JSON.stringify(called.body.result?.content)).toContain(
      'catalog:find database tools',
    );
    expect(called.body.result).not.toHaveProperty('ttlMs');
    expect(fixture.search).toHaveBeenCalledWith({
      taskDescription: 'find database tools',
      keywords: ['database'],
      capabilities: ['read'],
    });
    const discovery = await post(url, request('server/discover'));
    expectPrivateComplete(discovery.body);
    expect(discovery.body.result?.supportedVersions).toEqual([
      MCP_PROTOCOL_VERSION,
    ]);
    for (const result of [listed, called, discovery]) {
      expect(result.response.headers.has('mcp-session-id')).toBe(false);
      expect(result.body.id).toBe('same-id');
      expect(JSON.stringify(result.body)).not.toContain('http-fixture');
    }
  });

  it('preserves query aliases and string keyword/capability normalization through SDK validation', async () => {
    const fixture = businessFixture();
    const { url } = await start(fixture.factory);
    const result = await post(
      url,
      request('tools/call', {
        name: 'recommend-mcp-servers',
        arguments: {
          query: 'find legacy database tools',
          keywords: 'database',
          capabilities: 'read',
        },
      }),
    );
    expect(result.response.status).toBe(200);
    expect(result.body.result).toMatchObject({
      resultType: 'complete',
      isError: false,
    });
    expect(JSON.stringify(result.body.result?.content)).toContain(
      'catalog:find legacy database tools',
    );
    expect(fixture.search).toHaveBeenCalledWith({
      taskDescription: 'find legacy database tools',
      keywords: ['database'],
      capabilities: ['read'],
    });
  });

  it('works with the pinned official 2.3.1 client and preserves installation business behavior', async () => {
    const { url } = await start(businessFixture().factory);
    const methods: string[] = [];
    const client = new Client(
      { name: 'official-fixture', version: '1.0.0' },
      {
        versionNegotiation: { mode: { pin: MCP_PROTOCOL_VERSION } },
      },
    );
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
        fetch: async (input, init) => {
          if (typeof init?.body === 'string') {
            methods.push((JSON.parse(init.body) as { method: string }).method);
          }
          return fetch(input, init);
        },
      }),
    );
    expect(client.getProtocolEra()).toBe('modern');
    expect((await client.listTools()).tools.map(tool => tool.name)).toContain(
      'install-mcp-server',
    );
    const result = await client.callTool({
      name: 'install-mcp-server',
      arguments: {
        mcpName: 'fixture-mcp',
        sourceUrl: 'https://example.test/repository',
        mcpClient: 'cline',
      },
    });
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Install fixture-mcp from https://example.test/repository\n\nConfigure fixture-mcp for cline',
      },
    ]);
    expect(installation.guide).toHaveBeenCalledWith(
      'https://example.test/repository',
      'fixture-mcp',
    );
    expect(installation.configuration).toHaveBeenCalledWith(
      'fixture-mcp',
      'cline',
    );
    expect(methods).toContain('server/discover');
    expect(methods).not.toContain('initialize');
    expect(methods).not.toContain('notifications/initialized');
  });

  it('lists and reads isolated resources with private zero-TTL hints and modern not-found errors', async () => {
    const { url } = await start(businessFixture('resource-owner').factory);
    const listed = await post(url, request('resources/list'));
    expectPrivateComplete(listed.body);
    expect(listed.body.result?.resources).toEqual([
      { uri: RESOURCE_URI, name: 'isolated test log', mimeType: 'text/plain' },
    ]);
    const read = await post(
      url,
      request('resources/read', { uri: RESOURCE_URI }),
    );
    expectPrivateComplete(read.body);
    expect(read.body.result?.contents).toEqual([
      {
        uri: RESOURCE_URI,
        mimeType: 'text/plain',
        text: 'private:resource-owner',
      },
    ]);
    const missing = await post(
      url,
      request('resources/read', { uri: 'test-log://other/private' }),
    );
    expect(missing.body.error?.code).toBe(-32602);
    expect(missing.body.result).toBeUndefined();
    expect(JSON.stringify(missing.body)).not.toContain(
      'private:resource-owner',
    );
  });

  it.each([
    [
      'missing envelope',
      (body: RpcRequest) => {
        delete body.params._meta;
      },
    ],
    [
      'missing capabilities',
      (body: RpcRequest) => {
        body.params._meta = { [VERSION_KEY]: MCP_PROTOCOL_VERSION };
      },
    ],
    [
      'malformed capabilities',
      (body: RpcRequest) => {
        body.params._meta = { ...envelope(), [CAPABILITIES_KEY]: 'invalid' };
      },
    ],
    [
      'malformed optional identity',
      (body: RpcRequest) => {
        body.params._meta = { ...envelope(), [CLIENT_KEY]: 'invalid' };
      },
    ],
  ])('rejects %s before business dispatch', async (_label, mutate) => {
    const fixture = businessFixture('must-not-leak');
    const { url } = await start(fixture.factory);
    const body = request('tools/call', {
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 'private request' },
    });
    mutate(body);
    const result = await post(url, body);
    expect(result.response.status).toBe(400);
    expect(result.body.error?.code).toBe(-32602);
    expect(fixture.search).not.toHaveBeenCalled();
    expect(result.body.result).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain('must-not-leak');
  });

  it('accepts an omitted optional clientInfo while retaining required per-request metadata', async () => {
    const { url } = await start(businessFixture().factory);
    const result = await post(
      url,
      request('server/discover', {
        _meta: {
          [VERSION_KEY]: MCP_PROTOCOL_VERSION,
          [CAPABILITIES_KEY]: {},
        },
      }),
    );
    expect(result.response.status).toBe(200);
    expectPrivateComplete(result.body);
  });

  it.each([
    ['MCP-Protocol-Version', null],
    ['Mcp-Method', null],
    ['Mcp-Name', null],
    ['MCP-Protocol-Version', '2025-11-25'],
    ['Mcp-Method', 'tools/list'],
    ['Mcp-Name', 'another-tool'],
  ])('rejects missing or mismatched %s header (%s)', async (name, value) => {
    const fixture = businessFixture();
    const { url } = await start(fixture.factory);
    const body = request('tools/call', {
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 'query' },
    });
    const headers = headersFor(body);
    if (value === null) headers.delete(name);
    else headers.set(name, value);
    const result = await post(url, body, headers);
    expect(result.response.status).toBe(400);
    expect(result.body.error?.code).toBe(-32020);
    expect(fixture.search).not.toHaveBeenCalled();
  });

  it('reports unsupported versions and unknown or removed methods without fallback', async () => {
    const { url } = await start(businessFixture().factory);
    const body = request('server/discover', {
      _meta: { ...envelope(), [VERSION_KEY]: '2099-01-01' },
    });
    const headers = headersFor(body);
    headers.set('MCP-Protocol-Version', '2099-01-01');
    const unsupported = await post(url, body, headers);
    expect(unsupported.response.status).toBe(400);
    expect(unsupported.body.error).toMatchObject({
      code: -32022,
      data: { supported: [MCP_PROTOCOL_VERSION], requested: '2099-01-01' },
    });
    for (const method of ['missing/method', 'ping']) {
      const result = await post(url, request(method));
      expect(result.response.status).toBe(404);
      expect(result.body.error?.code).toBe(-32601);
    }
    const initialize = request('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'legacy', version: '1' },
    });
    delete initialize.params._meta;
    const legacy = await post(
      url,
      initialize,
      new Headers({
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      }),
    );
    expect(legacy.response.status).toBe(400);
    expect(legacy.body.error?.code).toBe(-32022);
  });

  it.each(['Origin', 'Host'])(
    'rejects an untrusted %s before tool execution',
    async name => {
      const fixture = businessFixture();
      const { url } = await start(fixture.factory);
      const body = request('tools/call', {
        name: 'recommend-mcp-servers',
        arguments: { taskDescription: 'query' },
      });
      const headers = headersFor(body);
      headers.set(
        name,
        name === 'Origin' ? 'https://untrusted.invalid' : 'untrusted.invalid',
      );
      const result =
        name === 'Host'
          ? await postWithExactHost(url, body, headers)
          : await post(url, body, headers);
      expect(result.response.status).toBe(403);
      expect(fixture.search).not.toHaveBeenCalled();
      expect(result.body.result).toBeUndefined();
    },
  );

  it('has no GET/DELETE session operations and retires the legacy HTTP routes', async () => {
    const { url } = await start(businessFixture().factory);
    for (const method of ['GET', 'DELETE']) {
      const response = await fetch(`${url}/mcp`, { method });
      expect(response.status).toBe(405);
      expect(response.headers.has('mcp-session-id')).toBe(false);
      await response.arrayBuffer();
    }
    for (const path of ['/sse', '/messages', '/rest']) {
      const response = await fetch(`${url}${path}`, {
        method: path === '/sse' ? 'GET' : 'POST',
      });
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({
        endpoint: '/mcp',
        protocolVersion: MCP_PROTOCOL_VERSION,
      });
    }
    const body = request('server/discover');
    const headers = headersFor(body);
    headers.set('Mcp-Session-Id', 'obsolete-session');
    headers.set('Last-Event-ID', 'obsolete-event');
    const result = await post(url, body, headers);
    expect(result.response.status).toBe(200);
    expect(result.response.headers.has('mcp-session-id')).toBe(false);
  });

  it('isolates repeated request IDs, client identities, and results across concurrent instances', async () => {
    const a = businessFixture('instance-a');
    const b = businessFixture('instance-b');
    const release: Array<() => void> = [];
    for (const [fixture, marker] of [
      [a, 'instance-a'],
      [b, 'instance-b'],
    ] as const) {
      fixture.search.mockImplementation(async params => {
        await new Promise<void>(resolve => release.push(resolve));
        return [
          {
            title: `${marker}:${params.taskDescription}`,
            description: `Result owned by ${marker}`,
            sourceUrl: `https://example.test/${marker}`,
            similarity: 0.95,
          },
        ];
      });
    }
    const one = await start(a.factory);
    const two = await start(b.factory);
    const operations = Array.from({ length: 8 }, (_, index) => ({
      url: index % 2 === 0 ? one.url : two.url,
      owner: index % 2 === 0 ? 'instance-a' : 'instance-b',
      query: `private-query-${index}`,
    }));
    const pendingResults = Promise.all(
      operations.map(({ url, query }, index) =>
        post(
          url,
          request(
            'tools/call',
            {
              name: 'recommend-mcp-servers',
              arguments: { taskDescription: query },
              _meta: envelope(`client-${index}`),
            },
            7,
          ),
        ),
      ),
    );
    try {
      await vi.waitFor(() => expect(release).toHaveLength(8), {
        timeout: 2000,
      });
    } finally {
      // All eight calls share JSON-RPC ID 7; complete them out of arrival order.
      release.reverse().forEach(resolve => resolve());
    }
    const results = await pendingResults;
    results.forEach(({ response, body }, index) => {
      expect(response.status).toBe(200);
      expect(body.id).toBe(7);
      const serialized = JSON.stringify(body);
      expect(serialized).toContain(
        `${operations[index].owner}:${operations[index].query}`,
      );
      operations.forEach(({ query }, otherIndex) => {
        if (index !== otherIndex) expect(serialized).not.toContain(query);
      });
      expect(serialized).not.toContain(`client-${index}`);
      expect(response.headers.has('mcp-session-id')).toBe(false);
    });
    // A caller can move to another instance for its next request without initialization.
    const next = await post(
      two.url,
      request('resources/read', { uri: RESOURCE_URI }, 7),
    );
    expect(JSON.stringify(next.body.result)).toContain('private:instance-b');
    expect(JSON.stringify(next.body.result)).not.toContain('instance-a');
    expect(a.search).toHaveBeenCalledTimes(4);
    expect(b.search).toHaveBeenCalledTimes(4);
  });

  it('serves a complete result through an actual forced SSE response', async () => {
    const { url } = await start(businessFixture().factory, 'sse');
    const body = request('tools/list');
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: headersFor(body),
      body: JSON.stringify(body),
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const frames = decodeSse(await response.text());
    const result = frames.find(frame => frame.id === body.id && frame.result);
    expect(result).toBeDefined();
    expectPrivateComplete(result!);
    expect(response.headers.has('mcp-session-id')).toBe(false);
  });

  it('aborts only the disconnected SSE request and propagates cancellation to a cooperating test handler', async () => {
    let observedAbort = false;
    const factory: McpServerFactory = () => {
      const server = new McpServer(
        { name: 'cancellation-fixture', version: '1.0.0' },
        { supportedProtocolVersions: [MCP_PROTOCOL_VERSION] },
      );
      server.registerTool('wait-for-abort', {}, async ctx => {
        const cancelled = new Promise<void>(resolve => {
          ctx.mcpReq.signal.addEventListener(
            'abort',
            () => {
              observedAbort = true;
              resolve();
            },
            { once: true },
          );
        });
        await ctx.mcpReq.notify({
          method: 'notifications/progress',
          params: { progressToken: 'cancel-progress', progress: 1, total: 2 },
        });
        await cancelled;
        return {
          content: [
            { type: 'text', text: 'late-result-must-not-be-delivered' },
          ],
        };
      });
      return server;
    };
    const { url } = await start(factory);
    const controller = new AbortController();
    const body = request(
      'tools/call',
      {
        name: 'wait-for-abort',
        _meta: { ...envelope(), progressToken: 'cancel-progress' },
      },
      'cancel-me',
    );
    const response = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: headersFor(body),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    let received = '';
    while (!received.includes('notifications/progress')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('SSE stream ended before progress');
      received += new TextDecoder().decode(chunk.value);
    }
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
    await vi.waitFor(() => expect(observedAbort).toBe(true), { timeout: 2000 });
    expect(received).not.toContain('late-result-must-not-be-delivered');
    const next = request('tools/list', {}, 'unrelated-request');
    const following = await post(url, next);
    expect(following.response.headers.get('content-type')).toContain(
      'application/json',
    );
    expect(following.body.id).toBe('unrelated-request');
    expectPrivateComplete(following.body);
    // This verifies transport cancellation and an abort-aware fixture, not cancellation of external providers.
  });
});

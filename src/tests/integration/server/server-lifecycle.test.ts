import { afterEach, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ServerService } from '../../../services/core/server/ServerService.js';
import type { SearchService } from '../../../services/searchService.js';

let occupied: Server | undefined;
let service: ServerService | undefined;
afterEach(async () => {
  await service?.close();
  if (occupied?.listening)
    await new Promise<void>(resolve => occupied!.close(() => resolve()));
});

it('recovers from HTTP bind failure, starts, serves health, and closes the production lifecycle', async () => {
  occupied = createServer();
  await new Promise<void>(resolve => occupied!.listen(0, '127.0.0.1', resolve));
  const address = occupied.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected bound TCP address');
  const config = { port: address.port, host: '127.0.0.1' };
  service = new ServerService({
    search: async () => [],
  } as unknown as SearchService);
  await expect(service.startWithHttp(config)).rejects.toMatchObject({
    code: 'EADDRINUSE',
  });
  await service.close();
  await new Promise<void>(resolve => occupied!.close(() => resolve()));
  await service.startWithHttp(config);
  const url = `http://127.0.0.1:${config.port}/health`;
  const health = await fetch(url);
  expect(await health.json()).toMatchObject({
    status: 'ok',
    server: 'mcpadvisor',
  });
  await expect(service.startWithHttp(config)).rejects.toThrow(
    'already started',
  );
  await service.close();
  await expect(fetch(url)).rejects.toThrow();
  await service.close();
});

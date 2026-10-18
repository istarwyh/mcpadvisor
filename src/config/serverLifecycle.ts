import type { ServerService } from '../services/core/server/ServerService.js';

/** Close SDK streams and HTTP listeners before a bounded process shutdown. */
export function installShutdownHandlers(service: ServerService): void {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    void service.close().then(
      () => {
        clearTimeout(deadline);
        process.exit(0);
      },
      error => {
        process.stderr.write(`MCP Advisor shutdown failed: ${String(error)}\n`);
        clearTimeout(deadline);
        process.exit(1);
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

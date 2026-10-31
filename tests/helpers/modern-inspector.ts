import { expect, type Page } from '@playwright/test';

type RpcMessage = {
  id?: string | number;
  result?: {
    resultType?: string;
    isError?: boolean;
    content?: { type: string; text?: string }[];
    tools?: { name: string }[];
    supportedVersions?: string[];
  };
  error?: { code: number; message: string };
};

/** Observe real Inspector SSE responses. Never replace a response or mock a server. */
export class ModernInspector {
  private messages: RpcMessage[] = [];
  constructor(private page: Page) {}

  async connect() {
    const token = process.env.MCP_AUTH_TOKEN;
    if (!token)
      throw new Error(
        'MCP_AUTH_TOKEN is required; Inspector UI tests must not silently skip',
      );
    await this.page.exposeFunction(
      '__recordInspectorMessage',
      (message: RpcMessage) => {
        this.messages.push(message);
      },
    );
    await this.page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (
          response.headers.get('content-type')?.includes('text/event-stream')
        ) {
          const reader = response.clone().body?.getReader();
          if (reader)
            void (async () => {
              const decoder = new TextDecoder();
              let pending = '';
              for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                pending += decoder.decode(chunk.value, { stream: true });
                let end: number;
                while ((end = pending.indexOf('\n\n')) >= 0) {
                  const event = pending.slice(0, end);
                  pending = pending.slice(end + 2);
                  const data = event
                    .split('\n')
                    .filter(line => line.startsWith('data:'))
                    .map(line => line.slice(5).trimStart())
                    .join('\n');
                  if (!data) continue;
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'message') {
                    await (
                      window as unknown as {
                        __recordInspectorMessage: (
                          value: unknown,
                        ) => Promise<void>;
                      }
                    ).__recordInspectorMessage(parsed.data);
                  }
                }
              }
            })().catch(() => {
              /* Closing a page cancels its SSE observer. Assertions still require a response. */
            });
        }
        return response;
      };
    });
    const url = new URL(
      process.env.MCP_INSPECTOR_URL || 'http://127.0.0.1:6274',
    );
    url.searchParams.set('MCP_INSPECTOR_API_TOKEN', token);
    await this.page.goto(url.toString());
    await this.page
      .locator('label')
      .filter({
        has: this.page.getByRole('switch', { name: /Connect or disconnect/ }),
      })
      .click();
    await expect(
      this.page.getByText('Connected', { exact: true }),
    ).toBeVisible();
    await expect(
      this.page.getByText('MCP 2026-07-28', { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        this.messages.some(m =>
          m.result?.supportedVersions?.includes('2026-07-28'),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        this.messages
          .find(m => m.result?.tools)
          ?.result?.tools?.map(t => t.name),
      )
      .toEqual(['recommend-mcp-servers', 'install-mcp-server']);
    await this.page
      .locator('label')
      .filter({ hasText: /^Tools$/ })
      .click();
  }

  async call(name: string, fields: Record<string, string>) {
    await this.page.getByRole('button', { name, exact: true }).click();
    for (const [field, value] of Object.entries(fields)) {
      await this.page
        .getByRole('textbox', { name: new RegExp(`^${field}(?: \\*|$)`) })
        .fill(value);
    }
    const start = Date.now();
    const [request] = await Promise.all([
      this.page.waitForRequest(r => {
        if (!r.url().endsWith('/api/mcp/send') || r.method() !== 'POST')
          return false;
        const body = r.postDataJSON();
        return (
          body.message?.method === 'tools/call' &&
          body.message?.params?.name === name
        );
      }),
      this.page
        .getByRole('button', { name: 'Execute Tool', exact: true })
        .click(),
    ]);
    const id = request.postDataJSON().message.id;
    await expect
      .poll(() => this.messages.find(m => m.id === id), { timeout: 30000 })
      .toBeTruthy();
    const message = this.messages.find(m => m.id === id)!;
    const text =
      message.result?.content
        ?.filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n') || '';
    if (text)
      await expect(
        this.page.getByText(text.trim(), { exact: true }).first(),
      ).toBeVisible();
    if (message.error) {
      await expect(
        this.page.getByText(message.error.message, { exact: false }).first(),
      ).toBeVisible();
    }
    return { message, text, elapsed: Date.now() - start };
  }
}

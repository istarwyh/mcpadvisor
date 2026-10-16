// Evaluation-only 120s transport timeout accommodates cold model fallback.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout, clearTimeout } from 'node:timers';
import process from 'node:process';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';

// Record every stdout byte, including malformed lines that an SDK could recover
// from. Keep parsing after a violation so returned responses cannot hide it.
export function startRawClient(script, options = {}) {
  const child = spawn(process.execPath, [script], {
    ...options,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const report = { stdout: '', stderr: '', messages: [], violations: [] };
  const pending = new Map();
  let buffer = '';
  let nextId = 0;
  let closed = false;
  const closePromise = once(child, 'close');
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    report.stderr += chunk;
  });
  child.stdout.on('data', chunk => {
    report.stdout += chunk;
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        const message = JSONRPCMessageSchema.parse(JSON.parse(line));
        report.messages.push(message);
        const request = pending.get(message.id);
        if (request && ('result' in message || 'error' in message)) {
          pending.delete(message.id);
          clearTimeout(request.timer);
          request.resolve(message);
        }
      } catch (error) {
        report.violations.push({ line, error: error.message });
      }
    }
  });
  child.on('close', () => {
    closed = true;
    if (buffer)
      report.violations.push({ line: buffer, error: 'Incomplete stdout line' });
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error('MCP child closed before responding'));
    }
    pending.clear();
  });
  return {
    report,
    notify(method, params) {
      child.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n',
      );
    },
    request(method, params) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }, 120000);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(
          JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n',
        );
      });
    },
    async close() {
      if (!closed) child.kill('SIGTERM');
      await closePromise;
    },
  };
}

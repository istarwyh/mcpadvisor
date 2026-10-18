/** @deprecated Legacy transport contracts retained with the archived implementation. */
export enum TransportType {
  STDIO = 'stdio',
  SSE = 'sse',
  REST = 'rest',
}

export interface TransportConfig {
  port: number;
  host?: string;
  ssePath?: string;
  messagePath?: string;
  endpoint?: string;
}

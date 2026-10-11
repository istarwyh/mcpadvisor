import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import logger from '../../../../utils/logger.js';

type SSETransportMap = { [sessionId: string]: SSEServerTransport };

export class ExpressServer {
  private app: Application;
  private sseTransports: SSETransportMap = {};

  constructor() {
    this.app = express();
    this.app.use(cors());
  }

  public getApp(): Application {
    return this.app;
  }

  public setupSSEEndpoint(
    path: string,
    messagePath: string,
    onConnect: (transport: SSEServerTransport) => Promise<void>,
  ): void {
    // Define the SSE handler with proper typing
    const sseHandler = async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        const transport = new SSEServerTransport(messagePath, res);
        this.sseTransports[transport.sessionId] = transport;

        res.on('close', () => {
          logger.info(
            `SSE connection closed for session ${transport.sessionId}`,
          );
          delete this.sseTransports[transport.sessionId];
        });

        logger.info(`New SSE connection started on ${path}`);
        await onConnect(transport);
        logger.info(
          `SSE connection established for session ${transport.sessionId}`,
        );
      } catch (error) {
        logger.error(
          `Error connecting transport: ${error instanceof Error ? error.message : String(error)}`,
        );
        next(error);
      }
    };

    // Register the handler with Express
    this.app.get(path, (req: Request, res: Response, next: NextFunction) => {
      sseHandler(req, res, next).catch(next);
    });
  }

  public setupMessageEndpoint(path: string): void {
    const messageHandler = async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      const sessionId = req.query.sessionId as string;
      logger.info(`Received message for session ${sessionId}`);

      const transport = this.sseTransports[sessionId];
      if (!transport) {
        logger.warn(`No transport found for session ${sessionId}`);
        res.status(400).json({ error: 'No transport found for sessionId' });
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (error) {
        logger.error(
          `Error handling message: ${error instanceof Error ? error.message : String(error)}`,
        );
        next(error);
      }
    };

    this.app.post(path, (req: Request, res: Response, next: NextFunction) => {
      messageHandler(req, res, next).catch(next);
    });
  }

  public setupHealthCheck(serverName: string, version: string): void {
    this.app.get('/health', (_: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        server: serverName,
        version,
        connections: Object.keys(this.sseTransports).length,
      });
    });
  }

  public start(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app
          .listen(port, host, () => {
            logger.info(`Server running on http://${host}:${port}`);
            resolve();
          })
          .on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

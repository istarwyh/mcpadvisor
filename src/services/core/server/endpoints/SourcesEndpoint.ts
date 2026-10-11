import { Request, Response } from 'express';
import { McpSources } from '../../../loadService.js';
import { SourcesSchema } from '../types.js';
import { addAdditionalSources } from '../../../loadService.js';
import logger from '../../../../utils/logger.js';

export class SourcesEndpoint {
  public static async handleRequest(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const result = SourcesSchema.safeParse(req.body);
      if (!result.success) {
        logger.error(`Error parsing sources: ${result.error}`);
        res.status(400).json({
          success: false,
          error: 'Invalid request',
        });
        return;
      }

      const { remote_urls, local_files, field_map } = result.data;
      const sources: Partial<McpSources> = {};

      if (remote_urls?.length) sources.remote_urls = remote_urls;
      if (local_files?.length) sources.local_files = local_files;

      const items = await addAdditionalSources(sources, field_map);

      res.status(200).json({
        success: true,
        message: 'Sources added successfully',
        itemCount: items.length,
      });
    } catch (error) {
      logger.error(
        `Error adding sources: ${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
      });
    }
  }
}

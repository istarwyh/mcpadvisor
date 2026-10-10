/**
 * Utilities for formatting responses
 */

import { MCPServerResponse } from '../types/index.js';

/**
 * Convert server response objects to formatted text
 * @param servers - Array of server response objects
 * @returns Formatted text representation of servers
 */
export const formatServersToText = (servers: MCPServerResponse[]): string => {
  if (servers.length === 0) {
    return 'No MCP servers found.';
  }

  return servers
    .map((server, index) => {
      const similarityPercentage = (
        (server.score ?? server.similarity ?? 0) * 100
      ).toFixed(1);
      return [
        `Server ${index + 1}:`,
        `Title: ${server.title}`,
        `Description: ${server.description}`,
        `Source URL: ${server.sourceUrl}`,
        `Score: ${similarityPercentage}%`,
        '',
      ].join('\n');
    })
    .join('\n');
};

/**
 * Format server responses to MCP content objects
 * @param servers - Array of server response objects
 * @returns MCP content object array
 */
export const formatServersToMCPContent = (servers: MCPServerResponse[]) => {
  if (!servers || servers.length === 0) {
    return [
      {
        type: 'text',
        text: 'No matching MCP servers found for your query. Try being more specific about the platform, operation, or service you need.',
      },
    ];
  }

  const serversText = formatServersToText(servers);

  return [
    {
      type: 'text',
      text: serversText,
    },
  ];
};

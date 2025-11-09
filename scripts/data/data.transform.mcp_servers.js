import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transforms MCP server data from object format to array format with IDs
 * 
 * @param {string} inputPath - Path to the input JSON file
 * @param {string} outputPath - Path to the output JSON file
 */
function transformMcpData(inputPath, outputPath) {
  try {
    // Read the input file
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const mcpServers = JSON.parse(rawData);
    
    // Transform the data
    const mcpServerList = Object.keys(mcpServers).map(key => {
      // Add id field to each server object
      return {
        id: key,
        ...mcpServers[key]
      };
    });
    
    // Write the transformed data to the output file
    fs.writeFileSync(
      outputPath, 
      JSON.stringify(mcpServerList, null, 2),
      'utf8'
    );
    
    console.log(`Successfully transformed MCP data from ${inputPath} to ${outputPath}`);
    console.log(`Total MCP servers processed: ${mcpServerList.length}`);
  } catch (error) {
    console.error('Error transforming MCP data:', error);
    process.exit(1);
  }
}

// Paths relative to project root
const inputPath = path.resolve(__dirname, '../data/mcp_server_from_getmcp_io.json');
const outputPath = path.resolve(__dirname, '../data/mcp_server_list.json');

// Execute the transformation
transformMcpData(inputPath, outputPath);

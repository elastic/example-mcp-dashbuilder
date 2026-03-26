import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape } from 'zod';

/**
 * Wrapper around server.registerTool that avoids the
 * "Type instantiation is excessively deep" TS error
 * caused by the MCP SDK's deeply nested generics.
 */
export function registerTool(
  server: McpServer,
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: ZodRawShape;
  },
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
  }>,
): void {
  // @ts-expect-error — MCP SDK generic recursion too deep for TS
  server.registerTool(name, config, handler);
}

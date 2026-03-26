import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { registerTool } from '../utils/register-tool.js';

export function registerListIndices(server: McpServer): void {
  registerTool(
    server,
    'list_indices',
    {
      title: 'List Indices',
      description:
        'List available Elasticsearch indices matching a pattern. ' +
        'Use this to discover what data is available before writing ES|QL queries.',
      inputSchema: {
        pattern: z
          .string()
          .optional()
          .default('*')
          .describe('Index pattern to match, e.g. "kibana_sample_data_*" or "logs-*"'),
      },
    },
    async (args) => {
      const pattern = (args.pattern as string) || '*';
      const client = getESClient();
      const indices = await client.cat.indices({
        index: pattern,
        format: 'json',
        h: 'index,docs.count,store.size',
        s: 'index',
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(indices, null, 2) }],
      };
    },
  );

  registerTool(
    server,
    'get_fields',
    {
      title: 'Get Index Fields',
      description:
        'Get the field mappings for an index. Use this to understand what fields ' +
        'are available for ES|QL queries and chart configuration.',
      inputSchema: {
        index: z.string().describe('Index name, e.g. "kibana_sample_data_ecommerce"'),
      },
    },
    async (args) => {
      const index = args.index as string;
      const client = getESClient();
      const mapping = await client.indices.getMapping({ index });

      const indexMapping = Object.values(mapping)[0];
      const properties = indexMapping?.mappings?.properties || {};
      const fields = flattenFields(properties);

      return {
        content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }],
      };
    },
  );
}

function flattenFields(
  properties: Record<string, unknown>,
  prefix = '',
): Array<{ field: string; type: string }> {
  const fields: Array<{ field: string; type: string }> = [];

  for (const [name, value] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${name}` : name;
    const fieldDef = value as Record<string, unknown>;

    if (fieldDef.type) {
      fields.push({ field: fieldPath, type: fieldDef.type as string });
    }
    if (fieldDef.properties) {
      fields.push(...flattenFields(fieldDef.properties as Record<string, unknown>, fieldPath));
    }
  }

  return fields;
}

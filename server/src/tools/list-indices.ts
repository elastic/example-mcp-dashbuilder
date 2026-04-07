import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';

export const listIndicesTools = [
  {
    name: 'list_indices' as const,
    description:
      'List available Elasticsearch indices matching a pattern. ' +
      'Use this to discover what data is available before writing ES|QL queries.',
    parameters: z.object({
      pattern: z
        .string()
        .optional()
        .default('*')
        .describe('Index pattern to match, e.g. "kibana_sample_data_*" or "logs-*"'),
    }),
    execute: async (args: { pattern: string }) => {
      try {
        const client = getESClient();
        const indices = await client.cat.indices({
          index: args.pattern,
          format: 'json',
          h: 'index,docs.count,store.size',
          s: 'index',
        });
        return JSON.stringify(indices, null, 2);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Failed to list indices: ${message}` }],
          isError: true,
        };
      }
    },
  },
  {
    name: 'get_fields' as const,
    description:
      'Get the field mappings for an index. Use this to understand what fields ' +
      'are available for ES|QL queries and chart configuration.',
    parameters: z.object({
      index: z.string().describe('Index name, e.g. "kibana_sample_data_ecommerce"'),
    }),
    execute: async (args: { index: string }) => {
      try {
        const client = getESClient();
        const mapping = await client.indices.getMapping({ index: args.index });
        const indexMapping = Object.values(mapping)[0];
        const properties = indexMapping?.mappings?.properties || {};
        const fields = flattenFields(properties);
        return JSON.stringify(fields, null, 2);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Failed to get fields: ${message}` }],
          isError: true,
        };
      }
    },
  },
];

function flattenFields(
  properties: Record<string, unknown>,
  prefix = ''
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

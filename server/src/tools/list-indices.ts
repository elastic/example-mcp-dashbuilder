/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

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
      try {
        const { pattern } = args;
        const client = getESClient();
        const indices = await client.cat.indices({
          index: pattern,
          format: 'json',
          h: 'index,docs.count,store.size,health,status',
          s: 'index',
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(indices, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to list indices: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool name `get_schema` aligns with the ES|QL agent skill references
  // (vendored from @elastic/agent-skills). The skill's SKILL.md and error handling
  // docs reference `get_schema` by name. If renaming this tool, update the skill
  // or the resource assembly in esql-reference.ts to keep them in sync.
  registerTool(
    server,
    'get_schema',
    {
      title: 'Get Index Schema',
      description:
        'Get the full schema for an index including field mappings, multi-fields, ' +
        'time series metric annotations (counter/gauge), and index mode detection. ' +
        'Use this to understand what fields are available for ES|QL queries and chart configuration.',
      inputSchema: {
        index: z.string().describe('Index name, e.g. "kibana_sample_data_ecommerce"'),
      },
    },
    async (args) => {
      try {
        const { index } = args;
        const client = getESClient();

        // Get mappings
        const mapping = await client.indices.getMapping({ index });
        const indexMapping = Object.values(mapping)[0] as unknown as
          | { mappings?: { properties?: Record<string, Record<string, unknown>> } }
          | undefined;
        const properties = (indexMapping?.mappings?.properties || {}) as Record<
          string,
          Record<string, unknown>
        >;
        const fields = flattenMappings(properties);

        // Get index mode and time series info
        const indexMode = await getIndexMode(index);
        let dataStreamName: string | null = null;
        let timeSeriesHint: string | null = null;

        if (indexMode === 'time_series') {
          dataStreamName = await resolveDataStreamName(index);
          const displayName = dataStreamName || index;
          timeSeriesHint = [
            `Index mode: time_series${dataStreamName ? ` (data stream: ${displayName})` : ''}`,
            `  → Use: TS ${displayName} | STATS SUM(RATE(counter_field)) BY TBUCKET(1 hour)`,
            '  → TBUCKET takes only a duration, not @timestamp: TBUCKET(5 minutes)',
            '  → Counter fields need RATE() wrapped in SUM(); gauge fields use AVG()/MAX()',
          ].join('\n');
        }

        // Build response
        const parts: string[] = [];

        if (indexMode) {
          parts.push(`Index mode: ${indexMode}`);
        }
        if (timeSeriesHint) {
          parts.push(timeSeriesHint);
        }
        if (dataStreamName) {
          parts.push(`Data stream: ${dataStreamName}`);
        }

        parts.push('');
        parts.push(JSON.stringify(fields, null, 2));

        return {
          content: [{ type: 'text', text: parts.join('\n') }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to get schema: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

// =============================================================================
// Helpers
// =============================================================================

interface FieldInfo {
  field: string;
  type: string;
  subfields?: string[];
}

/**
 * Flatten Elasticsearch mappings into a list of fields with dotted paths.
 * Includes multi-fields (e.g. `.keyword`) and time_series_metric annotations.
 * Ported from the @elastic/agent-skills ES|QL skill script.
 */
function flattenMappings(
  properties: Record<string, Record<string, unknown>>,
  prefix = ''
): FieldInfo[] {
  const fields: FieldInfo[] = [];

  for (const [key, value] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (value.type) {
      let displayType = value.type as string;
      if (value.time_series_metric) {
        displayType += ` (${value.time_series_metric})`;
      }
      const entry: FieldInfo = { field: fieldPath, type: displayType };
      if (value.fields) {
        entry.subfields = Object.keys(value.fields as Record<string, unknown>);
      }
      fields.push(entry);
    }

    if (value.properties) {
      fields.push(
        ...flattenMappings(value.properties as Record<string, Record<string, unknown>>, fieldPath)
      );
    }

    // Traverse multi-fields (e.g. title.keyword)
    if (value.fields) {
      for (const [subKey, subValue] of Object.entries(
        value.fields as Record<string, Record<string, unknown>>
      )) {
        if (subValue.type) {
          fields.push({
            field: `${fieldPath}.${subKey}`,
            type: subValue.type as string,
          });
        }
      }
    }
  }

  return fields;
}

/**
 * Get the index mode (e.g. "time_series") from index settings.
 */
async function getIndexMode(index: string): Promise<string | null> {
  try {
    const client = getESClient();
    const response = await client.indices.getSettings({ index, flat_settings: true });
    const indexData =
      (response[index] as Record<string, Record<string, unknown>> | undefined) ||
      (Object.values(response)[0] as Record<string, Record<string, unknown>> | undefined);
    if (!indexData?.settings) return null;
    return (indexData.settings['index.mode'] as string) || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the data stream name for a backing index.
 */
async function resolveDataStreamName(index: string): Promise<string | null> {
  try {
    const client = getESClient();
    const response = await client.indices.resolveIndex({ name: index });
    const match = response.indices?.find((i) => i.data_stream);
    return (match?.data_stream as string) || null;
  } catch {
    return null;
  }
}

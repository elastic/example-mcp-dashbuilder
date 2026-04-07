import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, describeColumns } from '../utils/esql-transform.js';
import type { ESQLResponse } from '../types.js';

export const runEsqlTools = [
  {
    name: 'run_esql' as const,
    description:
      'Execute an ES|QL query against Elasticsearch and return the results. ' +
      'Use this to explore data, test queries, and understand the shape of results ' +
      'before creating charts. Returns both raw columns/types and row-oriented data.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'The ES|QL query to execute, e.g. "FROM logs-* | STATS count = COUNT(*) BY host.name"'
        ),
    }),
    execute: async (args: { query: string }) => {
      try {
        const { query } = args;
        const client = getESClient();
        const response = (await client.esql.query({
          query,
          format: 'json',
        })) as unknown as ESQLResponse;

        const columns = describeColumns(response);
        const rows = columnarToRows(response);

        return JSON.stringify({ columns, rows, rowCount: rows.length }, null, 2);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `ES|QL query failed: ${message}` }],
          isError: true,
        };
      }
    },
  },
];

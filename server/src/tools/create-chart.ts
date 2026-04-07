import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, validateFields } from '../utils/esql-transform.js';
import { addChart } from '../utils/dashboard-store.js';
import { registerTool } from '../utils/register-tool.js';
import type { ChartConfig, ESQLResponse } from '../types.js';

export function registerCreateChart(server: McpServer): void {
  registerTool(
    server,
    'create_chart',
    {
      title: 'Create Chart',
      description:
        'Create a chart visualization and add it to the dashboard. ' +
        'Executes the provided ES|QL query and maps the results to an Elastic Charts configuration. ' +
        'Supported chart types: bar (comparisons), line (time trends), area (volume over time), pie (part-of-whole, max 6 slices). ' +
        'Read the dataviz-guidelines resource for best practices on chart selection, ES|QL patterns, and anti-patterns. ' +
        'Use view_dashboard to see the interactive preview after creating charts.',
      inputSchema: {
        id: z.string().describe('Unique chart identifier, e.g. "sales-by-category"'),
        title: z.string().describe('Chart title displayed above the visualization'),
        chartType: z.enum(['bar', 'line', 'area', 'pie']).describe('Type of chart to render'),
        esqlQuery: z
          .string()
          .describe(
            'ES|QL query that produces the data for this chart. ' +
              'Should return columns matching xField and yFields. ' +
              'Example: FROM kibana_sample_data_ecommerce | STATS revenue = SUM(taxful_total_price) BY category'
          ),
        xField: z
          .string()
          .describe('Column name from the query result to use as the x-axis (or pie slice labels)'),
        yFields: z
          .array(z.string())
          .describe(
            'Column name(s) from the query result to use as y-axis values (or pie slice sizes)'
          ),
        splitField: z
          .string()
          .optional()
          .describe(
            'Optional column name to split the data into multiple series (for grouped/stacked charts)'
          ),
        palette: z
          .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #E91E63'))
          .optional()
          .describe(
            'Optional array of hex colors for series/slices, e.g. ["#E91E63", "#FF5252"]. Defaults to Kibana Borealis palette.'
          ),
        timeField: z
          .string()
          .optional()
          .describe(
            'Optional date field for time filtering, e.g. "@timestamp" or "order_date". ' +
              'Set this when the index has multiple date fields to ensure the time picker filters correctly.'
          ),
      },
    },
    async (args) => {
      const { id, title, chartType, esqlQuery, xField, yFields, splitField, palette, timeField } =
        args;

      const client = getESClient();

      let data: Record<string, unknown>[];
      try {
        const response = (await client.esql.query({
          query: esqlQuery,
          format: 'json',
        })) as unknown as ESQLResponse;
        data = columnarToRows(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `ES|QL query failed: ${message}` }],
          isError: true,
        };
      }

      if (data.length === 0) {
        return {
          content: [
            { type: 'text', text: 'Query returned no results. Check the query and try again.' },
          ],
          isError: true,
        };
      }

      const fieldError = validateFields(data, [
        xField,
        ...yFields,
        ...(splitField ? [splitField] : []),
      ]);
      if (fieldError) {
        return { content: [{ type: 'text', text: fieldError }], isError: true };
      }

      const chart: ChartConfig = {
        id,
        title,
        chartType,
        esqlQuery,
        xField,
        yFields,
        splitField,
        palette,
        timeField,
      };

      const dashboard = addChart(chart);

      const statusText =
        `Chart "${title}" (${chartType}) added to dashboard. ` +
        `Data: ${data.length} rows, fields: [${Object.keys(data[0]).join(', ')}]. ` +
        `Dashboard now has ${dashboard.charts.length} chart(s). ` +
        `Use view_dashboard to see the interactive preview.`;

      return {
        content: [{ type: 'text', text: statusText }],
      };
    }
  );
}

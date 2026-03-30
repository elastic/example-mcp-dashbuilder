import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows } from '../utils/esql-transform.js';
import { addChart } from '../utils/dashboard-store.js';
import { renderChartToImage } from '../utils/chart-renderer.js';
import { registerTool } from '../utils/register-tool.js';
import type { ChartConfig, ChartType, ESQLResponse } from '../types.js';

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
        'Returns a preview image and also updates the live preview app.',
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
          .array(z.string())
          .optional()
          .describe(
            'Optional array of hex colors for series/slices, e.g. ["#E91E63", "#FF5252"]. Defaults to Kibana Borealis palette.'
          ),
      },
    },
    async (args) => {
      const id = args.id as string;
      const title = args.title as string;
      const chartType = args.chartType as ChartType;
      const esqlQuery = args.esqlQuery as string;
      const xField = args.xField as string;
      const yFields = args.yFields as string[];
      const splitField = args.splitField as string | undefined;
      const palette = args.palette as string[] | undefined;

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

      const chart: ChartConfig = {
        id,
        title,
        chartType,
        esqlQuery,
        xField,
        yFields,
        splitField,
        palette,
      };

      const dashboard = addChart(chart);

      const statusText =
        `Chart "${title}" (${chartType}) added to dashboard. ` +
        `Data: ${data.length} rows, fields: [${Object.keys(data[0]).join(', ')}]. ` +
        `Dashboard now has ${dashboard.charts.length} chart(s).\n` +
        `Preview: http://localhost:5173`;

      const imageBase64 = await renderChartToImage(id);

      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
        { type: 'text', text: statusText },
      ];

      if (imageBase64) {
        content.push({ type: 'image', data: imageBase64, mimeType: 'image/png' });
      } else {
        content.push({
          type: 'text',
          text: '(Image preview unavailable — make sure the preview app is running on localhost:5173)',
        });
      }

      return { content };
    }
  );
}

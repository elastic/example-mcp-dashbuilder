import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, validateFields } from '../utils/esql-transform.js';
import { addChart } from '../utils/dashboard-store.js';
import { renderChartToImage } from '../utils/chart-renderer.js';
import { registerTool } from '../utils/register-tool.js';
import type { HeatmapConfig, ESQLResponse } from '../types.js';
import { PREVIEW_URL } from '../utils/config.js';

export function registerCreateHeatmap(server: McpServer): void {
  registerTool(
    server,
    'create_heatmap',
    {
      title: 'Create Heatmap',
      description:
        'Create a heatmap visualization and add it to the dashboard. ' +
        'Heatmaps show patterns across two categorical or time-based dimensions using color intensity. ' +
        'Best for: day × hour patterns, category × region comparisons. ' +
        'Keep both dimensions under 15 values. Use meaningful sort orders (days in order, hours 00-23). ' +
        'Read the dataviz-guidelines resource for best practices. ' +
        'Returns a preview image and updates the live preview app.',
      inputSchema: {
        id: z.string().describe('Unique heatmap identifier, e.g. "orders-by-day-hour"'),
        title: z.string().describe('Heatmap title displayed above the visualization'),
        esqlQuery: z
          .string()
          .describe(
            'ES|QL query that returns rows with x, y, and value columns. ' +
              'Example: FROM kibana_sample_data_ecommerce ' +
              '| EVAL day = DATE_FORMAT("EEEE", order_date), hour = DATE_FORMAT("HH", order_date) ' +
              '| STATS order_count = COUNT(*) BY day, hour ' +
              '| SORT day, hour'
          ),
        xField: z.string().describe('Column name for the x-axis (horizontal buckets), e.g. "hour"'),
        yField: z.string().describe('Column name for the y-axis (vertical buckets), e.g. "day"'),
        valueField: z
          .string()
          .describe('Column name for the cell values (color intensity), e.g. "order_count"'),
        colorRamp: z
          .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #E91E63'))
          .optional()
          .describe(
            'Optional array of hex colors for the heatmap gradient (low to high), e.g. ["#FCE4EC", "#E91E63"]. Defaults to Borealis temperature palette.'
          ),
      },
    },
    async (args) => {
      const { id, title, esqlQuery, xField, yField, valueField, colorRamp } = args;

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
        return { content: [{ type: 'text', text: 'Query returned no results.' }], isError: true };
      }

      const fieldError = validateFields(data, [xField, yField, valueField]);
      if (fieldError) {
        return { content: [{ type: 'text', text: fieldError }], isError: true };
      }

      const heatmap: HeatmapConfig = {
        id,
        title,
        chartType: 'heatmap',
        esqlQuery,
        xField,
        yField,
        valueField,
        colorRamp,
      };

      const dashboard = addChart(heatmap);

      const values = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
      const min = Math.min(...values);
      const max = Math.max(...values);

      const statusText =
        `Heatmap "${title}" added to dashboard. ` +
        `Data: ${data.length} cells, x: ${xField}, y: ${yField}, value: ${valueField} (range: ${min}–${max}). ` +
        `Dashboard now has ${dashboard.charts.length} panel(s).\n` +
        `Preview: ${PREVIEW_URL}`;

      const imageBase64 = await renderChartToImage(id);

      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
        { type: 'text', text: statusText },
      ];
      if (imageBase64) {
        content.push({ type: 'image', data: imageBase64, mimeType: 'image/png' });
      }

      return { content };
    }
  );
}

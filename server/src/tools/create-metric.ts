import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, validateFields } from '../utils/esql-transform.js';
import { addChart } from '../utils/dashboard-store.js';
import { renderChartToImage } from '../utils/chart-renderer.js';
import { registerTool } from '../utils/register-tool.js';
import type { MetricConfig, ESQLResponse } from '../types.js';
import { PREVIEW_URL } from '../utils/config.js';

export function registerCreateMetric(server: McpServer): void {
  registerTool(
    server,
    'create_metric',
    {
      title: 'Create Metric',
      description:
        'Create a metric visualization showing a single prominent number with an optional sparkline trend. ' +
        'Great for KPIs like total revenue, order count, average price, etc. ' +
        'Always add a subtitle for context (time range, scope). Use $ prefix for revenue, % suffix for rates. ' +
        'Add a trend sparkline when showing a value that changes over time. ' +
        'Read the dataviz-guidelines resource for best practices. ' +
        'Returns a preview image and updates the live preview app.',
      inputSchema: {
        id: z.string().describe('Unique metric identifier, e.g. "total-revenue"'),
        title: z.string().describe('Metric title, e.g. "Total Revenue"'),
        subtitle: z.string().optional().describe('Optional subtitle, e.g. "Last 7 days"'),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #54B399')
          .optional()
          .describe(
            'Hex color for the metric background, e.g. "#54B399". Defaults to Kibana green.'
          ),
        esqlQuery: z
          .string()
          .describe(
            'ES|QL query that returns a single row with the metric value. ' +
              'Example: FROM kibana_sample_data_ecommerce | STATS total = SUM(taxful_total_price)'
          ),
        valueField: z
          .string()
          .describe('Column name from the query result to use as the metric value, e.g. "total"'),
        valuePrefix: z.string().optional().describe('Text before the value, e.g. "$" or "USD "'),
        valueSuffix: z.string().optional().describe('Text after the value, e.g. "%" or " orders"'),
        trendEsqlQuery: z
          .string()
          .optional()
          .describe(
            'Optional ES|QL query for the sparkline trend. Should return time-bucketed rows. ' +
              'Example: FROM kibana_sample_data_ecommerce | STATS revenue = SUM(taxful_total_price) BY BUCKET(order_date, 1 day)'
          ),
        trendXField: z
          .string()
          .optional()
          .describe('Column name for the trend x-axis (time field), e.g. "order_date"'),
        trendYField: z
          .string()
          .optional()
          .describe('Column name for the trend y-axis (value field), e.g. "revenue"'),
        trendShape: z
          .enum(['area', 'bars'])
          .optional()
          .default('area')
          .describe('Sparkline shape: "area" (default) or "bars"'),
      },
    },
    async (args) => {
      const {
        id,
        title,
        subtitle,
        color,
        esqlQuery,
        valueField,
        valuePrefix,
        valueSuffix,
        trendEsqlQuery,
        trendXField,
        trendYField,
      } = args;
      const trendShape = args.trendShape || 'area';

      const client = getESClient();
      const statusWarnings: string[] = [];

      // Execute the main metric query
      let value: number;
      try {
        const response = (await client.esql.query({
          query: esqlQuery,
          format: 'json',
        })) as unknown as ESQLResponse;
        const rows = columnarToRows(response);

        if (rows.length === 0) {
          return {
            content: [{ type: 'text', text: 'Metric query returned no results.' }],
            isError: true,
          };
        }

        const fieldError = validateFields(rows, [valueField]);
        if (fieldError) {
          return { content: [{ type: 'text', text: fieldError }], isError: true };
        }

        value = Number(rows[0][valueField]);
        if (isNaN(value)) {
          return {
            content: [
              {
                type: 'text',
                text: `Field "${valueField}" is not a number. Got: ${rows[0][valueField]}`,
              },
            ],
            isError: true,
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Metric query failed: ${message}` }],
          isError: true,
        };
      }

      // Validate the optional trend query
      let trendRowCount = 0;
      if (trendEsqlQuery && trendXField && trendYField) {
        try {
          const trendResponse = (await client.esql.query({
            query: trendEsqlQuery,
            format: 'json',
          })) as unknown as ESQLResponse;
          trendRowCount = columnarToRows(trendResponse).length;
        } catch (err) {
          const trendErr = err instanceof Error ? err.message : String(err);
          // Trend is optional — report the error but don't fail the metric
          trendRowCount = 0;
          statusWarnings.push(`Trend query failed: ${trendErr}`);
        }
      }

      const metric: MetricConfig = {
        id,
        title,
        chartType: 'metric',
        subtitle,
        color: color || '#54B399',
        valueField,
        valuePrefix,
        valueSuffix,
        esqlQuery,
        trendEsqlQuery,
        trendXField,
        trendYField,
        trendShape,
      };

      const dashboard = addChart(metric);

      const formattedValue = `${valuePrefix || ''}${value.toLocaleString()}${valueSuffix || ''}`;
      const statusText =
        `Metric "${title}" added to dashboard: ${formattedValue}` +
        (trendRowCount > 0 ? ` (with ${trendRowCount}-point ${trendShape} sparkline)` : '') +
        `. Dashboard now has ${dashboard.charts.length} panel(s).\n` +
        (statusWarnings.length > 0 ? `Warnings: ${statusWarnings.join('; ')}\n` : '') +
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

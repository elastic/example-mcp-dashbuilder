import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, validateFields } from '../utils/esql-transform.js';
import { addChart, slugify } from '../utils/dashboard-store.js';
import { setChartPreview } from '../utils/chart-preview-store.js';
import type { MetricConfig, ESQLResponse } from '../types.js';
import { CHART_PREVIEW_RESOURCE_URI } from '../utils/resource-uris.js';

export const createMetricTool = {
  name: 'create_metric' as const,
  description:
    'Create a metric visualization showing a single prominent number with an optional sparkline trend. ' +
    'Great for KPIs like total revenue, order count, average price, etc. ' +
    'Always add a subtitle for context (time range, scope). Use $ prefix for revenue, % suffix for rates. ' +
    'Add a trend sparkline when showing a value that changes over time. ' +
    'Read the dataviz-guidelines resource for best practices. ' +
    'Shows an inline chart preview after creation.',
  parameters: z.object({
    id: z.string().optional().describe('Unique metric identifier, e.g. "total-revenue"'),
    title: z.string().describe('Metric title, e.g. "Total Revenue"'),
    subtitle: z.string().optional().describe('Optional subtitle, e.g. "Last 7 days"'),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #54B399')
      .optional()
      .describe('Hex color for the metric background, e.g. "#54B399". Defaults to Kibana green.'),
    query: z
      .string()
      .describe(
        'ES|QL query that returns a single row with the metric value. ' +
          'Example: FROM kibana_sample_data_ecommerce | STATS total = SUM(taxful_total_price)'
      ),
    valueField: z
      .string()
      .describe('Column name from the query result to display as the metric number, e.g. "total"'),
    valuePrefix: z.string().optional().describe('Text before the value, e.g. "$" or "USD "'),
    valueSuffix: z.string().optional().describe('Text after the value, e.g. "%" or " orders"'),
    trendQuery: z
      .string()
      .optional()
      .describe(
        'Optional ES|QL query for the sparkline trend. Should return time-bucketed rows. ' +
          'Example: FROM kibana_sample_data_ecommerce | STATS revenue = SUM(taxful_total_price) BY BUCKET(order_date, 1 day)'
      ),
    trendXColumn: z
      .string()
      .optional()
      .describe('Column name for the trend x-axis (time column), e.g. "BUCKET(order_date, 1 day)"'),
    trendYColumn: z
      .string()
      .optional()
      .describe('Column name for the trend y-axis (value column), e.g. "revenue"'),
    trendShape: z
      .enum(['area', 'bars'])
      .optional()
      .default('area')
      .describe('Sparkline shape: "area" (default) or "bars"'),
    timeField: z
      .string()
      .optional()
      .describe(
        'Optional date field for time filtering, e.g. "@timestamp". ' +
          'Set this when the index has multiple date fields.'
      ),
  }),
  _meta: {
    ui: { resourceUri: CHART_PREVIEW_RESOURCE_URI },
  },
  execute: async (args: {
    id?: string;
    title: string;
    subtitle?: string;
    color?: string;
    query: string;
    valueField: string;
    valuePrefix?: string;
    valueSuffix?: string;
    trendQuery?: string;
    trendXColumn?: string;
    trendYColumn?: string;
    trendShape?: 'area' | 'bars';
    timeField?: string;
  }) => {
    const {
      title,
      subtitle,
      color,
      query,
      valueField,
      valuePrefix,
      valueSuffix,
      trendQuery,
      trendXColumn,
      trendYColumn,
      timeField,
    } = args;
    const id = args.id || `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const trendShape = args.trendShape || 'area';

    const client = getESClient();
    const statusWarnings: string[] = [];

    // Execute the main metric query
    let value: number;
    try {
      const response = (await client.esql.query({
        query,
        format: 'json',
      })) as unknown as ESQLResponse;
      const rows = columnarToRows(response);

      if (rows.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Metric query returned no results.' }],
          isError: true,
        };
      }

      const fieldError = validateFields(rows, [valueField]);
      if (fieldError) {
        return { content: [{ type: 'text' as const, text: fieldError }], isError: true };
      }

      value = Number(rows[0][valueField]);
      if (isNaN(value)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Column "${valueField}" is not a number. Got: ${rows[0][valueField]}`,
            },
          ],
          isError: true,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Metric query failed: ${message}` }],
        isError: true,
      };
    }

    // Validate the optional trend query
    let trendData: Record<string, unknown>[] = [];
    if (trendQuery && trendXColumn && trendYColumn) {
      try {
        const trendResponse = (await client.esql.query({
          query: trendQuery,
          format: 'json',
        })) as unknown as ESQLResponse;
        trendData = columnarToRows(trendResponse);
      } catch (err) {
        const trendErr = err instanceof Error ? err.message : String(err);
        // Trend is optional — report the error but don't fail the metric
        statusWarnings.push(`Trend query failed: ${trendErr}`);
      }
    }

    const metric: MetricConfig = {
      id,
      title,
      chartType: 'metric',
      subtitle,
      color: color || '#54B399',
      valueField: valueField,
      valuePrefix,
      valueSuffix,
      esqlQuery: query,
      trendEsqlQuery: trendQuery,
      trendXField: trendXColumn,
      trendYField: trendYColumn,
      trendShape,
      timeField,
    };

    const dashboard = addChart(metric);

    const formattedValue = `${valuePrefix || ''}${value.toLocaleString()}${valueSuffix || ''}`;
    const statusText =
      `Metric "${title}" added to dashboard: ${formattedValue}` +
      (trendData.length > 0 ? ` (with ${trendData.length}-point ${trendShape} sparkline)` : '') +
      `. Dashboard now has ${dashboard.charts.length} panel(s).` +
      (statusWarnings.length > 0 ? ` Warnings: ${statusWarnings.join('; ')}` : '');

    // Build metric data row for the preview
    const metricDataRow: Record<string, unknown> = { [valueField]: value };
    setChartPreview({ mode: 'chart-preview', chart: metric, data: [metricDataRow], trendData });

    return statusText;
  },
};

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows, validateFields } from '../utils/esql-transform.js';
import { addChart, slugify } from '../utils/dashboard-store.js';
import { registerAppOnlyTool } from '../utils/register-tool.js';
import { setChartPreview } from '../utils/chart-preview-store.js';
import type { MetricConfig, ESQLResponse } from '../types.js';
import { CHART_PREVIEW_RESOURCE_URI } from '../utils/resource-uris.js';

export function registerCreateMetric(server: McpServer): void {
  registerAppOnlyTool(
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
        'Shows an inline chart preview after creation.',
      inputSchema: {
        id: z.string().optional().describe('Unique metric identifier, e.g. "total-revenue"'),
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
          .describe(
            'Column name from the query result to display as the metric number, e.g. "total"'
          ),
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
          .describe(
            'Column name for the trend x-axis (time field), e.g. "BUCKET(order_date, 1 day)"'
          ),
        trendYField: z
          .string()
          .optional()
          .describe('Column name for the trend y-axis (value field), e.g. "revenue"'),
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
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
      _meta: {
        ui: { resourceUri: CHART_PREVIEW_RESOURCE_URI },
      },
    },
    async (args) => {
      const {
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
                text: `Column "${valueField}" is not a number. Got: ${rows[0][valueField]}`,
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
      let trendData: Record<string, unknown>[] = [];
      if (trendEsqlQuery && trendXField && trendYField) {
        try {
          const trendResponse = (await client.esql.query({
            query: trendEsqlQuery,
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
        valueField,
        valuePrefix,
        valueSuffix,
        esqlQuery,
        trendEsqlQuery,
        trendXField,
        trendYField,
        trendShape,
        timeField,
      };

      const dashboard = addChart(metric, args.dashboardId);

      const formattedValue = `${valuePrefix || ''}${value.toLocaleString()}${valueSuffix || ''}`;
      const statusText =
        `Metric "${title}" added to dashboard: ${formattedValue}` +
        (trendData.length > 0 ? ` (with ${trendData.length}-point ${trendShape} sparkline)` : '') +
        `. Dashboard now has ${dashboard.charts.length} panel(s).` +
        (statusWarnings.length > 0 ? ` Warnings: ${statusWarnings.join('; ')}` : '');

      // Build metric data row for the preview
      const metricDataRow: Record<string, unknown> = { [valueField]: value };

      setChartPreview({ mode: 'chart-preview', chart: metric, data: [metricDataRow], trendData });

      return {
        content: [{ type: 'text', text: statusText }],
      };
    }
  );
}

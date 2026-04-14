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
import type { HeatmapConfig, ESQLResponse } from '../types.js';
import { CHART_PREVIEW_RESOURCE_URI } from '../utils/resource-uris.js';

export function registerCreateHeatmap(server: McpServer): void {
  registerAppOnlyTool(
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
        'Shows an inline chart preview after creation.',
      inputSchema: {
        id: z.string().optional().describe('Unique heatmap identifier, e.g. "orders-by-day-hour"'),
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
        xField: z
          .string()
          .describe('Column name from query result for x-axis (horizontal buckets), e.g. "hour"'),
        yField: z
          .string()
          .describe('Column name from query result for y-axis (vertical buckets), e.g. "day"'),
        valueField: z
          .string()
          .describe(
            'Column name from query result for cell values (color intensity), e.g. "order_count"'
          ),
        colorRamp: z
          .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #E91E63'))
          .optional()
          .describe(
            'Optional array of hex colors for the heatmap gradient (low to high), e.g. ["#FCE4EC", "#E91E63"]. Defaults to Borealis temperature palette.'
          ),
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
      const { title, esqlQuery, xField, yField, valueField, colorRamp, timeField } = args;
      const id = args.id || `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;

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
          content: [{ type: 'text', text: 'Query returned no results.' }],
          isError: true,
        };
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
        timeField,
      };

      const dashboard = addChart(heatmap, args.dashboardId);

      const values = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
      const min = Math.min(...values);
      const max = Math.max(...values);

      const statusText =
        `Heatmap "${title}" added to dashboard. ` +
        `Data: ${data.length} cells, x: ${xField}, y: ${yField}, value: ${valueField} (range: ${min}–${max}). ` +
        `Dashboard now has ${dashboard.charts.length} panel(s).`;

      setChartPreview({ mode: 'chart-preview', chart: heatmap, data });

      return {
        content: [{ type: 'text', text: statusText }],
      };
    }
  );
}

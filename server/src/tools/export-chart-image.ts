/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { getChartPreview } from '../utils/chart-preview-store.js';
import { fetchChartData } from '../utils/fetch-chart-data.js';
import { registerTool } from '../utils/register-tool.js';
import { renderChartToPng } from '../utils/puppeteer-export.js';

export function registerExportChartImage(server: McpServer): void {
  registerTool(
    server,
    'export_chart_image',
    {
      title: 'Export Chart Image',
      description:
        'Export a chart as a PNG image. Returns the image inline in the chat. ' +
        'The user can right-click the image to save it. ' +
        'Requires Puppeteer to be installed (npm install puppeteer --workspace=server).',
      inputSchema: {
        chartId: z.string().describe('The chart ID to export as an image.'),
        dashboardId: z
          .string()
          .optional()
          .describe('Target dashboard ID. If omitted, uses the active dashboard.'),
        theme: z
          .enum(['light', 'dark'])
          .optional()
          .default('dark')
          .describe('Color theme for the exported image.'),
      },
    },
    async (args) => {
      // Try the chart preview store first (has pre-fetched data)
      let preview = getChartPreview(args.chartId);

      // If not in the preview store, find it in the dashboard and re-query
      if (!preview) {
        const dashboard = getDashboard(args.dashboardId);
        const chart = dashboard.charts.find((c) => c.id === args.chartId);
        if (!chart) {
          return {
            content: [
              {
                type: 'text',
                text: `Chart "${args.chartId}" not found. Use get_dashboard to see available chart IDs.`,
              },
            ],
            isError: true,
          };
        }

        try {
          const { data, trendData } = await fetchChartData(chart);
          preview = { mode: 'chart-preview', chart, data, trendData };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: 'text', text: `Failed to query data for chart: ${message}` }],
            isError: true,
          };
        }
      }

      // Render the chart to PNG via Puppeteer
      try {
        const base64Png = await renderChartToPng({
          mode: 'chart-preview',
          chart: preview.chart as unknown as Record<string, unknown>,
          data: preview.data,
          trendData: preview.trendData,
          colorMode: args.theme,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Chart "${preview.chart.title}" exported as PNG:`,
            },
            {
              type: 'image',
              data: base64Png,
              mimeType: 'image/png',
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Export failed: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

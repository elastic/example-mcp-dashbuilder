/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { translateDashboardToSavedObject } from '../utils/dashboard-translator.js';
import { registerTool } from '../utils/register-tool.js';
import {
  KIBANA_URL,
  getKibanaAuthHeader,
  getKibanaBasePath,
  kibanaFetch,
} from '../utils/kibana-client.js';
import { parseIndexPattern } from '../utils/esql-parser.js';
import { detectTimeField } from '../utils/time-field.js';

export function registerExportToKibana(server: McpServer): void {
  registerTool(
    server,
    'export_to_kibana',
    {
      title: 'Export to Kibana',
      description:
        'Export the current dashboard to Kibana as a real Kibana dashboard with Lens visualizations. ' +
        'Each chart is translated to a Lens visualization using ES|QL as the data source. ' +
        'Grid positions are preserved (same 48-column system). ' +
        'Returns a direct link to the new dashboard in Kibana.',
      inputSchema: {
        title: z
          .string()
          .optional()
          .describe(
            'Optional title override for the Kibana dashboard. Defaults to the current dashboard title.'
          ),
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
    },
    async (args) => {
      let authHeader: string;
      try {
        authHeader = getKibanaAuthHeader();
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: 'ES_USERNAME and ES_PASSWORD environment variables must be set to export to Kibana.',
            },
          ],
          isError: true,
        };
      }

      const dashboard = getDashboard(args.dashboardId);

      if (dashboard.charts.length === 0) {
        return {
          content: [{ type: 'text', text: 'No charts to export. Create some charts first.' }],
          isError: true,
        };
      }

      if (args.title) {
        dashboard.title = String(args.title);
      }

      // Build time field map: use explicit chart.timeField if set, otherwise detect via field_caps
      const timeFieldMap = new Map<string, string>();
      const seenIndices = new Set<string>();
      for (const chart of dashboard.charts) {
        if (!chart.esqlQuery) continue;
        const index = parseIndexPattern(chart.esqlQuery);
        if (!index || seenIndices.has(index)) continue;
        seenIndices.add(index);

        if (chart.timeField) {
          timeFieldMap.set(index, chart.timeField);
        } else {
          const detected = await detectTimeField(index);
          if (detected) timeFieldMap.set(index, detected);
        }
      }

      // Translate to Kibana saved object format
      const { attributes, references } = translateDashboardToSavedObject(dashboard, timeFieldMap);

      // Create dashboard via saved_objects API
      // TODO: Use the new Dashboard API instead
      const basePath = await getKibanaBasePath();

      let response: Response;
      try {
        response = await kibanaFetch(`${KIBANA_URL}${basePath}/api/saved_objects/dashboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true',
            Authorization: authHeader,
          },
          body: JSON.stringify({ attributes, references }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: 'text', text: `Failed to connect to Kibana at ${KIBANA_URL}: ${message}` },
          ],
          isError: true,
        };
      }

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          content: [{ type: 'text', text: `Kibana API returned ${response.status}: ${errorBody}` }],
          isError: true,
        };
      }

      const result = (await response.json()) as { id?: string };
      const dashboardId = result?.id;

      if (!dashboardId) {
        return {
          content: [
            {
              type: 'text',
              text: `Dashboard created but could not extract ID: ${JSON.stringify(result)}`,
            },
          ],
        };
      }

      const dashboardUrl = `${KIBANA_URL}${basePath}/app/dashboards#/view/${dashboardId}`;

      return {
        content: [
          {
            type: 'text',
            text:
              `Dashboard "${dashboard.title}" exported to Kibana!\n\n` +
              `URL: ${dashboardUrl}\n\n` +
              `Panels exported: ${dashboard.charts.length}\n` +
              `Sections exported: ${(dashboard.sections || []).length}\n` +
              `Chart types: ${[...new Set(dashboard.charts.map((c) => c.chartType))].join(', ')}`,
          },
        ],
      };
    }
  );
}

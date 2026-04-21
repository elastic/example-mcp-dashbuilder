/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { translateDashboardToSavedObject } from '../utils/dashboard-translator.js';
import { translateDashboardToApiPayload } from '../utils/dashboard-api-translator.js';
import { registerTool } from '../utils/register-tool.js';
import {
  getKibanaUrl,
  getKibanaAuthHeader,
  getKibanaBasePath,
  getKibanaCapabilities,
  kibanaFetch,
  readErrorBody,
  DASHBOARD_API_VERSION,
} from '../utils/kibana-client.js';
import { parseIndexPattern } from '../utils/esql-parser.js';
import { detectTimeField } from '../utils/time-field.js';
import type { DashboardConfig } from '../types.js';

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
              text: 'Either ES_API_KEY or ES_USERNAME/ES_PASSWORD must be set to export to Kibana. If using an API key, it must include Kibana application privileges.',
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

      const basePath = await getKibanaBasePath();
      const caps = await getKibanaCapabilities();

      if (caps.hasDashboardApi) {
        return exportViaDashboardApi(dashboard, authHeader, basePath);
      } else {
        return exportViaSavedObjects(dashboard, authHeader, basePath);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// New path: Dashboard API (Kibana 9.4+ / Serverless)
// ---------------------------------------------------------------------------

async function exportViaDashboardApi(
  dashboard: DashboardConfig,
  authHeader: string,
  basePath: string
) {
  // Translate internal dashboard config to the simplified Dashboard API format
  const payload = translateDashboardToApiPayload(dashboard);

  // Create dashboard via the new Dashboard API
  const url = `${getKibanaUrl()}${basePath}/api/dashboards`;

  let response: Response;
  try {
    response = await kibanaFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'kbn-xsrf': 'true',
        'Elastic-Api-Version': DASHBOARD_API_VERSION,
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        { type: 'text', text: `Failed to connect to Kibana at ${getKibanaUrl()}: ${message}` },
      ],
      isError: true,
    };
  }

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    return {
      content: [
        { type: 'text', text: `Kibana Dashboard API returned ${response.status}: ${errorBody}` },
      ],
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

  const dashboardUrl = `${getKibanaUrl()}${basePath}/app/dashboards#/view/${dashboardId}`;

  return {
    content: [
      {
        type: 'text',
        text:
          `Dashboard "${dashboard.title}" exported to Kibana (Dashboard API)!\n\n` +
          `URL: ${dashboardUrl}\n\n` +
          `Panels exported: ${dashboard.charts.length}\n` +
          `Sections exported: ${(dashboard.sections || []).length}\n` +
          `Chart types: ${[...new Set(dashboard.charts.map((c) => c.chartType))].join(', ')}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Legacy path: Saved Objects API (Kibana < 9.4)
// ---------------------------------------------------------------------------

async function exportViaSavedObjects(
  dashboard: DashboardConfig,
  authHeader: string,
  basePath: string
) {
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

  let response: Response;
  try {
    response = await kibanaFetch(`${getKibanaUrl()}${basePath}/api/saved_objects/dashboard`, {
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
        { type: 'text', text: `Failed to connect to Kibana at ${getKibanaUrl()}: ${message}` },
      ],
      isError: true,
    };
  }

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
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

  const dashboardUrl = `${getKibanaUrl()}${basePath}/app/dashboards#/view/${dashboardId}`;

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

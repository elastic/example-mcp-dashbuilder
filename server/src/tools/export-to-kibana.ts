import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { translateDashboardToSavedObject } from '../utils/dashboard-translator.js';
import { registerTool } from '../utils/register-tool.js';

const KIBANA_URL = process.env.KIBANA_URL || 'http://localhost:5601';
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'changeme';

/**
 * Discover Kibana's base path by following the redirect from /api/status.
 */
async function getKibanaBasePath(authHeader: string): Promise<string> {
  try {
    const res = await fetch(`${KIBANA_URL}/api/status`, {
      redirect: 'manual',
      headers: { Authorization: authHeader },
    });
    const location = res.headers.get('location');
    if (location && res.status >= 300 && res.status < 400) {
      // Location is like /fzd/status — extract the base path
      const url = new URL(location, KIBANA_URL);
      const path = url.pathname.replace(/\/status$/, '');
      return path;
    }
  } catch {
    // Fall through to empty base path
  }
  return '';
}

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
      },
    },
    async (args) => {
      const dashboard = getDashboard();

      if (dashboard.charts.length === 0) {
        return {
          content: [{ type: 'text', text: 'No charts to export. Create some charts first.' }],
          isError: true,
        };
      }

      if (args.title) {
        dashboard.title = args.title as string;
      }

      // Translate to Kibana saved object format
      const { attributes, references } = translateDashboardToSavedObject(dashboard);

      // Discover base path
      const authHeader = 'Basic ' + Buffer.from(`${ES_USERNAME}:${ES_PASSWORD}`).toString('base64');
      const basePath = await getKibanaBasePath(authHeader);

      // Create dashboard via saved_objects API
      let response: Response;
      try {
        response = await fetch(`${KIBANA_URL}${basePath}/api/saved_objects/dashboard`, {
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

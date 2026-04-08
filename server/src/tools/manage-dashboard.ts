import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  setDashboardTitle,
  removeChart,
  getDashboard,
  clearDashboard,
  createDashboard,
  listDashboards,
  switchDashboard,
  deleteDashboard,
} from '../utils/dashboard-store.js';
import { registerTool } from '../utils/register-tool.js';

export function registerManageDashboard(server: McpServer): void {
  registerTool(
    server,
    'create_dashboard',
    {
      title: 'Create Dashboard',
      description:
        'Create a new empty dashboard and make it the active one. ' +
        'The previous dashboard is preserved and can be switched back to with switch_dashboard.',
      inputSchema: {
        title: z.string().describe('Dashboard title, e.g. "Ecommerce Overview"'),
        id: z
          .string()
          .optional()
          .describe('Optional ID (auto-generated from title if not provided)'),
      },
    },
    async (args) => {
      const { id: dashId, dashboard } = createDashboard(args.title, args.id);
      return {
        content: [
          {
            type: 'text',
            text: `Dashboard "${dashboard.title}" created (id: ${dashId}) and set as active.`,
          },
        ],
      };
    }
  );

  registerTool(
    server,
    'list_dashboards',
    {
      title: 'List Dashboards',
      description: 'List all saved dashboards with their titles, IDs, and which one is active.',
      inputSchema: {},
    },
    async () => {
      const dashboards = listDashboards();
      if (dashboards.length === 0) {
        return { content: [{ type: 'text', text: 'No dashboards found.' }] };
      }
      const list = dashboards
        .map(
          (d) =>
            `${d.isActive ? '→ ' : '  '}${d.id}: "${d.title}" (updated: ${d.updatedAt || 'never'})`
        )
        .join('\n');
      return { content: [{ type: 'text', text: `Dashboards:\n${list}` }] };
    }
  );

  registerTool(
    server,
    'switch_dashboard',
    {
      title: 'Switch Dashboard',
      description:
        'Switch to a different dashboard by its ID. Use list_dashboards to see available IDs.',
      inputSchema: {
        id: z.string().describe('The dashboard ID to switch to'),
      },
    },
    async (args) => {
      try {
        const dashboard = switchDashboard(args.id);
        return {
          content: [
            {
              type: 'text',
              text: `Switched to dashboard "${dashboard.title}" (${(dashboard.charts || []).length} charts).`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    }
  );

  registerTool(
    server,
    'delete_dashboard',
    {
      title: 'Delete Dashboard',
      description:
        'Delete a saved dashboard by its ID. Cannot delete the last remaining dashboard.',
      inputSchema: {
        id: z.string().describe('The dashboard ID to delete'),
      },
    },
    async (args) => {
      try {
        deleteDashboard(args.id);
        return { content: [{ type: 'text', text: `Dashboard "${args.id}" deleted.` }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    }
  );

  registerTool(
    server,
    'set_dashboard_title',
    {
      title: 'Set Dashboard Title',
      description: 'Set or update the active dashboard title.',
      inputSchema: { title: z.string().describe('The dashboard title') },
    },
    async (args) => {
      const dashboard = setDashboardTitle(args.title);
      return { content: [{ type: 'text', text: `Dashboard title set to "${dashboard.title}".` }] };
    }
  );

  registerTool(
    server,
    'remove_chart',
    {
      title: 'Remove Chart',
      description: 'Remove a chart from the active dashboard by its id.',
      inputSchema: { chartId: z.string().describe('The id of the chart to remove') },
    },
    async (args) => {
      const dashboard = removeChart(args.chartId);
      return {
        content: [
          {
            type: 'text',
            text: `Chart "${args.chartId}" removed. Dashboard now has ${dashboard.charts.length} chart(s).`,
          },
        ],
      };
    }
  );

  registerTool(
    server,
    'get_dashboard',
    {
      title: 'Get Dashboard',
      description: 'Get the active dashboard configuration including all charts.',
      inputSchema: {},
    },
    async () => {
      const dashboard = getDashboard();
      return { content: [{ type: 'text', text: JSON.stringify(dashboard, null, 2) }] };
    }
  );

  registerTool(
    server,
    'clear_dashboard',
    {
      title: 'Clear Dashboard',
      description: 'Remove all charts and reset the active dashboard to a blank state.',
      inputSchema: {},
    },
    async () => {
      clearDashboard();
      return { content: [{ type: 'text', text: 'Dashboard cleared.' }] };
    }
  );
}

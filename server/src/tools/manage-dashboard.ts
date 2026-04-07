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

export const manageDashboardTools = [
  {
    name: 'create_dashboard' as const,
    description:
      'Create a new empty dashboard and make it the active one. ' +
      'The previous dashboard is preserved and can be switched back to with switch_dashboard.',
    parameters: z.object({
      title: z.string().describe('Dashboard title, e.g. "Ecommerce Overview"'),
      id: z.string().optional().describe('Optional ID (auto-generated from title if not provided)'),
    }),
    execute: async (args: { title: string; id?: string }) => {
      const { id: dashId, dashboard } = createDashboard(args.title, args.id);
      return `Dashboard "${dashboard.title}" created (id: ${dashId}) and set as active.`;
    },
  },
  {
    name: 'list_dashboards' as const,
    description: 'List all saved dashboards with their titles, IDs, and which one is active.',
    parameters: z.object({}),
    execute: async () => {
      const dashboards = listDashboards();
      if (dashboards.length === 0) return 'No dashboards found.';
      const list = dashboards
        .map(
          (d) =>
            `${d.isActive ? '→ ' : '  '}${d.id}: "${d.title}" (updated: ${d.updatedAt || 'never'})`
        )
        .join('\n');
      return `Dashboards:\n${list}`;
    },
  },
  {
    name: 'switch_dashboard' as const,
    description:
      'Switch to a different dashboard by its ID. Use list_dashboards to see available IDs.',
    parameters: z.object({
      id: z.string().describe('The dashboard ID to switch to'),
    }),
    execute: async (args: { id: string }) => {
      try {
        const dashboard = switchDashboard(args.id);
        return `Switched to dashboard "${dashboard.title}" (${(dashboard.charts || []).length} charts).`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: message }], isError: true };
      }
    },
  },
  {
    name: 'delete_dashboard' as const,
    description: 'Delete a saved dashboard by its ID. Cannot delete the last remaining dashboard.',
    parameters: z.object({
      id: z.string().describe('The dashboard ID to delete'),
    }),
    execute: async (args: { id: string }) => {
      try {
        deleteDashboard(args.id);
        return `Dashboard "${args.id}" deleted.`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: message }], isError: true };
      }
    },
  },
  {
    name: 'set_dashboard_title' as const,
    description: 'Set or update the active dashboard title.',
    parameters: z.object({
      title: z.string().describe('The dashboard title'),
    }),
    execute: async (args: { title: string }) => {
      const dashboard = setDashboardTitle(args.title);
      return `Dashboard title set to "${dashboard.title}".`;
    },
  },
  {
    name: 'remove_chart' as const,
    description: 'Remove a chart from the active dashboard by its id.',
    parameters: z.object({
      chartId: z.string().describe('The id of the chart to remove'),
    }),
    execute: async (args: { chartId: string }) => {
      const dashboard = removeChart(args.chartId);
      return `Chart "${args.chartId}" removed. Dashboard now has ${dashboard.charts.length} chart(s).`;
    },
  },
  {
    name: 'get_dashboard' as const,
    description: 'Get the active dashboard configuration including all charts.',
    parameters: z.object({}),
    execute: async () => {
      const dashboard = getDashboard();
      return JSON.stringify(dashboard, null, 2);
    },
  },
  {
    name: 'clear_dashboard' as const,
    description: 'Remove all charts and reset the active dashboard to a blank state.',
    parameters: z.object({}),
    execute: async () => {
      clearDashboard();
      return 'Dashboard cleared.';
    },
  },
];

import { readFileSync } from 'fs';
import { getDashboard } from '../utils/dashboard-store.js';
import { MCP_APP_HTML_PATH } from '../utils/config.js';
import { DASHBOARD_RESOURCE_URI, CHART_PREVIEW_RESOURCE_URI } from '../utils/resource-uris.js';

function loadMcpAppHtml(): string {
  try {
    return readFileSync(MCP_APP_HTML_PATH, 'utf-8');
  } catch {
    return `<!DOCTYPE html>
<html><body>
<p>MCP App not built. Run <code>npm run build:mcp-app</code> in the preview directory first.</p>
</body></html>`;
  }
}

// Shared HTML bundle used by both dashboard and chart preview
export const viewDashboardResources = [
  {
    name: 'Dashboard Preview',
    uri: DASHBOARD_RESOURCE_URI,
    description:
      'Interactive dashboard preview rendered with Elastic Charts and Kibana grid layout.',
    mimeType: 'text/html;profile=mcp-app',
    load: async () => ({ text: loadMcpAppHtml() }),
  },
  // Chart preview shares the same HTML bundle — the app detects mode from tool result text
  {
    name: 'Chart Preview',
    uri: CHART_PREVIEW_RESOURCE_URI,
    description: 'Single chart preview rendered with Elastic Charts.',
    mimeType: 'text/html;profile=mcp-app',
    load: async () => ({ text: loadMcpAppHtml() }),
  },
];

export const viewDashboardTools = [
  {
    name: 'view_dashboard' as const,
    description:
      'Display the live dashboard preview inline in the chat. ' +
      'Shows all charts rendered with Elastic Charts in the Kibana grid layout. ' +
      'The preview is interactive — you can see tooltips and hover states.',
    _meta: {
      ui: { resourceUri: DASHBOARD_RESOURCE_URI },
    },
    execute: async () => {
      const dashboard = getDashboard();
      const chartCount = dashboard.charts.length;
      const sectionCount = (dashboard.sections || []).length;

      return (
        `Dashboard "${dashboard.title}" — ${chartCount} chart(s)` +
        (sectionCount > 0 ? `, ${sectionCount} section(s)` : '')
      );
    },
  },
];

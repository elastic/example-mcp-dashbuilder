import { readFileSync } from 'fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { getDashboard } from '../utils/dashboard-store.js';
import { MCP_APP_HTML_PATH } from '../utils/config.js';

const RESOURCE_URI = 'ui://elastic-dashbuilder/dashboard.html';

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

export function registerViewDashboard(server: McpServer): void {
  registerAppResource(
    server,
    'Dashboard Preview',
    RESOURCE_URI,
    {
      description:
        'Interactive dashboard preview rendered with Elastic Charts and Kibana grid layout.',
    },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadMcpAppHtml(),
        },
      ],
    })
  );

  registerAppTool(
    server,
    'view_dashboard',
    {
      title: 'View Dashboard',
      description:
        'Display the live dashboard preview inline in the chat. ' +
        'Shows all charts rendered with Elastic Charts in the Kibana grid layout. ' +
        'The preview is interactive — you can see tooltips and hover states.',
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
      },
    },
    async () => {
      const dashboard = getDashboard();
      const chartCount = dashboard.charts.length;
      const sectionCount = (dashboard.sections || []).length;

      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Dashboard "${dashboard.title}" — ${chartCount} chart(s)` +
              (sectionCount > 0 ? `, ${sectionCount} section(s)` : ''),
          },
        ],
        structuredContent: dashboard as unknown as Record<string, unknown>,
      };
    }
  );
}

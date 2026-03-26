import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { getDashboard } from '../utils/dashboard-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:5173';
const RESOURCE_URI = 'ui://elastic-dashbuilder/dashboard.html';
const MCP_APP_HTML_PATH = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'preview',
  'dist-mcp-app',
  'index.html'
);

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
      _meta: {
        ui: {
          csp: {
            connectDomains: [PREVIEW_URL, 'http://localhost:5173'],
            resourceDomains: [PREVIEW_URL, 'http://localhost:5173'],
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadMcpAppHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [PREVIEW_URL, 'http://localhost:5173'],
                resourceDomains: [PREVIEW_URL, 'http://localhost:5173'],
              },
            },
          },
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
              (sectionCount > 0 ? `, ${sectionCount} section(s)` : '') +
              `\nPreview: ${PREVIEW_URL}`,
          },
        ],
      };
    }
  );
}

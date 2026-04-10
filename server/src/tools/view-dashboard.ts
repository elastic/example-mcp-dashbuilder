/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
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

export function registerViewDashboard(server: McpServer): void {
  // Shared HTML bundle used by both dashboard and chart preview
  const loadHtml = () => ({
    contents: [
      {
        uri: DASHBOARD_RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: loadMcpAppHtml(),
      },
    ],
  });

  registerAppResource(
    server,
    'Dashboard Preview',
    DASHBOARD_RESOURCE_URI,
    {
      description:
        'Interactive dashboard preview rendered with Elastic Charts and Kibana grid layout.',
    },
    async () => loadHtml()
  );

  // Chart preview shares the same HTML bundle — the app detects mode from tool result text
  registerAppResource(
    server,
    'Chart Preview',
    CHART_PREVIEW_RESOURCE_URI,
    {
      description: 'Single chart preview rendered with Elastic Charts.',
    },
    async () => ({
      contents: [
        {
          uri: CHART_PREVIEW_RESOURCE_URI,
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
        ui: { resourceUri: DASHBOARD_RESOURCE_URI },
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
      };
    }
  );
}

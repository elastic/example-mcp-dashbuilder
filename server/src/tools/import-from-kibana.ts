/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createDashboard,
  addChart,
  addSection,
  saveDashboardLayout,
  saveDashboardTimeRange,
  slugify,
} from '../utils/dashboard-store.js';
import { translateLensToPanel } from '../utils/lens-reverse-translator.js';
import {
  translateDashboardApiPanel,
  isDashboardApiSection,
  type DashboardApiResponse,
  type DashboardApiPanelResponse,
} from '../utils/dashboard-api-reverse.js';
import { registerTool } from '../utils/register-tool.js';
import {
  getKibanaUrl,
  getKibanaAuthHeader,
  getKibanaBasePath,
  getKibanaCapabilities,
  parseDashboardId,
  kibanaFetch,
  DASHBOARD_API_VERSION,
} from '../utils/kibana-client.js';
import type { SectionConfig } from '../types.js';

interface KibanaPanel {
  panelIndex: string;
  type: string;
  gridData: { x: number; y: number; w: number; h: number; i: string; sectionId?: string };
  embeddableConfig: { attributes?: Record<string, unknown>; savedObjectId?: string };
}

interface KibanaSection {
  title: string;
  collapsed: boolean;
  gridData: { y: number; i: string };
}

export function registerImportFromKibana(server: McpServer): void {
  registerTool(
    server,
    'import_from_kibana',
    {
      title: 'Import from Kibana',
      description:
        'Import an existing Kibana dashboard into the MCP app. ' +
        'Accepts a dashboard ID or a full Kibana dashboard URL. ' +
        'Translates Lens visualizations back to editable charts that you can modify and re-export. ' +
        'Only ES|QL-based panels are supported; index-pattern-based panels will be skipped.',
      inputSchema: {
        dashboardId: z
          .string()
          .describe(
            'Kibana dashboard ID (UUID) or full URL, e.g. "http://localhost:5601/app/dashboards#/view/abc-123"'
          ),
        title: z
          .string()
          .optional()
          .describe('Optional title override. Defaults to the Kibana dashboard title.'),
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
              text: 'Either ES_API_KEY or ES_USERNAME/ES_PASSWORD must be set to import from Kibana. If using an API key, it must include Kibana application privileges.',
            },
          ],
          isError: true,
        };
      }

      const id = parseDashboardId(args.dashboardId);
      const basePath = await getKibanaBasePath();
      const caps = await getKibanaCapabilities();

      if (caps.hasDashboardApi) {
        return importViaDashboardApi(id, args.title, authHeader, basePath);
      } else {
        return importViaSavedObjects(id, args.title, authHeader, basePath);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// New path: Dashboard API (Kibana 9.4+ / Serverless)
// ---------------------------------------------------------------------------

async function importViaDashboardApi(
  id: string,
  titleOverride: string | undefined,
  authHeader: string,
  basePath: string
) {
  // Fetch the dashboard from Kibana via the new Dashboard API
  const url = `${getKibanaUrl()}${basePath}/api/dashboards/${id}`;

  let response: Response;
  try {
    response = await kibanaFetch(url, {
      headers: {
        Authorization: authHeader,
        'kbn-xsrf': 'true',
        'Elastic-Api-Version': DASHBOARD_API_VERSION,
      },
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
    const errorBody = await response.text();
    return {
      content: [
        { type: 'text', text: `Kibana Dashboard API returned ${response.status}: ${errorBody}` },
      ],
      isError: true,
    };
  }

  const dashboardResponse = (await response.json()) as DashboardApiResponse;
  const dashboardTitle = titleOverride || dashboardResponse.data.title || 'Imported Dashboard';
  const entries = dashboardResponse.data.panels || [];

  // Create a new dashboard in the local store
  createDashboard(dashboardTitle, slugify(dashboardTitle));

  // Translate each panel — only ES|QL-based vis panels are supported
  const imported: string[] = [];
  const skipped: string[] = [];
  const gridLayout: Record<
    string,
    { type: 'panel'; column: number; row: number; width: number; height: number }
  > = {};

  /**
   * Import a single panel, recording grid position and tracking
   * imported / skipped status.
   */
  function importPanel(panel: DashboardApiPanelResponse): string | undefined {
    const panelTitle = (panel.config.title as string) || panel.id;
    const panelId = slugify(panelTitle);

    const result = translateDashboardApiPanel(panel, panelId, panelTitle);
    if ('skip' in result) {
      skipped.push(`"${panelTitle}" — ${result.skip}`);
      return undefined;
    }

    addChart(result.config);
    imported.push(`"${panelTitle}" (${result.config.chartType})`);

    // Preserve grid position from the Kibana dashboard layout
    gridLayout[panelId] = {
      type: 'panel',
      column: panel.grid.x,
      row: panel.grid.y,
      width: panel.grid.w,
      height: panel.grid.h,
    };

    return panelId;
  }

  // Process top-level panels and sections
  let sectionsImported = 0;
  for (const entry of entries) {
    if (isDashboardApiSection(entry)) {
      // Section: import its nested panels, then register the section
      const sectionId = entry.id || slugify(entry.title);
      const panelIds: string[] = [];

      for (const panel of entry.panels) {
        const id = importPanel(panel);
        if (id) panelIds.push(id);
      }

      const sectionConfig: SectionConfig = {
        id: sectionId,
        title: entry.title,
        collapsed: entry.collapsed,
        panelIds,
      };
      addSection(sectionConfig);
      sectionsImported++;
    } else {
      importPanel(entry);
    }
  }

  // Save preserved grid positions so the preview app matches Kibana's layout
  if (Object.keys(gridLayout).length > 0) {
    saveDashboardLayout(gridLayout);
  }

  // Preserve dashboard-level time range if present
  if (dashboardResponse.data.time_range) {
    saveDashboardTimeRange(dashboardResponse.data.time_range);
  }

  const statusText =
    `Dashboard "${dashboardTitle}" imported from Kibana (Dashboard API)!\n\n` +
    `Panels imported: ${imported.length}\n` +
    imported.map((p) => `  - ${p}`).join('\n') +
    (sectionsImported > 0 ? `\n\nSections imported: ${sectionsImported}` : '') +
    (skipped.length > 0
      ? `\n\nSkipped: ${skipped.length}\n` + skipped.map((p) => `  - ${p}`).join('\n')
      : '') +
    `\n`;

  return { content: [{ type: 'text', text: statusText }] };
}

// ---------------------------------------------------------------------------
// Legacy path: Saved Objects API (Kibana < 9.4)
// ---------------------------------------------------------------------------

async function importViaSavedObjects(
  id: string,
  titleOverride: string | undefined,
  authHeader: string,
  basePath: string
) {
  // Fetch the dashboard from Kibana via the saved objects API
  let response: Response;
  try {
    response = await kibanaFetch(`${getKibanaUrl()}${basePath}/api/saved_objects/dashboard/${id}`, {
      headers: {
        Authorization: authHeader,
        'kbn-xsrf': 'true',
      },
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
    const errorBody = await response.text();
    return {
      content: [{ type: 'text', text: `Kibana API returned ${response.status}: ${errorBody}` }],
      isError: true,
    };
  }

  const savedObject = (await response.json()) as {
    attributes: {
      title: string;
      panelsJSON: string;
      sections?: KibanaSection[];
    };
  };

  const dashboardTitle = titleOverride || savedObject.attributes.title || 'Imported Dashboard';

  // Parse panels from the saved object's panelsJSON
  let panels: KibanaPanel[];
  try {
    panels = JSON.parse(savedObject.attributes.panelsJSON || '[]');
  } catch {
    return {
      content: [{ type: 'text', text: 'Failed to parse panelsJSON from Kibana dashboard.' }],
      isError: true,
    };
  }

  // Create a new dashboard in the local store
  createDashboard(dashboardTitle, slugify(dashboardTitle));

  // Translate each panel — only inline Lens ES|QL-based panels are supported
  const imported: string[] = [];
  const skipped: string[] = [];
  const gridLayout: Record<
    string,
    { type: 'panel'; column: number; row: number; width: number; height: number }
  > = {};

  for (const panel of panels) {
    if (panel.type !== 'lens') {
      skipped.push(`${panel.panelIndex} (type: ${panel.type})`);
      continue;
    }

    const attrs = panel.embeddableConfig?.attributes;
    if (!attrs) {
      skipped.push(`${panel.panelIndex} (no attributes — by-reference panel)`);
      continue;
    }

    const panelTitle = (attrs.title as string) || panel.panelIndex;
    const panelId = slugify(panelTitle);

    // Translate only supported chart types; only ES|QL-based panels are supported
    const result = translateLensToPanel(attrs, panelId);
    if ('skip' in result) {
      skipped.push(`"${panelTitle}" — ${result.skip}`);
      continue;
    }

    addChart(result.config);
    imported.push(`"${panelTitle}" (${result.config.chartType})`);

    // Preserve grid position from the Kibana dashboard layout
    gridLayout[panelId] = {
      type: 'panel',
      column: panel.gridData.x,
      row: panel.gridData.y,
      width: panel.gridData.w,
      height: panel.gridData.h,
    };
  }

  // Save preserved grid positions so the preview app matches Kibana's layout
  if (Object.keys(gridLayout).length > 0) {
    saveDashboardLayout(gridLayout);
  }

  // Import sections
  const kibanaSections = savedObject.attributes.sections || [];
  for (const section of kibanaSections) {
    const sectionId = section.gridData.i;
    const panelIds = panels
      .filter((p) => p.gridData.sectionId === sectionId)
      .map((p) => {
        const attrs = p.embeddableConfig?.attributes;
        const pTitle = String(attrs?.title) || p.panelIndex;
        return slugify(pTitle);
      });

    const sectionConfig: SectionConfig = {
      id: sectionId,
      title: section.title,
      collapsed: section.collapsed,
      panelIds,
    };
    addSection(sectionConfig);
  }

  const statusText =
    `Dashboard "${dashboardTitle}" imported from Kibana!\n\n` +
    `Panels imported: ${imported.length}\n` +
    imported.map((p) => `  - ${p}`).join('\n') +
    (skipped.length > 0
      ? `\n\nSkipped: ${skipped.length}\n` + skipped.map((p) => `  - ${p}`).join('\n')
      : '') +
    `\n`;

  return { content: [{ type: 'text', text: statusText }] };
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createDashboard, addChart, addSection } from '../utils/dashboard-store.js';
import { translateLensToPanel } from '../utils/lens-reverse-translator.js';
import { registerTool } from '../utils/register-tool.js';
import {
  KIBANA_URL,
  getKibanaAuthHeader,
  getKibanaBasePath,
  parseDashboardId,
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
              text: 'ES_USERNAME and ES_PASSWORD must be set to import from Kibana.',
            },
          ],
          isError: true,
        };
      }

      const id = parseDashboardId(args.dashboardId as string);
      const basePath = await getKibanaBasePath();

      // Fetch the dashboard from Kibana
      let response: Response;
      try {
        response = await fetch(`${KIBANA_URL}${basePath}/api/saved_objects/dashboard/${id}`, {
          headers: {
            Authorization: authHeader,
            'kbn-xsrf': 'true',
          },
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

      const savedObject = (await response.json()) as {
        attributes: {
          title: string;
          panelsJSON: string;
          sections?: KibanaSection[];
        };
      };

      const dashboardTitle =
        (args.title as string) || savedObject.attributes.title || 'Imported Dashboard';

      // Parse panels
      let panels: KibanaPanel[];
      try {
        panels = JSON.parse(savedObject.attributes.panelsJSON || '[]');
      } catch {
        return {
          content: [{ type: 'text', text: 'Failed to parse panelsJSON from Kibana dashboard.' }],
          isError: true,
        };
      }

      // Create a new dashboard
      const slugId = dashboardTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      createDashboard(dashboardTitle, slugId);

      // Translate each panel
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
        const panelId = panelTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const config = translateLensToPanel(attrs, panelId);
        if (!config) {
          const visType = attrs.visualizationType || 'unknown';
          skipped.push(`"${panelTitle}" (${visType})`);
          continue;
        }

        addChart(config);
        imported.push(`"${panelTitle}" (${config.chartType})`);

        // Preserve grid position
        gridLayout[panelId] = {
          type: 'panel',
          column: panel.gridData.x,
          row: panel.gridData.y,
          width: panel.gridData.w,
          height: panel.gridData.h,
        };
      }

      // Import sections
      const kibanaSections = savedObject.attributes.sections || [];
      for (const section of kibanaSections) {
        const sectionId = section.gridData.i;
        const panelIds = panels
          .filter((p) => p.gridData.sectionId === sectionId)
          .map((p) => {
            const attrs = p.embeddableConfig?.attributes;
            const panelTitle = (attrs?.title as string) || p.panelIndex;
            return panelTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
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
        `\n\nPreview: http://localhost:5173`;

      return { content: [{ type: 'text', text: statusText }] };
    }
  );
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerAppOnlyTool } from '../utils/register-tool.js';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows } from '../utils/esql-transform.js';
import { parseIndexPattern } from '../utils/esql-parser.js';
import { detectTimeField } from '../utils/time-field.js';
import { getDashboard, saveDashboardLayout } from '../utils/dashboard-store.js';
import type { ESQLResponse, DashboardConfig } from '../types.js';

/**
 * Register app-only tools (visibility: ["app"]) that the MCP App
 * calls via callServerTool() instead of HTTP. These are hidden from
 * the model and exist purely for the View's interactive use.
 */
export function registerAppOnlyTools(server: McpServer): void {
  // ── get-dashboard-config ──────────────────────────────────────────────
  // Returns the full dashboard config. The MCP App calls this on init
  // and whenever it needs to refresh (e.g. after the model creates a chart).
  registerAppOnlyTool(
    server,
    'get-dashboard-config',
    {
      title: 'Get Dashboard Config',
      description:
        'Returns the full active dashboard configuration including all charts, sections, and layout.',
      inputSchema: {},
      _meta: { ui: { visibility: ['app'] } },
    },
    async () => {
      const dashboard = getDashboard();
      return {
        content: [
          {
            type: 'text' as const,
            text: `Dashboard "${dashboard.title}" — ${dashboard.charts.length} chart(s)`,
          },
        ],
        structuredContent: dashboard as unknown as Record<string, unknown>,
      };
    }
  );

  // ── run-esql-query ────────────────────────────────────────────────────
  // Runs an ES|QL query with optional time range filtering via DSL filter.
  // Replaces the Vite /api/esql proxy endpoint.
  registerAppOnlyTool(
    server,
    'run-esql-query',
    {
      title: 'Run ES|QL Query (App)',
      description:
        'Execute an ES|QL query with optional time range filtering. Used by the dashboard preview to fetch chart data.',
      inputSchema: {
        query: z.string().describe('ES|QL query to execute'),
        start: z.string().optional().describe('Time range start (e.g. "now-15m" or ISO date)'),
        end: z.string().optional().describe('Time range end (e.g. "now" or ISO date)'),
        timeField: z
          .string()
          .optional()
          .describe('Explicit time field for filtering. If omitted, auto-detected via field_caps.'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ query, start, end, timeField: explicitTimeField }) => {
      try {
        const client = getESClient();

        // Build DSL time filter if time range provided
        let filter: Record<string, unknown> | undefined;
        if (start && end) {
          let resolvedTimeField = explicitTimeField;
          if (!resolvedTimeField) {
            const index = parseIndexPattern(query);
            if (index) {
              const detected = await detectTimeField(index);
              // Only auto-apply for well-known time fields to avoid wrong filtering
              if (detected === '@timestamp' || detected === 'timestamp') {
                resolvedTimeField = detected;
              }
            }
          }
          if (resolvedTimeField) {
            filter = { range: { [resolvedTimeField]: { gte: start, lte: end } } };
          }
        }

        const response = (await client.esql.query({
          query,
          ...(filter && { filter }),
          format: 'json',
        })) as unknown as ESQLResponse;

        const rows = columnarToRows(response);
        const columns = response.columns.map((col) => ({ name: col.name, type: col.type }));

        return {
          content: [{ type: 'text' as const, text: `${rows.length} row(s)` }],
          structuredContent: { rows, columns } as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `ES|QL query failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── save-panel-layout ─────────────────────────────────────────────────
  // Persists grid layout changes when the user drags/resizes panels.
  // Replaces the Vite /api/save-layout endpoint.
  registerAppOnlyTool(
    server,
    'save-panel-layout',
    {
      title: 'Save Panel Layout',
      description: 'Persist grid layout changes from drag/resize in the dashboard.',
      inputSchema: {
        layout: z.record(z.string(), z.unknown()).describe('Grid layout data from kbn-grid-layout'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ layout }) => {
      try {
        saveDashboardLayout(layout as DashboardConfig['gridLayout']);
        return {
          content: [{ type: 'text' as const, text: 'Layout saved' }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Failed to save layout: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── detect-time-field ─────────────────────────────────────────────────
  // Runs field_caps to detect the time field for an index pattern.
  // Used by the time picker to know which field to filter on.
  registerAppOnlyTool(
    server,
    'detect-time-field',
    {
      title: 'Detect Time Field',
      description: 'Detect the time field for an index pattern via field_caps API.',
      inputSchema: {
        index: z.string().describe('Index pattern (e.g. "kibana_sample_data_logs")'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ index }) => {
      try {
        const timeField = await detectTimeField(index);
        return {
          content: [
            {
              type: 'text' as const,
              text: timeField ? `Time field: ${timeField}` : 'No time field found',
            },
          ],
          structuredContent: { timeField: timeField ?? null } as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `field_caps failed: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

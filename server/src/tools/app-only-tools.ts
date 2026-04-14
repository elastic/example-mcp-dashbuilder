/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerAppOnlyTool } from '../utils/register-tool.js';
import { getESClient } from '../utils/es-client.js';
import { columnarToRows } from '../utils/esql-transform.js';
import { parseIndexPattern } from '../utils/esql-parser.js';
import { detectTimeField } from '../utils/time-field.js';
import { getDashboard, saveDashboardLayout } from '../utils/dashboard-store.js';
import { getChartPreview } from '../utils/chart-preview-store.js';
import { getJsonUiPayload } from '../utils/json-ui-store.js';
import { dispatchJsonUiAction } from '../utils/json-ui-actions.js';
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
    'app_only_get_dashboard_config',
    {
      title: 'Get Dashboard Config',
      description:
        'Returns the full dashboard configuration including all charts, sections, and layout.',
      inputSchema: {
        dashboardId: z
          .string()
          .optional()
          .describe('Dashboard ID to retrieve. If omitted, returns the active dashboard.'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ dashboardId }) => {
      const dashboard = getDashboard(dashboardId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(dashboard),
          },
        ],
      };
    }
  );

  // ── get-json-ui-payload ────────────────────────────────────────────────
  // Returns the exact immutable JSON UI snapshot for a specific uiId.
  registerAppOnlyTool(
    server,
    'app_only_get_json_ui_payload',
    {
      title: 'Get JSON UI Payload',
      description:
        'Returns a stored json-render snapshot including the validated spec and current state.',
      inputSchema: {
        uiId: z.string().describe('Immutable JSON UI snapshot ID to load'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ uiId }) => {
      const payload = getJsonUiPayload(uiId);
      if (!payload) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `JSON UI snapshot "${uiId}" not found.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }
  );

  // ── run-esql-query ────────────────────────────────────────────────────
  // Runs an ES|QL query with optional time range filtering via DSL filter.
  registerAppOnlyTool(
    server,
    'app_only_esql_query',
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
          content: [{ type: 'text' as const, text: JSON.stringify({ rows, columns }) }],
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
  registerAppOnlyTool(
    server,
    'app_only_save_panel_layout',
    {
      title: 'Save Panel Layout',
      description: 'Persist grid layout changes from drag/resize in the dashboard.',
      inputSchema: {
        layout: z.record(z.string(), z.unknown()).describe('Grid layout data from kbn-grid-layout'),
        dashboardId: z
          .string()
          .optional()
          .describe('Dashboard ID for session isolation. If omitted, uses the active dashboard.'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ layout, dashboardId }) => {
      try {
        saveDashboardLayout(layout as DashboardConfig['gridLayout'], dashboardId);
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
    'app_only_detect_time_field',
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
              text: JSON.stringify({ timeField: timeField ?? null }),
            },
          ],
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

  // ── dispatch-json-ui-action ────────────────────────────────────────────
  // Executes a small allowlisted action surface for json-render previews.
  registerAppOnlyTool(
    server,
    'app_only_dispatch_json_ui_action',
    {
      title: 'Dispatch JSON UI Action',
      description:
        'Dispatch an allowlisted JSON UI action such as sync_state, reset_state, or refresh_ui.',
      inputSchema: {
        uiId: z.string().describe('Immutable JSON UI snapshot ID to operate on'),
        action: z
          .enum(['sync_state', 'reset_state', 'refresh_ui'])
          .describe('Allowlisted JSON UI action name'),
        state: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Optional current local state, required for sync_state'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ uiId, action, state }) => {
      try {
        const result = dispatchJsonUiAction(uiId, action, state);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `JSON UI action failed: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── app_only_get_chart_preview ─────────────────────────────────────────────────
  // Returns chart preview data by ID (or most recent if no ID given).
  // Called by the MCP App after create_chart/metric/heatmap renders the iframe.
  registerAppOnlyTool(
    server,
    'app_only_get_chart_preview',
    {
      title: 'Get Chart Preview',
      description:
        'Returns chart preview data including chart config and pre-fetched query results.',
      inputSchema: {
        chartId: z
          .string()
          .optional()
          .describe('Chart ID to retrieve. If omitted, returns the most recent preview.'),
      },
      _meta: { ui: { visibility: ['app'] } },
    },
    async ({ chartId }) => {
      const preview = getChartPreview(chartId);
      if (!preview) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'No chart preview available' }),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(preview) }],
      };
    }
  );
}

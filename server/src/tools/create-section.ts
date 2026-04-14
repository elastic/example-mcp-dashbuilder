/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addSection, movePanelToSection, removeSection } from '../utils/dashboard-store.js';
import { registerTool } from '../utils/register-tool.js';

export function registerSectionTools(server: McpServer): void {
  registerTool(
    server,
    'create_section',
    {
      title: 'Create Section',
      description:
        'Create a collapsible section (row group) on the dashboard. ' +
        'Sections group related panels visually with a collapsible header. ' +
        'Best practice: 2-4 panels per section, use descriptive titles like "Revenue Metrics" or "Order Trends". ' +
        'Place KPI metrics at the top, detail charts below. See dataviz-guidelines resource. ' +
        'After creating a section, use move_panel_to_section to assign panels to it.',
      inputSchema: {
        id: z.string().describe('Unique section identifier, e.g. "revenue-section"'),
        title: z
          .string()
          .describe('Section title displayed in the collapsible header, e.g. "Revenue Metrics"'),
        panelIds: z
          .array(z.string())
          .optional()
          .default([])
          .describe('Optional list of panel IDs to include in this section immediately'),
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
    },
    async (args) => {
      const { id, title, panelIds } = args;

      const dashboard = addSection({ id, title, collapsed: false, panelIds }, args.dashboardId);

      return {
        content: [
          {
            type: 'text',
            text: `Section "${title}" created with ${panelIds.length} panel(s). Dashboard now has ${dashboard.sections.length} section(s).`,
          },
        ],
      };
    }
  );

  registerTool(
    server,
    'move_panel_to_section',
    {
      title: 'Move Panel to Section',
      description:
        'Move a panel into a collapsible section. The panel will be removed from any other section it belongs to.',
      inputSchema: {
        panelId: z.string().describe('The ID of the panel to move'),
        sectionId: z.string().describe('The ID of the section to move the panel into'),
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
    },
    async (args) => {
      movePanelToSection(args.panelId, args.sectionId, args.dashboardId);
      return {
        content: [
          { type: 'text', text: `Panel "${args.panelId}" moved to section "${args.sectionId}".` },
        ],
      };
    }
  );

  registerTool(
    server,
    'remove_section',
    {
      title: 'Remove Section',
      description: 'Remove a section. Panels in the section will become top-level panels again.',
      inputSchema: {
        sectionId: z.string().describe('The ID of the section to remove'),
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
    },
    async (args) => {
      removeSection(args.sectionId, args.dashboardId);
      return {
        content: [{ type: 'text', text: `Section "${args.sectionId}" removed.` }],
      };
    }
  );
}

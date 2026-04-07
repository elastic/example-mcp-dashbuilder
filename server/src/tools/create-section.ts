import { z } from 'zod';
import { addSection, movePanelToSection, removeSection } from '../utils/dashboard-store.js';

export const sectionTools = [
  {
    name: 'create_section' as const,
    description:
      'Create a collapsible section (row group) on the dashboard. ' +
      'Sections group related panels visually with a collapsible header. ' +
      'Best practice: 2-4 panels per section, use descriptive titles like "Revenue Metrics" or "Order Trends". ' +
      'Place KPI metrics at the top, detail charts below. See dataviz-guidelines resource. ' +
      'After creating a section, use move_panel_to_section to assign panels to it.',
    parameters: z.object({
      id: z.string().describe('Unique section identifier, e.g. "revenue-section"'),
      title: z
        .string()
        .describe('Section title displayed in the collapsible header, e.g. "Revenue Metrics"'),
      panelIds: z
        .array(z.string())
        .optional()
        .default([])
        .describe('Optional list of panel IDs to include in this section immediately'),
    }),
    execute: async (args: { id: string; title: string; panelIds: string[] }) => {
      const { id, title, panelIds } = args;
      const dashboard = addSection({ id, title, collapsed: false, panelIds });
      return `Section "${title}" created with ${panelIds.length} panel(s). Dashboard now has ${dashboard.sections.length} section(s).`;
    },
  },
  {
    name: 'move_panel_to_section' as const,
    description:
      'Move a panel into a collapsible section. The panel will be removed from any other section it belongs to.',
    parameters: z.object({
      panelId: z.string().describe('The ID of the panel to move'),
      sectionId: z.string().describe('The ID of the section to move the panel into'),
    }),
    execute: async (args: { panelId: string; sectionId: string }) => {
      movePanelToSection(args.panelId, args.sectionId);
      return `Panel "${args.panelId}" moved to section "${args.sectionId}".`;
    },
  },
  {
    name: 'remove_section' as const,
    description: 'Remove a section. Panels in the section will become top-level panels again.',
    parameters: z.object({
      sectionId: z.string().describe('The ID of the section to remove'),
    }),
    execute: async (args: { sectionId: string }) => {
      removeSection(args.sectionId);
      return `Section "${args.sectionId}" removed.`;
    },
  },
];

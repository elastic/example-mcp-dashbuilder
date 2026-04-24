/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { randomUUID } from 'crypto';
import type { DashboardConfig, PanelConfig } from '../types.js';
import { translatePanelToLens } from './lens-translator.js';
import type { TimeFieldContext } from './lens-translator.js';
import { parseIndexPattern } from './esql-parser.js';
import { autoPlacePanels as autoPlacePanelsGeneric } from 'mcp-dashboards-shared';

interface SavedDashboardPanel {
  panelIndex: string;
  type: string;
  gridData: { x: number; y: number; w: number; h: number; i: string; sectionId?: string };
  embeddableConfig: Record<string, unknown>;
}

function buildSavedPanel(
  chart: PanelConfig,
  grid: { x: number; y: number; w: number; h: number },
  sectionId?: string,
  ctx?: TimeFieldContext
): SavedDashboardPanel {
  const panelIndex = randomUUID();
  const { attributes } = translatePanelToLens(chart, ctx);

  return {
    panelIndex,
    type: 'lens',
    gridData: {
      ...grid,
      i: panelIndex,
      ...(sectionId ? { sectionId } : {}),
    },
    embeddableConfig: { attributes },
  };
}

/**
 * Auto-place panels in a flowing layout (fallback when no grid positions stored).
 */
function autoPlacePanels(
  charts: PanelConfig[],
  startRow: number = 0,
  sectionId?: string,
  ctxFn?: (chart: PanelConfig) => TimeFieldContext | undefined
): { panels: SavedDashboardPanel[]; nextRow: number } {
  const chartMap = new Map(charts.map((c) => [c.id, c]));
  const { placements, nextRow } = autoPlacePanelsGeneric(charts, startRow);

  const panels = placements.map((p) => {
    const chart = chartMap.get(p.id)!;
    return buildSavedPanel(chart, { x: p.x, y: p.y, w: p.w, h: p.h }, sectionId, ctxFn?.(chart));
  });

  return { panels, nextRow };
}

/**
 * Translate the MCP dashboard config into the saved_objects API format.
 * Uses grid positions from gridLayout if the user has dragged/resized panels.
 */
export function translateDashboardToSavedObject(
  config: DashboardConfig,
  timeFieldMap?: Map<string, string>
): {
  attributes: Record<string, unknown>;
  references: Array<{ name: string; type: string; id: string }>;
} {
  const sections = config.sections || [];
  const chartMap = new Map(config.charts.map((c) => [c.id, c]));
  const gridLayout = config.gridLayout;

  // Build TimeFieldContext for a chart from the index→timeField map
  function getCtx(chart: PanelConfig): TimeFieldContext | undefined {
    if (!timeFieldMap || !chart.esqlQuery) return undefined;
    const index = parseIndexPattern(chart.esqlQuery);
    if (!index) return undefined;
    const timeField = timeFieldMap.get(index);
    if (!timeField) return undefined;
    return { indexPattern: index, timeField };
  }

  const assignedPanelIds = new Set<string>();
  for (const section of sections) {
    for (const panelId of section.panelIds) {
      assignedPanelIds.add(panelId);
    }
  }

  let allPanels: SavedDashboardPanel[];
  const sectionsArray: Array<{
    title: string;
    collapsed: boolean;
    gridData: { y: number; i: string };
  }> = [];

  if (gridLayout) {
    // Use positions from user's drag/resize in the preview app
    allPanels = [];

    for (const [widgetId, widget] of Object.entries(gridLayout)) {
      if (widget.type === 'panel') {
        const chart = chartMap.get(widgetId);
        if (chart) {
          allPanels.push(
            buildSavedPanel(
              chart,
              { x: widget.column, y: widget.row, w: widget.width, h: widget.height },
              undefined,
              getCtx(chart)
            )
          );
        }
      } else if (widget.type === 'section') {
        sectionsArray.push({
          title: widget.title,
          collapsed: widget.isCollapsed ?? false,
          gridData: { y: widget.row, i: widgetId },
        });

        if (widget.panels) {
          for (const [panelId, panel] of Object.entries(widget.panels)) {
            const chart = chartMap.get(panelId);
            if (chart) {
              allPanels.push(
                buildSavedPanel(
                  chart,
                  { x: panel.column, y: panel.row, w: panel.width, h: panel.height },
                  widgetId,
                  getCtx(chart)
                )
              );
            }
          }
        }
      }
    }
  } else {
    // Fallback: auto-place
    const unassignedCharts = config.charts.filter((c) => !assignedPanelIds.has(c.id));
    const { panels: topLevelPanels, nextRow: afterTopLevel } = autoPlacePanels(
      unassignedCharts,
      0,
      undefined,
      getCtx
    );
    allPanels = [...topLevelPanels];

    let sectionRow = afterTopLevel;
    for (const section of sections) {
      const sectionCharts = section.panelIds
        .map((id) => chartMap.get(id))
        .filter((c): c is PanelConfig => c !== undefined);

      const { panels: sectionPanels } = autoPlacePanels(sectionCharts, 0, section.id, getCtx);
      sectionsArray.push({
        title: section.title,
        collapsed: section.collapsed,
        gridData: { y: sectionRow, i: section.id },
      });
      allPanels = [...allPanels, ...sectionPanels];
      sectionRow++;
    }
  }

  const options = {
    hidePanelTitles: false,
    useMargins: true,
    syncColors: false,
    syncCursor: true,
    syncTooltips: false,
  };

  return {
    attributes: {
      title: config.title,
      description: `Exported from MCP Dashboard App on ${new Date().toLocaleDateString()}`,
      panelsJSON: JSON.stringify(allPanels),
      optionsJSON: JSON.stringify(options),
      ...(sectionsArray.length > 0 ? { sections: sectionsArray } : {}),
    },
    references: [],
  };
}

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
import { DEFAULT_SIZES, GRID_COLUMN_COUNT } from './grid-constants.js';

interface SavedDashboardPanel {
  panelIndex: string;
  type: string;
  gridData: { x: number; y: number; w: number; h: number; i: string; sectionId?: string };
  embeddableConfig: Record<string, unknown>;
}

interface RowPanel {
  chart: PanelConfig;
  height: number;
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

function buildBalancedRowWidths(panelCount: number, columnCount: number): number[] {
  const baseWidth = Math.floor(columnCount / panelCount);
  const remainder = columnCount % panelCount;

  return Array.from({ length: panelCount }, (_, index) => baseWidth + (index < remainder ? 1 : 0));
}

function flushRow(
  rowPanels: RowPanel[],
  nextRow: number,
  panels: SavedDashboardPanel[],
  sectionId: string | undefined,
  ctxFn?: (chart: PanelConfig) => TimeFieldContext | undefined
): number {
  if (rowPanels.length === 0) {
    return 0;
  }

  const widths = buildBalancedRowWidths(rowPanels.length, GRID_COLUMN_COUNT);
  let column = 0;
  let maxHeightInRow = 0;

  for (const [index, rowPanel] of rowPanels.entries()) {
    panels.push(
      buildSavedPanel(
        rowPanel.chart,
        { x: column, y: nextRow, w: widths[index], h: rowPanel.height },
        sectionId,
        ctxFn?.(rowPanel.chart)
      )
    );
    column += widths[index];
    maxHeightInRow = Math.max(maxHeightInRow, rowPanel.height);
  }

  return maxHeightInRow;
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
  const panels: SavedDashboardPanel[] = [];
  let nextRow = startRow;
  let rowPanels: RowPanel[] = [];
  let widthInRow = 0;

  const commitRow = () => {
    const maxHeightInRow = flushRow(rowPanels, nextRow, panels, sectionId, ctxFn);
    if (maxHeightInRow > 0) {
      nextRow += maxHeightInRow;
    }
    rowPanels = [];
    widthInRow = 0;
  };

  for (const chart of charts) {
    const size = DEFAULT_SIZES[chart.chartType] || DEFAULT_SIZES.bar;
    if (rowPanels.length > 0 && widthInRow + size.w > GRID_COLUMN_COUNT) {
      commitRow();
    }

    rowPanels.push({ chart, height: size.h });
    widthInRow += size.w;

    if (widthInRow >= GRID_COLUMN_COUNT) {
      commitRow();
    }
  }

  commitRow();
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

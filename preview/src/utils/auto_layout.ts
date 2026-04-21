/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { GridLayoutData, GridPanelData } from '../grid-layout';
import { GRID_SETTINGS } from '../constants';
import type { PanelConfig, SectionConfig } from '../types';
import { autoPlacePanels as autoPlacePanelsGeneric } from 'mcp-dashboards-shared';

export { buildBalancedRowWidths } from 'mcp-dashboards-shared';

/**
 * Auto-place panels and return a record keyed by panel id (legacy API shape).
 */
export function autoPlacePanels(
  charts: PanelConfig[],
  startRow: number = 0,
  columnCount: number = GRID_SETTINGS.columnCount
): { panels: Record<string, GridPanelData>; nextRow: number } {
  const { placements, nextRow } = autoPlacePanelsGeneric(charts, startRow, columnCount);
  const panels: Record<string, GridPanelData> = {};

  for (const p of placements) {
    panels[p.id] = {
      id: p.id,
      column: p.x,
      row: p.y,
      width: p.w,
      height: p.h,
    };
  }

  return { panels, nextRow };
}

export function buildAutoGridLayout(
  charts: PanelConfig[],
  sections: SectionConfig[]
): GridLayoutData {
  const layout: GridLayoutData = {};
  const chartMap = new Map(charts.map((chart) => [chart.id, chart]));

  const assignedPanelIds = new Set<string>();
  for (const section of sections) {
    for (const panelId of section.panelIds) {
      assignedPanelIds.add(panelId);
    }
  }

  const unassignedCharts = charts.filter((chart) => !assignedPanelIds.has(chart.id));
  const { panels: topLevelPanels, nextRow: afterTopLevel } = autoPlacePanels(unassignedCharts, 0);

  for (const [id, panel] of Object.entries(topLevelPanels)) {
    layout[id] = { ...panel, type: 'panel' as const };
  }

  let sectionRow = afterTopLevel;
  for (const section of sections) {
    const sectionCharts = section.panelIds
      .map((id) => chartMap.get(id))
      .filter((chart): chart is PanelConfig => chart !== undefined);

    const { panels: sectionPanels } = autoPlacePanels(sectionCharts, 0);

    layout[section.id] = {
      type: 'section' as const,
      id: section.id,
      row: sectionRow,
      title: section.title,
      isCollapsed: section.collapsed,
      panels: sectionPanels,
    };

    sectionRow++;
  }

  return layout;
}

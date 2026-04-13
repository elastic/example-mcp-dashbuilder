/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { GridLayoutData, GridPanelData } from '../grid-layout';
import { DEFAULT_SIZES, GRID_SETTINGS } from '../constants';
import type { PanelConfig, SectionConfig } from '../types';

interface RowPanel {
  chart: PanelConfig;
  height: number;
}

function finalizeRow(
  rowPanels: RowPanel[],
  row: number,
  panels: Record<string, GridPanelData>,
  columnCount: number
): number {
  if (rowPanels.length === 0) {
    return 0;
  }

  const baseWidth = Math.floor(columnCount / rowPanels.length);
  const remainder = columnCount % rowPanels.length;
  let column = 0;
  let maxHeightInRow = 0;

  for (const [index, rowPanel] of rowPanels.entries()) {
    const width = baseWidth + (index < remainder ? 1 : 0);
    panels[rowPanel.chart.id] = {
      id: rowPanel.chart.id,
      column,
      row,
      width,
      height: rowPanel.height,
    };
    column += width;
    maxHeightInRow = Math.max(maxHeightInRow, rowPanel.height);
  }

  return maxHeightInRow;
}

export function autoPlacePanels(
  charts: PanelConfig[],
  startRow: number = 0,
  columnCount: number = GRID_SETTINGS.columnCount
): { panels: Record<string, GridPanelData>; nextRow: number } {
  const panels: Record<string, GridPanelData> = {};
  let nextRow = startRow;
  let rowPanels: RowPanel[] = [];
  let widthInRow = 0;

  const flushRow = () => {
    const maxHeightInRow = finalizeRow(rowPanels, nextRow - startRow, panels, columnCount);
    if (maxHeightInRow > 0) {
      nextRow += maxHeightInRow;
    }
    rowPanels = [];
    widthInRow = 0;
  };

  for (const chart of charts) {
    const size = DEFAULT_SIZES[chart.chartType] || DEFAULT_SIZES.bar;
    if (rowPanels.length > 0 && widthInRow + size.w > columnCount) {
      flushRow();
    }

    rowPanels.push({ chart, height: size.h });
    widthInRow += size.w;

    if (widthInRow >= columnCount) {
      flushRow();
    }
  }

  flushRow();
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

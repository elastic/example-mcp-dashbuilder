/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { DEFAULT_SIZES, GRID_COLUMN_COUNT } from './grid-constants.js';

/** Minimal panel shape needed for auto-placement. */
export interface PlaceablePanel {
  id: string;
  chartType: string;
}

/** Generic grid placement returned by autoPlacePanels. */
export interface GridPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Distribute `columnCount` columns across `panelCount` panels as evenly as
 * possible, giving earlier panels any remainder columns.
 */
export function buildBalancedRowWidths(panelCount: number, columnCount: number): number[] {
  const baseWidth = Math.floor(columnCount / panelCount);
  const remainder = columnCount % panelCount;
  return Array.from({ length: panelCount }, (_, i) => baseWidth + (i < remainder ? 1 : 0));
}

/**
 * Auto-place panels into rows that respect each panel's default width,
 * then balance the row so panels stretch to fill the full column count.
 */
export function autoPlacePanels(
  panels: PlaceablePanel[],
  startRow: number = 0,
  columnCount: number = GRID_COLUMN_COUNT
): { placements: GridPlacement[]; nextRow: number } {
  const placements: GridPlacement[] = [];
  let nextRow = startRow;

  let rowPanels: Array<{ panel: PlaceablePanel; h: number }> = [];
  let widthInRow = 0;

  const commitRow = () => {
    if (rowPanels.length === 0) return;

    const widths = buildBalancedRowWidths(rowPanels.length, columnCount);
    let col = 0;
    let maxH = 0;

    for (const [i, rp] of rowPanels.entries()) {
      placements.push({ id: rp.panel.id, x: col, y: nextRow, w: widths[i], h: rp.h });
      col += widths[i];
      maxH = Math.max(maxH, rp.h);
    }

    nextRow += maxH;
    rowPanels = [];
    widthInRow = 0;
  };

  for (const panel of panels) {
    const size = DEFAULT_SIZES[panel.chartType] || DEFAULT_SIZES.bar;

    if (rowPanels.length > 0 && widthInRow + size.w > columnCount) {
      commitRow();
    }

    rowPanels.push({ panel, h: size.h });
    widthInRow += size.w;

    if (widthInRow >= columnCount) {
      commitRow();
    }
  }

  commitRow();
  return { placements, nextRow };
}

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PartialTheme, Theme } from '@elastic/charts';
import { getChartsTheme } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

export interface ChartsTheme {
  baseTheme: Theme;
  theme: PartialTheme;
}

const NUMERIC_FONT_FAMILY = "'Elastic UI Numeric'";

function applyNumericFontFamily(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(applyNumericFontFamily);
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(record)) {
    if (key === 'fontFamily' && typeof entry === 'string') {
      record[key] = entry.includes(NUMERIC_FONT_FAMILY)
        ? entry
        : `${NUMERIC_FONT_FAMILY}, ${entry}`;
      continue;
    }
    applyNumericFontFamily(entry);
  }
}

export function getElasticChartsTheme(
  heatmapBorderColor: string,
  isDarkMode: boolean
): ChartsTheme {
  const colorMode = isDarkMode ? 'DARK' : 'LIGHT';
  const baseTheme = getChartsTheme('borealis', colorMode);

  applyNumericFontFamily(baseTheme);

  const { fill } = baseTheme.axes.tickLabel;
  baseTheme.axes.axisTitle.fill = fill;
  baseTheme.axes.axisTitle.fontWeight = 500;
  baseTheme.axes.axisPanelTitle.fill = fill;
  baseTheme.axes.axisPanelTitle.fontWeight = 500;

  return {
    baseTheme,
    theme: {
      background: { color: 'transparent' },
      colors: {
        vizColors: KIBANA_PALETTE,
        defaultVizColor: KIBANA_PALETTE[0],
      },
      heatmap: {
        cell: {
          border: { stroke: heatmapBorderColor, strokeWidth: 1 },
        },
        grid: {
          stroke: { width: 1, color: heatmapBorderColor },
        },
      },
    },
  };
}

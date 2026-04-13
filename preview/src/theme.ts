/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PartialTheme, Theme } from '@elastic/charts';
import { DARK_THEME, LIGHT_THEME } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

const NUMERIC_FONT_FAMILY = "'Elastic UI Numeric'";

export interface ChartsTheme {
  baseTheme: Theme;
  theme: PartialTheme;
}

export function getElasticChartsTheme(
  heatmapBorderColor: string,
  isDarkMode: boolean
): ChartsTheme {
  const base = isDarkMode ? DARK_THEME : LIGHT_THEME;
  const ff = `${NUMERIC_FONT_FAMILY}, ${base.axes.tickLabel.fontFamily}`;

  return {
    baseTheme: base,
    theme: {
      background: {
        color: 'transparent',
      },
      colors: {
        vizColors: KIBANA_PALETTE,
        defaultVizColor: KIBANA_PALETTE[0],
      },
      axes: {
        tickLabel: { fontFamily: ff },
        axisTitle: { fontFamily: ff },
        axisPanelTitle: { fontFamily: ff },
      },
      barSeriesStyle: {
        displayValue: { fontFamily: ff },
      },
      partition: {
        fontFamily: ff,
        fillLabel: { fontFamily: ff },
        linkLabel: { fontFamily: ff },
      },
      heatmap: {
        xAxisLabel: { fontFamily: ff },
        yAxisLabel: { fontFamily: ff },
        cell: {
          label: { fontFamily: ff },
          border: { stroke: heatmapBorderColor, strokeWidth: 1 },
        },
        grid: {
          stroke: { width: 1, color: heatmapBorderColor },
        },
      },
    },
  };
}

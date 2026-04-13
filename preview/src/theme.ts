/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PartialTheme, Theme } from '@elastic/charts';
import { DARK_THEME, LIGHT_THEME } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

export interface ChartsTheme {
  baseTheme: Theme;
  theme: PartialTheme;
}

export function getElasticChartsTheme(
  heatmapBorderColor: string,
  isDarkMode: boolean
): ChartsTheme {
  return {
    baseTheme: isDarkMode ? DARK_THEME : LIGHT_THEME,
    theme: {
      background: {
        color: 'transparent',
      },
      colors: {
        vizColors: KIBANA_PALETTE,
        defaultVizColor: KIBANA_PALETTE[0],
      },
      heatmap: {
        grid: {
          stroke: { width: 1, color: heatmapBorderColor },
        },
        cell: {
          border: { stroke: heatmapBorderColor, strokeWidth: 1 },
        },
      },
    },
  };
}

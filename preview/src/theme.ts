/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PartialTheme, Theme } from '@elastic/charts';
import { getChartsTheme } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

/**
 * The Kibana color-blind palette. Retained as a named export so callers that
 * accept explicit user-supplied palette arrays (e.g. `create_chart`) can still
 * reference it as a fallback. It is no longer the default series color.
 */
export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

export interface ChartsTheme {
  baseTheme: Theme;
  theme: PartialTheme;
}

export interface ChartsThemeOptions {
  /** Resolved value of --dash-chart-series-1 */
  seriesColor: string;
  /** Resolved value of --dash-gridline */
  gridlineColor: string;
  /** Resolved value of --dash-muted */
  axisColor: string;
  /** Resolved value of --dash-fg */
  labelColor: string;
  isDarkMode: boolean;
}

/**
 * Recursively prepends the Elastic UI Numeric font to every `fontFamily` found
 * in the theme tree. This mirrors Kibana's `applyNumericFontFamily` helper so
 * that *any* new fontFamily property added by `@elastic/charts` is picked up
 * automatically instead of requiring a manual update.
 *
 * @see https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/charts/public/services/theme/helpers.ts
 */
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

/**
 * Builds the Elastic Charts theme using Cursor-native `--dash-*` token values.
 *
 * The Borealis base theme is retained for its animation, font mechanics, and
 * legend layout defaults, but every color property is overridden via the
 * `theme` partial so Borealis has no visual authority over the rendered output.
 */
export function getElasticChartsTheme({
  seriesColor,
  gridlineColor,
  axisColor,
  isDarkMode,
}: ChartsThemeOptions): ChartsTheme {
  const colorMode = isDarkMode ? 'DARK' : 'LIGHT';
  // Deep-clone before mutating: the Borealis light theme returns frozen objects
  // that throw TypeError on direct property assignment.
  const baseTheme = JSON.parse(JSON.stringify(getChartsTheme('borealis', colorMode)));

  applyNumericFontFamily(baseTheme);

  return {
    baseTheme,
    theme: {
      background: { color: 'transparent' },
      colors: {
        vizColors: [seriesColor],
        defaultVizColor: seriesColor,
      },
      axes: {
        gridLine: {
          horizontal: { stroke: gridlineColor, strokeWidth: 1, opacity: 1 },
          vertical: { stroke: gridlineColor, strokeWidth: 1, opacity: 1 },
        },
        tickLabel: {
          fill: axisColor,
        },
        axisTitle: {
          fill: axisColor,
          fontWeight: 500,
        },
        axisPanelTitle: {
          fill: axisColor,
          fontWeight: 500,
        },
      },
      heatmap: {
        cell: {
          border: { stroke: gridlineColor, strokeWidth: 1 },
        },
        grid: {
          stroke: { width: 1, color: gridlineColor },
        },
      },
    },
  };
}

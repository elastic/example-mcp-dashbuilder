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

export interface ElasticChartsThemeOptions {
  heatmapBorderColor: string;
  isDarkMode: boolean;
  backgroundColor?: string;
  panelBackgroundColor?: string;
  textColor?: string;
  subduedTextColor?: string;
  accentColor?: string;
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

export function getElasticChartsTheme({
  heatmapBorderColor,
  isDarkMode,
  backgroundColor,
  panelBackgroundColor,
  textColor,
  subduedTextColor,
  accentColor,
}: ElasticChartsThemeOptions): ChartsTheme {
  const colorMode = isDarkMode ? 'DARK' : 'LIGHT';
  const baseTheme = getChartsTheme('borealis', colorMode);

  applyNumericFontFamily(baseTheme);

  const resolvedBackgroundColor = backgroundColor ?? baseTheme.background.color;
  const resolvedPanelBackgroundColor = panelBackgroundColor ?? resolvedBackgroundColor;
  const resolvedTextColor = textColor ?? baseTheme.axes.axisTitle.fill;
  const resolvedSubduedTextColor = subduedTextColor ?? baseTheme.axes.tickLabel.fill;
  const resolvedAccentColor = accentColor ?? baseTheme.crosshair.line.stroke;

  baseTheme.background.color = resolvedPanelBackgroundColor;
  baseTheme.background.fallbackColor = resolvedPanelBackgroundColor;
  baseTheme.axes.tickLabel.fill = resolvedSubduedTextColor;
  baseTheme.axes.axisTitle.fill = resolvedTextColor;
  baseTheme.axes.axisTitle.fontWeight = 500;
  baseTheme.axes.axisPanelTitle.fill = resolvedTextColor;
  baseTheme.axes.axisPanelTitle.fontWeight = 500;
  baseTheme.axes.axisLine.stroke = heatmapBorderColor;
  baseTheme.axes.tickLine.stroke = heatmapBorderColor;
  baseTheme.axes.gridLine.horizontal.stroke = heatmapBorderColor;
  baseTheme.axes.gridLine.vertical.stroke = heatmapBorderColor;
  baseTheme.crosshair.line.stroke = resolvedAccentColor;
  baseTheme.crosshair.crossLine.stroke = resolvedAccentColor;
  baseTheme.lineSeriesStyle.point.fill = resolvedPanelBackgroundColor;
  if ('fill' in baseTheme.lineSeriesStyle.point.dimmed) {
    baseTheme.lineSeriesStyle.point.dimmed.fill = resolvedPanelBackgroundColor;
  }
  baseTheme.partition.linkLabel.textColor = resolvedTextColor;
  baseTheme.partition.sectorLineStroke = resolvedPanelBackgroundColor;
  baseTheme.metric.border = heatmapBorderColor;
  baseTheme.metric.barBackground = resolvedBackgroundColor;
  baseTheme.metric.textLightColor = resolvedTextColor;
  baseTheme.metric.textSubtitleLightColor = resolvedSubduedTextColor;
  baseTheme.metric.textExtraLightColor = resolvedSubduedTextColor;
  baseTheme.metric.textDarkColor = resolvedTextColor;
  baseTheme.metric.textSubtitleDarkColor = resolvedSubduedTextColor;
  baseTheme.metric.textExtraDarkColor = resolvedSubduedTextColor;

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

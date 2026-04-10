/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PanelConfig } from '../types.js';

export interface ChartPreviewData {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/** Previews keyed by chart ID so each iframe can retrieve its own chart. */
const previews = new Map<string, ChartPreviewData>();

export function setChartPreview(preview: ChartPreviewData): void {
  previews.set(preview.chart.id, preview);
}

/** Get chart preview by ID, or the most recent one if no ID given. */
export function getChartPreview(chartId?: string): ChartPreviewData | null {
  if (chartId) {
    return previews.get(chartId) ?? null;
  }
  // Fall back to most recent entry
  let last: ChartPreviewData | null = null;
  for (const v of previews.values()) {
    last = v;
  }
  return last;
}

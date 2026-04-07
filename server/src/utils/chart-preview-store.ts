import type { PanelConfig } from '../types.js';

interface ChartPreviewData {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

let lastPreview: ChartPreviewData | null = null;

export function setChartPreview(preview: ChartPreviewData): void {
  lastPreview = preview;
}

/** Get and consume the last chart preview (returns null on subsequent calls). */
export function getLastChartPreview(): ChartPreviewData | null {
  const preview = lastPreview;
  lastPreview = null;
  return preview;
}

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

/** Get the last chart preview. Kept until replaced by a new one so retries and reconnects still receive the data. */
export function getLastChartPreview(): ChartPreviewData | null {
  return lastPreview;
}

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Translates internal PanelConfig → Kibana Dashboard API format (9.4+).
 *
 * The Dashboard API uses a simplified schema where visualization config
 * lives directly inside `panel.config` with `data_source.type: "esql"`.
 * No Lens attributes needed — Kibana handles that server-side.
 *
 * Reference: kibana-dashboards skill chart-types-reference.md
 */

import { randomUUID } from 'crypto';
import type {
  DashboardConfig,
  PanelConfig,
  ChartConfig,
  MetricConfig,
  HeatmapConfig,
} from '../types.js';

// ---------------------------------------------------------------------------
// Dashboard API types
// ---------------------------------------------------------------------------

export interface DashboardApiPanel {
  type: string;
  id: string;
  grid: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}

export interface DashboardApiPayload {
  title: string;
  panels: DashboardApiPanel[];
  time_range?: { from: string; to: string };
  description?: string;
}

// ---------------------------------------------------------------------------
// Grid constants (shared with dashboard-translator.ts)
// ---------------------------------------------------------------------------

const HALF_WIDTH = 24;
const THREE_QUARTER_WIDTH = 36;
const QUARTER_WIDTH = 12;
const DEFAULT_HEIGHT = 15;
const METRIC_HEIGHT = 10;
const GRID_COLUMN_COUNT = 48;

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  bar: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  line: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  area: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  pie: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  metric: { w: QUARTER_WIDTH, h: METRIC_HEIGHT },
  heatmap: { w: THREE_QUARTER_WIDTH, h: DEFAULT_HEIGHT },
};

// ---------------------------------------------------------------------------
// Chart type mapping helpers
// ---------------------------------------------------------------------------

/** Map internal chartType to Dashboard API XY layer type. */
const XY_LAYER_TYPE: Record<string, string> = {
  bar: 'bar',
  line: 'line',
  area: 'area',
};

function isChartConfig(panel: PanelConfig): panel is ChartConfig {
  return ['bar', 'line', 'area', 'pie'].includes(panel.chartType);
}

function isMetricConfig(panel: PanelConfig): panel is MetricConfig {
  return panel.chartType === 'metric';
}

function isHeatmapConfig(panel: PanelConfig): panel is HeatmapConfig {
  return panel.chartType === 'heatmap';
}

// ---------------------------------------------------------------------------
// Panel translators
// ---------------------------------------------------------------------------

function makeEsqlDataSource(query: string) {
  return { type: 'esql', query };
}

/**
 * Translate a bar/line/area chart to a Dashboard API `vis` panel config.
 */
export function translateXYPanel(chart: ChartConfig): Record<string, unknown> {
  const layerType = XY_LAYER_TYPE[chart.chartType] ?? 'bar';

  const layer: Record<string, unknown> = {
    type: layerType,
    data_source: makeEsqlDataSource(chart.esqlQuery),
    x: { column: chart.xField },
    y: chart.yFields.map((col) => ({ column: col })),
  };

  if (chart.splitField) {
    layer.breakdown_by = { column: chart.splitField };
  }

  return {
    type: 'xy',
    layers: [layer],
  };
}

/**
 * Translate a pie chart to a Dashboard API `vis` panel config.
 */
export function translatePiePanel(chart: ChartConfig): Record<string, unknown> {
  return {
    type: 'pie',
    data_source: makeEsqlDataSource(chart.esqlQuery),
    metrics: chart.yFields.map((col) => ({ column: col })),
    group_by: [{ column: chart.xField }],
  };
}

/**
 * Translate a metric to a Dashboard API `vis` panel config.
 */
export function translateMetricPanel(metric: MetricConfig): Record<string, unknown> {
  return {
    type: 'metric',
    data_source: makeEsqlDataSource(metric.esqlQuery),
    metrics: [
      {
        type: 'primary',
        column: metric.valueField,
        ...(metric.title ? { label: metric.title } : {}),
      },
    ],
  };
}

/**
 * Translate a heatmap to a Dashboard API `vis` panel config.
 */
export function translateHeatmapPanel(heatmap: HeatmapConfig): Record<string, unknown> {
  return {
    type: 'heatmap',
    data_source: makeEsqlDataSource(heatmap.esqlQuery),
    x: { column: heatmap.xField },
    y: { column: heatmap.yField },
    metric: { column: heatmap.valueField },
  };
}

/**
 * Translate any PanelConfig to a Dashboard API panel config object.
 * Returns the `config` portion of the panel (to be wrapped with type/id/grid).
 */
export function translatePanelConfig(panel: PanelConfig): Record<string, unknown> {
  if (isMetricConfig(panel)) {
    return translateMetricPanel(panel);
  }
  if (isHeatmapConfig(panel)) {
    return translateHeatmapPanel(panel);
  }
  if (isChartConfig(panel)) {
    if (panel.chartType === 'pie') {
      return translatePiePanel(panel);
    }
    return translateXYPanel(panel);
  }
  // Fallback — shouldn't happen with current types
  return {};
}

// ---------------------------------------------------------------------------
// Grid layout (auto-placement)
// ---------------------------------------------------------------------------

function buildBalancedRowWidths(panelCount: number, columnCount: number): number[] {
  const baseWidth = Math.floor(columnCount / panelCount);
  const remainder = columnCount % panelCount;
  return Array.from({ length: panelCount }, (_, i) => baseWidth + (i < remainder ? 1 : 0));
}

interface GridPlacement {
  panel: PanelConfig;
  grid: { x: number; y: number; w: number; h: number };
}

/**
 * Auto-place panels into rows, returning grid positions.
 */
function autoPlacePanels(charts: PanelConfig[], startRow = 0): GridPlacement[] {
  const placements: GridPlacement[] = [];
  let nextRow = startRow;
  let rowPanels: Array<{ panel: PanelConfig; h: number }> = [];
  let widthInRow = 0;

  const commitRow = () => {
    if (rowPanels.length === 0) return;
    const widths = buildBalancedRowWidths(rowPanels.length, GRID_COLUMN_COUNT);
    let col = 0;
    let maxH = 0;
    for (const [i, rp] of rowPanels.entries()) {
      placements.push({ panel: rp.panel, grid: { x: col, y: nextRow, w: widths[i], h: rp.h } });
      col += widths[i];
      maxH = Math.max(maxH, rp.h);
    }
    nextRow += maxH;
    rowPanels = [];
    widthInRow = 0;
  };

  for (const panel of charts) {
    const size = DEFAULT_SIZES[panel.chartType] || DEFAULT_SIZES.bar;
    if (rowPanels.length > 0 && widthInRow + size.w > GRID_COLUMN_COUNT) {
      commitRow();
    }
    rowPanels.push({ panel, h: size.h });
    widthInRow += size.w;
    if (widthInRow >= GRID_COLUMN_COUNT) {
      commitRow();
    }
  }
  commitRow();

  return placements;
}

// ---------------------------------------------------------------------------
// Full dashboard translator
// ---------------------------------------------------------------------------

/**
 * Translate a DashboardConfig into the Kibana Dashboard API request body.
 *
 * Uses gridLayout positions if available (user has dragged/resized),
 * otherwise auto-places panels.
 */
export function translateDashboardToApiPayload(config: DashboardConfig): DashboardApiPayload {
  const panels: DashboardApiPanel[] = [];
  const gridLayout = config.gridLayout;

  if (gridLayout) {
    // Use positions from user's drag/resize in the preview app
    for (const chart of config.charts) {
      const widget = gridLayout[chart.id];
      if (widget && widget.type === 'panel') {
        panels.push({
          type: 'vis',
          id: randomUUID(),
          grid: { x: widget.column, y: widget.row, w: widget.width, h: widget.height },
          config: translatePanelConfig(chart),
        });
      }
    }
  } else {
    // Auto-place
    const placements = autoPlacePanels(config.charts);
    for (const { panel, grid } of placements) {
      panels.push({
        type: 'vis',
        id: randomUUID(),
        grid,
        config: translatePanelConfig(panel),
      });
    }
  }

  return {
    title: config.title,
    panels,
    description: `Exported from MCP Dashboard App on ${new Date().toLocaleDateString()}`,
  };
}

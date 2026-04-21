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
import { autoPlacePanels as autoPlacePanelsGeneric } from 'mcp-dashboards-shared';
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

export interface DashboardApiSection {
  title: string;
  collapsed: boolean;
  grid: { y: number };
  panels: DashboardApiPanel[];
}

export interface DashboardApiPayload {
  title: string;
  panels: (DashboardApiPanel | DashboardApiSection)[];
  time_range?: { from: string; to: string };
  description?: string;
}

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
export function translatePanelConfig(panel: PanelConfig): Record<string, unknown> | null {
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
  // Should be unreachable with current types
  return null;
}

// ---------------------------------------------------------------------------
// Grid layout (auto-placement)
// ---------------------------------------------------------------------------

interface GridPlacement {
  panel: PanelConfig;
  grid: { x: number; y: number; w: number; h: number };
}

/**
 * Auto-place panels into rows, returning grid positions.
 */
function autoPlacePanels(charts: PanelConfig[], startRow = 0): GridPlacement[] {
  const chartMap = new Map(charts.map((c) => [c.id, c]));
  const { placements } = autoPlacePanelsGeneric(charts, startRow);
  return placements.map((p) => ({
    panel: chartMap.get(p.id)!,
    grid: { x: p.x, y: p.y, w: p.w, h: p.h },
  }));
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
  const topLevelPanels: (DashboardApiPanel | DashboardApiSection)[] = [];
  const gridLayout = config.gridLayout;
  const sections = config.sections || [];

  // Build a set of panel IDs that belong to sections so we can exclude them from top-level
  const sectionPanelIds = new Set<string>();
  for (const section of sections) {
    for (const pid of section.panelIds) {
      sectionPanelIds.add(pid);
    }
  }

  // Build a lookup of charts by id
  const chartById = new Map<string, PanelConfig>();
  for (const chart of config.charts) {
    chartById.set(chart.id, chart);
  }

  // Helper: translate a chart to an API panel using grid layout or auto-placement grid
  function makeApiPanel(
    chart: PanelConfig,
    grid: { x: number; y: number; w: number; h: number }
  ): DashboardApiPanel | null {
    const config = translatePanelConfig(chart);
    if (!config) {
      console.warn(`Skipping unsupported panel type for chart: ${chart.id}`);
      return null;
    }
    return {
      type: 'vis',
      id: randomUUID(),
      grid,
      config,
    };
  }

  function pushPanel(
    arr: (DashboardApiPanel | DashboardApiSection)[],
    panel: DashboardApiPanel | null
  ) {
    if (panel) arr.push(panel);
  }

  if (gridLayout) {
    // Top-level panels (not in any section)
    const unpositionedTopCharts: PanelConfig[] = [];
    for (const chart of config.charts) {
      if (sectionPanelIds.has(chart.id)) continue;
      const widget = gridLayout[chart.id];
      if (widget && widget.type === 'panel') {
        pushPanel(
          topLevelPanels,
          makeApiPanel(chart, {
            x: widget.column,
            y: widget.row,
            w: widget.width,
            h: widget.height,
          })
        );
      } else {
        unpositionedTopCharts.push(chart);
      }
    }

    // Auto-place top-level charts that have no gridLayout entry
    if (unpositionedTopCharts.length > 0) {
      const maxY = topLevelPanels.reduce((max, p) => {
        if ('grid' in p && 'h' in p.grid && 'y' in p.grid) {
          return Math.max(max, (p.grid.y ?? 0) + (p.grid.h ?? 0));
        }
        return max;
      }, 0);
      const placements = autoPlacePanels(unpositionedTopCharts, maxY);
      for (const { panel, grid } of placements) {
        pushPanel(topLevelPanels, makeApiPanel(panel, grid));
      }
    }

    // Sections with their nested panels
    for (const section of sections) {
      const sectionWidget = gridLayout[section.id];
      const sectionRow = sectionWidget && sectionWidget.type === 'section' ? sectionWidget.row : 0;

      const sectionCharts = section.panelIds
        .map((pid) => chartById.get(pid))
        .filter((c): c is PanelConfig => c != null);

      const nestedPanels: DashboardApiPanel[] = [];
      const unpositionedSectionCharts: PanelConfig[] = [];
      for (const chart of sectionCharts) {
        const widget = gridLayout[chart.id];
        if (widget && widget.type === 'panel') {
          pushPanel(
            nestedPanels,
            makeApiPanel(chart, {
              x: widget.column,
              y: widget.row,
              w: widget.width,
              h: widget.height,
            })
          );
        } else {
          unpositionedSectionCharts.push(chart);
        }
      }

      // Also handle section-level panel positions stored inside GridSection.panels
      if (
        nestedPanels.length === 0 &&
        sectionWidget &&
        sectionWidget.type === 'section' &&
        sectionWidget.panels
      ) {
        for (const chart of sectionCharts) {
          const pos = sectionWidget.panels[chart.id];
          if (pos) {
            pushPanel(
              nestedPanels,
              makeApiPanel(chart, { x: pos.column, y: pos.row, w: pos.width, h: pos.height })
            );
          }
        }
      }

      // Auto-place any section charts that had no grid position
      if (unpositionedSectionCharts.length > 0) {
        const maxY = nestedPanels.reduce(
          (max, p) => Math.max(max, (p.grid.y ?? 0) + (p.grid.h ?? 0)),
          0
        );
        const placements = autoPlacePanels(unpositionedSectionCharts, maxY);
        for (const { panel, grid } of placements) {
          pushPanel(nestedPanels, makeApiPanel(panel, grid));
        }
      }

      topLevelPanels.push({
        title: section.title,
        collapsed: section.collapsed,
        grid: { y: sectionRow },
        panels: nestedPanels,
      });
    }
  } else {
    // Auto-place: top-level charts first
    const topCharts = config.charts.filter((c) => !sectionPanelIds.has(c.id));
    const placements = autoPlacePanels(topCharts);
    for (const { panel, grid } of placements) {
      pushPanel(topLevelPanels, makeApiPanel(panel, grid));
    }

    // Then sections
    let nextRow =
      placements.length > 0 ? Math.max(...placements.map((p) => p.grid.y + p.grid.h)) : 0;

    for (const section of sections) {
      const sectionCharts = section.panelIds
        .map((pid) => chartById.get(pid))
        .filter((c): c is PanelConfig => c != null);

      const sectionPlacements = autoPlacePanels(sectionCharts, 0);
      const nestedPanels: DashboardApiPanel[] = [];
      for (const { panel, grid } of sectionPlacements) {
        pushPanel(nestedPanels, makeApiPanel(panel, grid));
      }

      topLevelPanels.push({
        title: section.title,
        collapsed: section.collapsed,
        grid: { y: nextRow },
        panels: nestedPanels,
      });
      nextRow++;
    }
  }

  return {
    title: config.title,
    panels: topLevelPanels,
    ...(config.timeRange ? { time_range: config.timeRange } : {}),
    description: `Exported from MCP Dashboard App on ${new Date().toLocaleDateString()}`,
  };
}

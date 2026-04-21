/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Reverse translator: Kibana Dashboard API (9.4+) response → internal PanelConfig.
 *
 * The Dashboard API GET response returns panels with a simplified config that
 * maps almost 1:1 to our internal model — no Lens attribute decoding needed.
 */

import type { PanelConfig, ChartConfig, MetricConfig, HeatmapConfig, ChartType } from '../types.js';

// ---------------------------------------------------------------------------
// Dashboard API response types (from GET /api/dashboards/:id)
// ---------------------------------------------------------------------------

export interface DashboardApiResponse {
  id: string;
  data: {
    title: string;
    panels: Array<DashboardApiPanelResponse | DashboardApiSectionResponse>;
    time_range?: { from: string; to: string };
  };
  meta?: Record<string, unknown>;
}

export interface DashboardApiPanelResponse {
  type: string;
  id: string;
  grid: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}

export interface DashboardApiSectionResponse {
  title: string;
  collapsed: boolean;
  grid: { y: number };
  panels: DashboardApiPanelResponse[];
  id?: string;
}

/**
 * Type guard: returns `true` when the entry is a section (has nested `panels`).
 */
export function isDashboardApiSection(
  entry: DashboardApiPanelResponse | DashboardApiSectionResponse
): entry is DashboardApiSectionResponse {
  return 'panels' in entry && Array.isArray((entry as DashboardApiSectionResponse).panels);
}

// ---------------------------------------------------------------------------
// Column reference helpers
// ---------------------------------------------------------------------------

interface ColumnRef {
  column: string;
  label?: string;
}

function getColumn(ref: unknown): string {
  if (ref && typeof ref === 'object' && 'column' in ref) {
    return String((ref as ColumnRef).column);
  }
  return '';
}

function getEsqlQuery(config: Record<string, unknown>): string | null {
  // Top-level data_source (metric, pie, heatmap, tag_cloud, etc.)
  const ds = config.data_source as { type?: string; query?: string } | undefined;
  if (ds?.type === 'esql' && ds.query) return ds.query;

  // XY: data_source inside layers
  const layers = config.layers as Array<Record<string, unknown>> | undefined;
  if (layers?.[0]) {
    const layerDs = layers[0].data_source as { type?: string; query?: string } | undefined;
    if (layerDs?.type === 'esql' && layerDs.query) return layerDs.query;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Per-type reverse translators
// ---------------------------------------------------------------------------

function reverseXY(
  config: Record<string, unknown>,
  panelId: string,
  title: string
): ChartConfig | null {
  const layers = config.layers as Array<Record<string, unknown>> | undefined;
  const layer = layers?.[0];
  if (!layer) return null;

  const esqlQuery = getEsqlQuery(config);
  if (!esqlQuery) return null;

  const layerType = (layer.type as string) || 'bar';
  const chartType: ChartType = layerType.startsWith('line')
    ? 'line'
    : layerType.startsWith('area')
      ? 'area'
      : 'bar';

  const xField = getColumn(layer.x);
  const yRefs = (layer.y as unknown[]) || [];
  const yFields = yRefs.map((ref) => getColumn(ref)).filter(Boolean);
  const splitField = layer.breakdown_by ? getColumn(layer.breakdown_by) : undefined;

  return {
    id: panelId,
    title,
    chartType,
    esqlQuery,
    xField,
    yFields,
    ...(splitField ? { splitField } : {}),
  };
}

function reversePie(
  config: Record<string, unknown>,
  panelId: string,
  title: string
): ChartConfig | null {
  const esqlQuery = getEsqlQuery(config);
  if (!esqlQuery) return null;

  const metrics = (config.metrics as unknown[]) || [];
  const groupBy = (config.group_by as unknown[]) || [];

  const yFields = metrics.map((ref) => getColumn(ref)).filter(Boolean);
  const xField = groupBy.length > 0 ? getColumn(groupBy[0]) : '';

  return {
    id: panelId,
    title,
    chartType: 'pie',
    esqlQuery,
    xField,
    yFields,
  };
}

function reverseMetric(
  config: Record<string, unknown>,
  panelId: string,
  title: string
): MetricConfig | null {
  const esqlQuery = getEsqlQuery(config);
  if (!esqlQuery) return null;

  const metrics = (config.metrics as Array<Record<string, unknown>>) || [];
  const primary = metrics.find((m) => m.type === 'primary');
  const valueField = primary ? getColumn(primary) : '';

  const subtitle = primary?.subtitle as string | undefined;

  // Color can be { type: 'static', color: '#hex' } or other shapes
  let color: string | undefined;
  const colorObj = primary?.color as { type?: string; color?: string } | undefined;
  if (colorObj?.type === 'static' && colorObj.color) {
    color = colorObj.color;
  }

  return {
    id: panelId,
    title,
    chartType: 'metric',
    esqlQuery,
    valueField,
    ...(subtitle ? { subtitle } : {}),
    ...(color ? { color } : {}),
  };
}

function reverseHeatmap(
  config: Record<string, unknown>,
  panelId: string,
  title: string
): HeatmapConfig | null {
  const esqlQuery = getEsqlQuery(config);
  if (!esqlQuery) return null;

  return {
    id: panelId,
    title,
    chartType: 'heatmap',
    esqlQuery,
    xField: getColumn(config.x),
    yField: getColumn(config.y),
    valueField: getColumn(config.metric),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Translate a Dashboard API panel into an internal PanelConfig.
 * Returns `{ config }` on success or `{ skip: reason }` if unsupported.
 */
export function translateDashboardApiPanel(
  panel: DashboardApiPanelResponse,
  panelId: string,
  title?: string
): { config: PanelConfig } | { skip: string } {
  const config = panel.config;
  const vizType = config.type as string | undefined;
  const panelTitle = title || (config.title as string) || panelId;

  if (panel.type !== 'vis' || !vizType) {
    return { skip: `Unsupported panel type: ${panel.type}` };
  }

  const esqlQuery = getEsqlQuery(config);
  if (!esqlQuery) {
    return { skip: `No ES|QL data source found in panel "${panelTitle}"` };
  }

  let result: PanelConfig | null = null;

  switch (vizType) {
    case 'xy':
      result = reverseXY(config, panelId, panelTitle);
      break;
    case 'pie':
    case 'treemap':
    case 'waffle':
    case 'mosaic':
      result = reversePie(config, panelId, panelTitle);
      break;
    case 'metric':
      result = reverseMetric(config, panelId, panelTitle);
      break;
    case 'heatmap':
      result = reverseHeatmap(config, panelId, panelTitle);
      break;
    default:
      return { skip: `Unsupported visualization type: ${vizType}` };
  }

  if (!result) {
    return { skip: `Failed to translate ${vizType} panel "${panelTitle}"` };
  }

  return { config: result };
}

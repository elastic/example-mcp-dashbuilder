/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { randomUUID, createHash } from 'crypto';
import type { PanelConfig, ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

export interface TimeFieldContext {
  indexPattern: string;
  timeField: string;
}

/** Generate a deterministic ID for an ad-hoc data view (same approach as Kibana). */
function dataViewId(indexPattern: string): string {
  return createHash('sha256').update(indexPattern).digest('hex');
}

/**
 * Generate a Lens-compatible column definition from a field name.
 */
function makeColumn(columnId: string, fieldName: string, meta?: { type: string }) {
  return {
    columnId,
    fieldName,
    meta: meta ?? { type: 'number' },
  };
}

/**
 * Build the textBased datasource state for an ES|QL query with given columns.
 */
function buildTextBasedDatasource(
  layerId: string,
  esqlQuery: string,
  columns: Array<{ columnId: string; fieldName: string; meta?: { type: string } }>,
  ctx?: TimeFieldContext
) {
  const dvId = ctx ? dataViewId(ctx.indexPattern) : '';

  return {
    layers: {
      [layerId]: {
        index: dvId,
        query: { esql: esqlQuery },
        columns: columns.map((col) => makeColumn(col.columnId, col.fieldName, col.meta)),
        ...(ctx ? { timeField: ctx.timeField } : {}),
      },
    },
    ...(ctx
      ? {
          indexPatternRefs: [
            {
              id: dvId,
              title: ctx.indexPattern,
              timeField: ctx.timeField,
            },
          ],
        }
      : {}),
  };
}

/**
 * Translate a bar/line/area chart config to a Lens XY visualization.
 */
function translateXY(config: ChartConfig, layerId: string, ctx?: TimeFieldContext) {
  const xColumnId = randomUUID();
  const yColumnIds = config.yFields.map(() => randomUUID());
  const splitColumnId = config.splitField ? randomUUID() : undefined;

  const columns: Array<{ columnId: string; fieldName: string; meta?: { type: string } }> = [
    { columnId: xColumnId, fieldName: config.xField, meta: { type: 'string' } },
    ...config.yFields.map((field, i) => ({
      columnId: yColumnIds[i],
      fieldName: field,
      meta: { type: 'number' },
    })),
  ];

  if (config.splitField && splitColumnId) {
    columns.push({
      columnId: splitColumnId,
      fieldName: config.splitField,
      meta: { type: 'string' },
    });
  }

  const seriesType =
    config.chartType === 'area' ? 'area' : config.chartType === 'line' ? 'line' : 'bar';

  const layer: Record<string, unknown> = {
    layerId,
    accessors: yColumnIds,
    layerType: 'data',
    seriesType,
    xAccessor: xColumnId,
    ...(splitColumnId ? { splitAccessors: [splitColumnId] } : {}),
  };

  // Apply custom palette as per-series colors
  if (config.palette && config.palette.length > 0) {
    layer.yConfig = yColumnIds.map((colId, i) => ({
      forAccessor: colId,
      color: config.palette![i % config.palette!.length],
    }));
  }

  const visualization = {
    preferredSeriesType: seriesType,
    legend: { isVisible: true, position: 'right' },
    layers: [layer],
  };

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns, ctx),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsXY' };
}

/**
 * Translate a pie chart config to a Lens Partition visualization.
 */
function translatePie(config: ChartConfig, layerId: string, ctx?: TimeFieldContext) {
  const groupColumnId = randomUUID();
  const metricColumnId = randomUUID();

  const columns = [
    { columnId: groupColumnId, fieldName: config.xField, meta: { type: 'string' } },
    { columnId: metricColumnId, fieldName: config.yFields[0], meta: { type: 'number' } },
  ];

  const layer: Record<string, unknown> = {
    layerId,
    layerType: 'data',
    primaryGroups: [groupColumnId],
    metrics: [metricColumnId],
    numberDisplay: 'percent',
    categoryDisplay: 'default',
    legendDisplay: 'default',
  };

  const visualization: Record<string, unknown> = {
    shape: 'pie',
    layers: [layer],
  };

  // Apply custom palette (positional, value-agnostic)
  if (config.palette && config.palette.length > 0) {
    visualization.palette = {
      type: 'palette',
      name: 'custom',
      params: {
        colors: config.palette,
        gradient: false,
        reverse: false,
      },
    };
  }

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns, ctx),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsPie' };
}

/**
 * Translate a metric config to a Lens Metric visualization.
 */
function translateMetric(config: MetricConfig, layerId: string, ctx?: TimeFieldContext) {
  const metricColumnId = randomUUID();

  // Find the value field name from the ES|QL query
  // The metric config stores the value directly, but we need the field name for Lens
  // Extract it from the esqlQuery STATS clause
  const valueFieldMatch = config.esqlQuery.match(/STATS\s+(\w+)\s*=/i);
  const valueFieldName = valueFieldMatch ? valueFieldMatch[1] : 'value';

  const columns = [
    { columnId: metricColumnId, fieldName: valueFieldName, meta: { type: 'number' } },
  ];

  const visualization: Record<string, unknown> = {
    layerId,
    layerType: 'data',
    metricAccessor: metricColumnId,
  };

  if (config.subtitle) {
    visualization.subtitle = config.subtitle;
  }

  if (config.color) {
    visualization.color = config.color;
  }

  // Handle trend line if present
  let trendLayerId: string | undefined;
  if (config.trendEsqlQuery) {
    trendLayerId = randomUUID();
    const trendTimeColumnId = randomUUID();
    const trendValueColumnId = randomUUID();

    visualization.trendlineLayerId = trendLayerId;
    visualization.trendlineLayerType = 'data';
    visualization.trendlineTimeAccessor = trendTimeColumnId;
    visualization.trendlineMetricAccessor = trendValueColumnId;
  }

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns, ctx),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsMetric' };
}

/**
 * Translate a heatmap config to a Lens Heatmap visualization.
 */
function translateHeatmap(config: HeatmapConfig, layerId: string, ctx?: TimeFieldContext) {
  const xColumnId = randomUUID();
  const yColumnId = randomUUID();
  const valueColumnId = randomUUID();

  const columns = [
    { columnId: xColumnId, fieldName: config.xField, meta: { type: 'string' } },
    { columnId: yColumnId, fieldName: config.yField, meta: { type: 'string' } },
    { columnId: valueColumnId, fieldName: config.valueField, meta: { type: 'number' } },
  ];

  const visualization: Record<string, unknown> = {
    layerId,
    layerType: 'data',
    shape: 'heatmap',
    xAccessor: xColumnId,
    yAccessor: yColumnId,
    valueAccessor: valueColumnId,
    legend: {
      isVisible: true,
      position: 'right',
      type: 'heatmap_legend',
    },
    gridConfig: {
      type: 'heatmap_grid',
      isCellLabelVisible: false,
      isYAxisLabelVisible: true,
      isXAxisLabelVisible: true,
      isYAxisTitleVisible: true,
      isXAxisTitleVisible: true,
    },
  };

  if (config.colorRamp && config.colorRamp.length >= 2) {
    const steps = config.colorRamp.length;
    const stepSize = 100 / steps;
    visualization.palette = {
      name: 'custom',
      type: 'palette',
      params: {
        steps,
        continuity: 'above',
        name: 'custom',
        rangeMin: 0,
        rangeMax: null,
        colorStops: config.colorRamp.map((color, i) => ({
          color,
          stop: Math.round(stepSize * i),
        })),
        stops: config.colorRamp.map((color, i) => ({
          color,
          stop: Math.round(stepSize * (i + 1)),
        })),
      },
      accessor: valueColumnId,
    };
  }

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns, ctx),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsHeatmap' };
}

/**
 * Translate a panel config to a Lens attributes object (by-value).
 */
export function translatePanelToLens(
  panel: PanelConfig,
  ctx?: TimeFieldContext
): {
  visualizationType: string;
  attributes: Record<string, unknown>;
} {
  const layerId = randomUUID();

  let result: {
    visualization: unknown;
    datasourceStates: unknown;
    visualizationType: string;
  };

  switch (panel.chartType) {
    case 'bar':
    case 'line':
    case 'area':
      result = translateXY(panel as ChartConfig, layerId, ctx);
      break;
    case 'pie':
      result = translatePie(panel as ChartConfig, layerId, ctx);
      break;
    case 'metric':
      result = translateMetric(panel as MetricConfig, layerId, ctx);
      break;
    case 'heatmap':
      result = translateHeatmap(panel as HeatmapConfig, layerId, ctx);
      break;
    default:
      throw new Error(`Unsupported chart type: ${(panel as PanelConfig).chartType}`);
  }

  const esqlQuery = 'esqlQuery' in panel ? panel.esqlQuery : '';

  // Build ad-hoc data view so Kibana knows the time field
  const adHocDataViews: Record<string, unknown> = {};
  if (ctx) {
    const dvId = dataViewId(ctx.indexPattern);
    adHocDataViews[dvId] = {
      id: dvId,
      title: ctx.indexPattern,
      timeFieldName: ctx.timeField,
      sourceFilters: [],
      type: 'esql',
      fieldFormats: {},
      runtimeFieldMap: {},
      allowNoIndex: false,
      name: ctx.indexPattern,
      allowHidden: false,
    };
  }

  return {
    visualizationType: result.visualizationType,
    attributes: {
      title: panel.title,
      visualizationType: result.visualizationType,
      state: {
        datasourceStates: result.datasourceStates,
        visualization: result.visualization,
        query: { esql: esqlQuery },
        filters: [],
      },
      references: [],
      ...(ctx ? { adHocDataViews } : {}),
    },
  };
}

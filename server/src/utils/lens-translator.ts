import { randomUUID } from 'crypto';
import type { PanelConfig, ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

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
  columns: Array<{ columnId: string; fieldName: string; meta?: { type: string } }>
) {
  return {
    layers: {
      [layerId]: {
        index: '',
        query: { esql: esqlQuery },
        columns: columns.map((col) => makeColumn(col.columnId, col.fieldName, col.meta)),
      },
    },
  };
}

/**
 * Translate a bar/line/area chart config to a Lens XY visualization.
 */
function translateXY(config: ChartConfig, layerId: string) {
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

  const seriesType = config.chartType === 'area' ? 'area' : config.chartType === 'line' ? 'line' : 'bar';

  const visualization = {
    preferredSeriesType: seriesType,
    legend: { isVisible: true, position: 'right' },
    layers: [
      {
        layerId,
        accessors: yColumnIds,
        layerType: 'data',
        seriesType,
        xAccessor: xColumnId,
        ...(splitColumnId ? { splitAccessors: [splitColumnId] } : {}),
      },
    ],
  };

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsXY' };
}

/**
 * Translate a pie chart config to a Lens Partition visualization.
 */
function translatePie(config: ChartConfig, layerId: string) {
  const groupColumnId = randomUUID();
  const metricColumnId = randomUUID();

  const columns = [
    { columnId: groupColumnId, fieldName: config.xField, meta: { type: 'string' } },
    { columnId: metricColumnId, fieldName: config.yFields[0], meta: { type: 'number' } },
  ];

  const visualization = {
    shape: 'pie',
    layers: [
      {
        layerId,
        layerType: 'data',
        primaryGroups: [groupColumnId],
        metrics: [metricColumnId],
        numberDisplay: 'percent',
        categoryDisplay: 'default',
        legendDisplay: 'default',
      },
    ],
  };

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsPie' };
}

/**
 * Translate a metric config to a Lens Metric visualization.
 */
function translateMetric(config: MetricConfig, layerId: string) {
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
  if (config.trend) {
    trendLayerId = randomUUID();
    const trendTimeColumnId = randomUUID();
    const trendValueColumnId = randomUUID();

    visualization.trendlineLayerId = trendLayerId;
    visualization.trendlineLayerType = 'data';
    visualization.trendlineTimeAccessor = trendTimeColumnId;
    visualization.trendlineMetricAccessor = trendValueColumnId;
  }

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsMetric' };
}

/**
 * Translate a heatmap config to a Lens Heatmap visualization.
 */
function translateHeatmap(config: HeatmapConfig, layerId: string) {
  const xColumnId = randomUUID();
  const yColumnId = randomUUID();
  const valueColumnId = randomUUID();

  const columns = [
    { columnId: xColumnId, fieldName: config.xField, meta: { type: 'string' } },
    { columnId: yColumnId, fieldName: config.yField, meta: { type: 'string' } },
    { columnId: valueColumnId, fieldName: config.valueField, meta: { type: 'number' } },
  ];

  const visualization = {
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

  const datasourceStates = {
    textBased: buildTextBasedDatasource(layerId, config.esqlQuery, columns),
  };

  return { visualization, datasourceStates, visualizationType: 'lnsHeatmap' };
}

/**
 * Translate a panel config to a Lens attributes object (by-value).
 */
export function translatePanelToLens(panel: PanelConfig): {
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
      result = translateXY(panel as ChartConfig, layerId);
      break;
    case 'pie':
      result = translatePie(panel as ChartConfig, layerId);
      break;
    case 'metric':
      result = translateMetric(panel as MetricConfig, layerId);
      break;
    case 'heatmap':
      result = translateHeatmap(panel as HeatmapConfig, layerId);
      break;
    default:
      throw new Error(`Unsupported chart type: ${(panel as PanelConfig).chartType}`);
  }

  const esqlQuery = 'esqlQuery' in panel ? panel.esqlQuery : '';

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
    },
  };
}

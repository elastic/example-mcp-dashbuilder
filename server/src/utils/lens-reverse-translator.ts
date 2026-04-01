import type {
  PanelConfig,
  ChartConfig,
  MetricConfig,
  HeatmapConfig,
  ChartType,
  TrendShape,
} from '../types.js';

interface LensColumn {
  columnId: string;
  fieldName: string;
  meta?: { type: string };
}

interface LensLayer {
  index?: string;
  query?: { esql: string };
  columns: LensColumn[];
  timeField?: string;
}

/** Build a columnId → fieldName map from all layers in the datasource state. */
function buildColumnMap(datasourceStates: Record<string, unknown>): {
  columnMap: Map<string, string>;
  layers: Record<string, LensLayer>;
} {
  const columnMap = new Map<string, string>();
  const textBased = datasourceStates.textBased as
    | { layers?: Record<string, LensLayer> }
    | undefined;
  const layers = textBased?.layers || {};

  for (const layer of Object.values(layers)) {
    for (const col of layer.columns || []) {
      columnMap.set(col.columnId, col.fieldName);
    }
  }

  return { columnMap, layers };
}

function resolve(columnMap: Map<string, string>, id: string | undefined): string {
  if (!id) return '';
  const fieldName = columnMap.get(id);
  if (!fieldName) {
    console.error(
      `[import] Column ID "${id}" not found in datasource columns — using ID as fallback`
    );
  }
  return fieldName || id;
}

function reverseXY(
  visualization: Record<string, unknown>,
  columnMap: Map<string, string>,
  esqlQuery: string,
  panelId: string,
  title: string
): ChartConfig {
  const layers = visualization.layers as Array<Record<string, unknown>> | undefined;
  const layer = layers?.[0] || {};

  const seriesType = (layer.seriesType as string) || 'bar';
  const chartType: ChartType =
    seriesType === 'line' ? 'line' : seriesType === 'area' ? 'area' : 'bar';

  const xField = resolve(columnMap, layer.xAccessor as string);
  const accessors = (layer.accessors as string[]) || [];
  const yFields = accessors.map((a) => resolve(columnMap, a));
  const splitAccessors = (layer.splitAccessors as string[]) || [];
  const splitField = splitAccessors.length > 0 ? resolve(columnMap, splitAccessors[0]) : undefined;

  // Extract custom colors from yConfig
  let palette: string[] | undefined;
  const yConfig = layer.yConfig as Array<{ forAccessor: string; color?: string }> | undefined;
  if (yConfig && yConfig.some((c) => c.color)) {
    palette = accessors
      .map((a) => {
        const cfg = yConfig.find((c) => c.forAccessor === a);
        return cfg?.color || '';
      })
      .filter(Boolean);
    if (palette.length === 0) palette = undefined;
  }

  return { id: panelId, title, chartType, esqlQuery, xField, yFields, splitField, palette };
}

function reversePie(
  visualization: Record<string, unknown>,
  columnMap: Map<string, string>,
  esqlQuery: string,
  panelId: string,
  title: string
): ChartConfig {
  const layers = visualization.layers as Array<Record<string, unknown>> | undefined;
  const layer = layers?.[0] || {};

  const primaryGroups = (layer.primaryGroups as string[]) || [];
  const metrics = (layer.metrics as string[]) || [];

  return {
    id: panelId,
    title,
    chartType: 'pie',
    esqlQuery,
    xField: resolve(columnMap, primaryGroups[0]),
    yFields: metrics.map((m) => resolve(columnMap, m)),
  };
}

function reverseMetric(
  visualization: Record<string, unknown>,
  columnMap: Map<string, string>,
  layers: Record<string, LensLayer>,
  esqlQuery: string,
  panelId: string,
  title: string
): MetricConfig {
  const valueField = resolve(columnMap, visualization.metricAccessor as string);

  const metric: MetricConfig = {
    id: panelId,
    title,
    chartType: 'metric',
    valueField,
    esqlQuery,
    subtitle: visualization.subtitle as string | undefined,
    color: visualization.color as string | undefined,
  };

  // Extract trend query from the trendline layer
  const trendLayerId = visualization.trendlineLayerId as string | undefined;
  if (trendLayerId && layers[trendLayerId]) {
    const trendLayer = layers[trendLayerId];
    metric.trendEsqlQuery = trendLayer.query?.esql;
    metric.trendXField = resolve(columnMap, visualization.trendlineTimeAccessor as string);
    metric.trendYField = resolve(columnMap, visualization.trendlineMetricAccessor as string);
    metric.trendShape = 'area' as TrendShape;
  }

  return metric;
}

function reverseHeatmap(
  visualization: Record<string, unknown>,
  columnMap: Map<string, string>,
  esqlQuery: string,
  panelId: string,
  title: string
): HeatmapConfig {
  const xField = resolve(columnMap, visualization.xAccessor as string);
  const yField = resolve(columnMap, visualization.yAccessor as string);
  const valueField = resolve(columnMap, visualization.valueAccessor as string);

  // Extract custom color ramp from palette
  let colorRamp: string[] | undefined;
  const palette = visualization.palette as
    | { params?: { colorStops?: Array<{ color: string }> } }
    | undefined;
  if (palette?.params?.colorStops) {
    colorRamp = palette.params.colorStops.map((s) => s.color);
  }

  return {
    id: panelId,
    title,
    chartType: 'heatmap',
    esqlQuery,
    xField,
    yField,
    valueField,
    colorRamp,
  };
}

/**
 * Reverse-translate a Kibana Lens panel into our PanelConfig format.
 * Returns null if the panel type is unsupported.
 */
export function translateLensToPanel(
  embeddableAttributes: Record<string, unknown>,
  panelId: string
): PanelConfig | null {
  const visType = embeddableAttributes.visualizationType as string;
  const title = (embeddableAttributes.title as string) || panelId;
  const state = embeddableAttributes.state as Record<string, unknown> | undefined;
  if (!state) return null;

  const esqlQuery = (state.query as { esql?: string })?.esql || '';
  if (!esqlQuery) return null;

  const datasourceStates = (state.datasourceStates as Record<string, unknown>) || {};
  if (!datasourceStates.textBased) return null; // Not an ES|QL panel

  const { columnMap, layers } = buildColumnMap(datasourceStates);
  const visualization = (state.visualization as Record<string, unknown>) || {};

  switch (visType) {
    case 'lnsXY':
      return reverseXY(visualization, columnMap, esqlQuery, panelId, title);
    case 'lnsPie':
      return reversePie(visualization, columnMap, esqlQuery, panelId, title);
    case 'lnsMetric':
      return reverseMetric(visualization, columnMap, layers, esqlQuery, panelId, title);
    case 'lnsHeatmap':
      return reverseHeatmap(visualization, columnMap, esqlQuery, panelId, title);
    default:
      return null;
  }
}

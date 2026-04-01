export interface ESQLColumn {
  name: string;
  type: string;
}

export interface ESQLResponse {
  columns: ESQLColumn[];
  values: unknown[][];
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie';

export interface ChartConfig {
  id: string;
  title: string;
  chartType: ChartType;
  esqlQuery: string;
  xField: string;
  yFields: string[];
  splitField?: string;
  palette?: string[];
}

export type TrendShape = 'area' | 'bars';

export interface MetricConfig {
  id: string;
  title: string;
  chartType: 'metric';
  subtitle?: string;
  color?: string;
  valueField: string;
  valuePrefix?: string;
  valueSuffix?: string;
  esqlQuery: string;
  trendEsqlQuery?: string;
  trendXField?: string;
  trendYField?: string;
  trendShape?: TrendShape;
}

export interface HeatmapConfig {
  id: string;
  title: string;
  chartType: 'heatmap';
  esqlQuery: string;
  xField: string;
  yField: string;
  valueField: string;
  colorRamp?: string[];
}

export type PanelConfig = ChartConfig | MetricConfig | HeatmapConfig;

export interface SectionConfig {
  id: string;
  title: string;
  collapsed: boolean;
  panelIds: string[];
}

export interface GridPanel {
  type: 'panel';
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface GridSection {
  type: 'section';
  title: string;
  isCollapsed?: boolean;
  row: number;
  panels?: Record<string, { column: number; row: number; width: number; height: number }>;
}

export type GridWidget = GridPanel | GridSection;

export interface DashboardConfig {
  title: string;
  charts: PanelConfig[];
  sections: SectionConfig[];
  /** Grid layout positions set by user drag/resize in the preview app */
  gridLayout?: Record<string, GridWidget>;
  updatedAt: string;
}

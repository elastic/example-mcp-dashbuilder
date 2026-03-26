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
  data: Record<string, unknown>[];
}

export type TrendShape = 'area' | 'bars';

export interface MetricConfig {
  id: string;
  title: string;
  chartType: 'metric';
  subtitle?: string;
  color?: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
  esqlQuery: string;
  trend?: {
    data: Array<{ x: number; y: number }>;
    shape: TrendShape;
  };
}

export interface HeatmapConfig {
  id: string;
  title: string;
  chartType: 'heatmap';
  esqlQuery: string;
  xField: string;
  yField: string;
  valueField: string;
  data: Record<string, unknown>[];
}

export type PanelConfig = ChartConfig | MetricConfig | HeatmapConfig;

export interface SectionConfig {
  id: string;
  title: string;
  collapsed: boolean;
  panelIds: string[];
}

export interface GridPosition {
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface DashboardConfig {
  title: string;
  charts: PanelConfig[];
  sections: SectionConfig[];
  /** Grid layout positions set by user drag/resize in the preview app */
  gridLayout?: Record<string, GridPosition>;
  updatedAt: string;
}

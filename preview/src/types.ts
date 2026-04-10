/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { GridLayoutData } from './grid-layout';

export interface ChartConfig {
  id: string;
  title: string;
  chartType: 'bar' | 'line' | 'area' | 'pie';
  esqlQuery: string;
  xField: string;
  yFields: string[];
  splitField?: string;
  palette?: string[];
  timeField?: string;
}

export interface MetricConfig {
  id: string;
  title: string;
  chartType: 'metric';
  subtitle?: string;
  color?: string;
  valueField?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  esqlQuery: string;
  trendEsqlQuery?: string;
  trendXField?: string;
  trendYField?: string;
  trendShape?: 'area' | 'bars';
  timeField?: string;
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
  timeField?: string;
}

export type PanelConfig = ChartConfig | MetricConfig | HeatmapConfig;

export interface SectionConfig {
  id: string;
  title: string;
  collapsed: boolean;
  panelIds: string[];
}

export interface DashboardConfig {
  title: string;
  charts: PanelConfig[];
  sections: SectionConfig[];
  gridLayout?: GridLayoutData;
  updatedAt: string;
}

export interface ChartPanelData {
  data?: Record<string, unknown>[];
}

export interface MetricPanelData {
  data?: Record<string, unknown>[];
  trend?: {
    data: Array<{ x: number; y: number }>;
    shape: 'area' | 'bars';
  };
}

export type XYChartPanelConfig = ChartConfig & ChartPanelData;
export type MetricPanelConfig = MetricConfig & MetricPanelData;
export type HeatmapPanelConfig = HeatmapConfig & ChartPanelData;
export type RenderablePanelConfig = XYChartPanelConfig | MetricPanelConfig | HeatmapPanelConfig;

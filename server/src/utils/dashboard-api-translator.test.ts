/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import {
  translateXYPanel,
  translatePiePanel,
  translateMetricPanel,
  translateHeatmapPanel,
  translatePanelConfig,
  translateDashboardToApiPayload,
  type DashboardApiPanel,
} from './dashboard-api-translator.js';
import type { ChartConfig, MetricConfig, HeatmapConfig, DashboardConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Individual panel translators
// ---------------------------------------------------------------------------

describe('translateXYPanel', () => {
  it('translates a bar chart', () => {
    const chart: ChartConfig = {
      id: 'test-bar',
      title: 'Bar Chart',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS count = COUNT() BY status',
      xField: 'status',
      yFields: ['count'],
    };
    expect(translateXYPanel(chart)).toEqual({
      type: 'xy',
      layers: [
        {
          type: 'bar',
          data_source: { type: 'esql', query: chart.esqlQuery },
          x: { column: 'status' },
          y: [{ column: 'count' }],
        },
      ],
    });
  });

  it('translates a line chart with splitField', () => {
    const chart: ChartConfig = {
      id: 'test-line',
      title: 'Line Chart',
      chartType: 'line',
      esqlQuery: 'FROM logs | STATS count = COUNT() BY bucket, host',
      xField: 'bucket',
      yFields: ['count'],
      splitField: 'host',
    };
    const result = translateXYPanel(chart);
    expect(result.layers).toHaveLength(1);
    const layer = (result.layers as Record<string, unknown>[])[0];
    expect(layer.type).toBe('line');
    expect(layer.breakdown_by).toEqual({ column: 'host' });
  });

  it('translates multiple y fields', () => {
    const chart: ChartConfig = {
      id: 'test-multi-y',
      title: 'Multi Y',
      chartType: 'area',
      esqlQuery: 'FROM logs | STATS a = COUNT(), b = SUM(bytes) BY bucket',
      xField: 'bucket',
      yFields: ['a', 'b'],
    };
    const result = translateXYPanel(chart);
    const layer = (result.layers as Record<string, unknown>[])[0];
    expect(layer.y).toEqual([{ column: 'a' }, { column: 'b' }]);
  });
});

describe('translatePiePanel', () => {
  it('translates a pie chart', () => {
    const chart: ChartConfig = {
      id: 'test-pie',
      title: 'Pie',
      chartType: 'pie',
      esqlQuery: 'FROM logs | STATS count = COUNT() BY os',
      xField: 'os',
      yFields: ['count'],
    };
    expect(translatePiePanel(chart)).toEqual({
      type: 'pie',
      data_source: { type: 'esql', query: chart.esqlQuery },
      metrics: [{ column: 'count' }],
      group_by: [{ column: 'os' }],
    });
  });
});

describe('translateMetricPanel', () => {
  it('translates a metric', () => {
    const metric: MetricConfig = {
      id: 'total-rev',
      title: 'Total Revenue',
      chartType: 'metric',
      esqlQuery: 'FROM ecommerce | STATS total = SUM(price)',
      valueField: 'total',
    };
    expect(translateMetricPanel(metric)).toEqual({
      type: 'metric',
      data_source: { type: 'esql', query: metric.esqlQuery },
      metrics: [{ type: 'primary', column: 'total', label: 'Total Revenue' }],
    });
  });

  it('omits label when title is empty', () => {
    const metric: MetricConfig = {
      id: 'x',
      title: '',
      chartType: 'metric',
      esqlQuery: 'FROM logs | STATS c = COUNT()',
      valueField: 'c',
    };
    const result = translateMetricPanel(metric);
    const primary = (result.metrics as Record<string, unknown>[])[0];
    expect(primary).not.toHaveProperty('label');
  });
});

describe('translateHeatmapPanel', () => {
  it('translates a heatmap', () => {
    const heatmap: HeatmapConfig = {
      id: 'test-heatmap',
      title: 'Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS count = COUNT() BY hour, day',
      xField: 'hour',
      yField: 'day',
      valueField: 'count',
    };
    expect(translateHeatmapPanel(heatmap)).toEqual({
      type: 'heatmap',
      data_source: { type: 'esql', query: heatmap.esqlQuery },
      x: { column: 'hour' },
      y: { column: 'day' },
      metric: { column: 'count' },
    });
  });
});

// ---------------------------------------------------------------------------
// Unified translatePanelConfig
// ---------------------------------------------------------------------------

describe('translatePanelConfig', () => {
  it('dispatches bar to XY', () => {
    const result = translatePanelConfig({
      id: 'x',
      title: 'X',
      chartType: 'bar',
      esqlQuery: 'FROM x | STATS c = COUNT() BY y',
      xField: 'y',
      yFields: ['c'],
    });
    expect('config' in result).toBe(true);
    if ('config' in result) expect(result.config.type).toBe('xy');
  });

  it('dispatches pie to pie', () => {
    const result = translatePanelConfig({
      id: 'x',
      title: 'X',
      chartType: 'pie',
      esqlQuery: 'FROM x | STATS c = COUNT() BY y',
      xField: 'y',
      yFields: ['c'],
    });
    expect('config' in result).toBe(true);
    if ('config' in result) expect(result.config.type).toBe('pie');
  });

  it('dispatches metric', () => {
    const result = translatePanelConfig({
      id: 'x',
      title: 'X',
      chartType: 'metric',
      esqlQuery: 'FROM x | STATS c = COUNT()',
      valueField: 'c',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) expect(result.config.type).toBe('metric');
  });

  it('dispatches heatmap', () => {
    const result = translatePanelConfig({
      id: 'x',
      title: 'X',
      chartType: 'heatmap',
      esqlQuery: 'FROM x | STATS c = COUNT() BY a, b',
      xField: 'a',
      yField: 'b',
      valueField: 'c',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) expect(result.config.type).toBe('heatmap');
  });
});

// ---------------------------------------------------------------------------
// Full dashboard translation
// ---------------------------------------------------------------------------

describe('translateDashboardToApiPayload', () => {
  const dashboard: DashboardConfig = {
    title: 'Test Dashboard',
    charts: [
      {
        id: 'bar1',
        title: 'Bar',
        chartType: 'bar',
        esqlQuery: 'FROM logs | STATS c = COUNT() BY status',
        xField: 'status',
        yFields: ['c'],
      },
      {
        id: 'metric1',
        title: 'Total',
        chartType: 'metric',
        esqlQuery: 'FROM logs | STATS total = COUNT()',
        valueField: 'total',
      } as MetricConfig,
    ],
    sections: [],
    updatedAt: new Date().toISOString(),
  };

  it('produces correct title and panel count', () => {
    const payload = translateDashboardToApiPayload(dashboard);
    expect(payload.title).toBe('Test Dashboard');
    expect(payload.panels).toHaveLength(2);
    expect(payload.description).toContain('Exported from MCP Dashboard App');
  });

  it('auto-places panels with correct grid', () => {
    const payload = translateDashboardToApiPayload(dashboard);
    // Bar (w=24) + Metric (w=12) fit in one row (36 < 48)
    // With balanced widths: 2 panels → 24+24
    const p0 = payload.panels[0] as DashboardApiPanel;
    const p1 = payload.panels[1] as DashboardApiPanel;
    expect(p0.grid.y).toBe(0);
    expect(p1.grid.y).toBe(0);
    expect(p0.grid.x).toBe(0);
    expect(p1.grid.x).toBe(24);
  });

  it('all panels have type "vis"', () => {
    const payload = translateDashboardToApiPayload(dashboard);
    for (const panel of payload.panels) {
      expect((panel as DashboardApiPanel).type).toBe('vis');
    }
  });

  it('each panel has a unique UUID id', () => {
    const payload = translateDashboardToApiPayload(dashboard);
    const ids = payload.panels.map((p) => (p as DashboardApiPanel).id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
    }
  });

  it('uses gridLayout positions when available', () => {
    const withLayout: DashboardConfig = {
      ...dashboard,
      gridLayout: {
        bar1: { type: 'panel', column: 10, row: 5, width: 20, height: 12 },
        metric1: { type: 'panel', column: 30, row: 5, width: 18, height: 8 },
      },
    };
    const payload = translateDashboardToApiPayload(withLayout);
    expect((payload.panels[0] as DashboardApiPanel).grid).toEqual({ x: 10, y: 5, w: 20, h: 12 });
    expect((payload.panels[1] as DashboardApiPanel).grid).toEqual({ x: 30, y: 5, w: 18, h: 8 });
  });

  it('panel configs contain correct visualization structures', () => {
    const payload = translateDashboardToApiPayload(dashboard);
    // First panel is a bar chart → xy
    expect((payload.panels[0] as DashboardApiPanel).config.type).toBe('xy');
    expect((payload.panels[0] as DashboardApiPanel).config.layers).toBeDefined();
    // Second panel is a metric
    expect((payload.panels[1] as DashboardApiPanel).config.type).toBe('metric');
    expect((payload.panels[1] as DashboardApiPanel).config.metrics).toBeDefined();
  });
});

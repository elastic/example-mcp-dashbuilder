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
} from './dashboard-api-translator.js';
import { translateDashboardApiPanel } from './dashboard-api-reverse.js';
import type { DashboardApiPanelResponse } from './dashboard-api-reverse.js';
import type { ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

/**
 * Roundtrip: PanelConfig → Dashboard API config → reverse → PanelConfig.
 * Wraps the translated config in the panel envelope that the reverse translator expects.
 */
function roundTrip(
  panel: ChartConfig | MetricConfig | HeatmapConfig,
  translateFn: (p: never) => Record<string, unknown>
) {
  const config = translateFn(panel as never);
  const apiPanel: DashboardApiPanelResponse = {
    type: 'vis',
    id: panel.id,
    grid: { x: 0, y: 0, w: 24, h: 15 },
    config,
  };
  const result = translateDashboardApiPanel(apiPanel, panel.id, panel.title);
  expect('config' in result).toBe(true);
  if (!('config' in result)) throw new Error('roundtrip failed');
  return result.config;
}

describe('Dashboard API translate → reverse roundtrip', () => {
  it('bar chart', () => {
    const input: ChartConfig = {
      id: 'bar-1',
      title: 'Bar Chart',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS count = COUNT(*) BY host',
      xField: 'host',
      yFields: ['count'],
    };
    const out = roundTrip(input, translateXYPanel) as ChartConfig;
    expect(out.chartType).toBe('bar');
    expect(out.title).toBe(input.title);
    expect(out.esqlQuery).toBe(input.esqlQuery);
    expect(out.xField).toBe('host');
    expect(out.yFields).toEqual(['count']);
  });

  it('line chart', () => {
    const input: ChartConfig = {
      id: 'line-1',
      title: 'Line Chart',
      chartType: 'line',
      esqlQuery: 'FROM metrics | STATS avg_cpu = AVG(cpu) BY minute',
      xField: 'minute',
      yFields: ['avg_cpu'],
    };
    const out = roundTrip(input, translateXYPanel) as ChartConfig;
    expect(out.chartType).toBe('line');
    expect(out.title).toBe(input.title);
    expect(out.xField).toBe('minute');
    expect(out.yFields).toEqual(['avg_cpu']);
  });

  it('area chart', () => {
    const input: ChartConfig = {
      id: 'area-1',
      title: 'Area Chart',
      chartType: 'area',
      esqlQuery: 'FROM metrics | STATS sum_bytes = SUM(bytes) BY hour',
      xField: 'hour',
      yFields: ['sum_bytes'],
    };
    const out = roundTrip(input, translateXYPanel) as ChartConfig;
    expect(out.chartType).toBe('area');
    expect(out.title).toBe(input.title);
    expect(out.xField).toBe('hour');
    expect(out.yFields).toEqual(['sum_bytes']);
  });

  it('bar chart with splitField', () => {
    const input: ChartConfig = {
      id: 'bar-split',
      title: 'Split Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY host, region',
      xField: 'host',
      yFields: ['c'],
      splitField: 'region',
    };
    const out = roundTrip(input, translateXYPanel) as ChartConfig;
    expect(out.title).toBe(input.title);
    expect(out.splitField).toBe('region');
  });

  it('bar chart with multiple yFields', () => {
    const input: ChartConfig = {
      id: 'bar-multi',
      title: 'Multi Y',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS a = COUNT(*), b = SUM(bytes) BY host',
      xField: 'host',
      yFields: ['a', 'b'],
    };
    const out = roundTrip(input, translateXYPanel) as ChartConfig;
    expect(out.title).toBe(input.title);
    expect(out.yFields).toEqual(['a', 'b']);
  });

  it('pie chart', () => {
    const input: ChartConfig = {
      id: 'pie-1',
      title: 'Pie Chart',
      chartType: 'pie',
      esqlQuery: 'FROM logs | STATS count = COUNT(*) BY status',
      xField: 'status',
      yFields: ['count'],
    };
    const out = roundTrip(input, translatePiePanel) as ChartConfig;
    expect(out.chartType).toBe('pie');
    expect(out.title).toBe(input.title);
    expect(out.xField).toBe('status');
    expect(out.yFields).toEqual(['count']);
  });

  it('metric', () => {
    const input: MetricConfig = {
      id: 'metric-1',
      title: 'Total Logs',
      chartType: 'metric',
      valueField: 'total',
      esqlQuery: 'FROM logs | STATS total = COUNT(*)',
    };
    const out = roundTrip(input, translateMetricPanel) as MetricConfig;
    expect(out.chartType).toBe('metric');
    expect(out.title).toBe(input.title);
    expect(out.valueField).toBe('total');
  });

  it('metric with subtitle and color', () => {
    const input: MetricConfig = {
      id: 'metric-styled',
      title: 'Total Events',
      chartType: 'metric',
      valueField: 'total',
      esqlQuery: 'FROM logs | STATS total = COUNT(*)',
      subtitle: 'Selected time range',
      color: '#54B399',
    };
    const out = roundTrip(input, translateMetricPanel) as MetricConfig;
    expect(out.chartType).toBe('metric');
    expect(out.title).toBe(input.title);
    expect(out.subtitle).toBe('Selected time range');
    expect(out.color).toBe('#54B399');
  });

  it('metric with subtitle only', () => {
    const input: MetricConfig = {
      id: 'metric-sub',
      title: 'Revenue',
      chartType: 'metric',
      valueField: 'revenue',
      esqlQuery: 'FROM sales | STATS revenue = SUM(price)',
      subtitle: 'All time',
    };
    const out = roundTrip(input, translateMetricPanel) as MetricConfig;
    expect(out.subtitle).toBe('All time');
    expect(out.color).toBeUndefined();
  });

  it('metric with color only', () => {
    const input: MetricConfig = {
      id: 'metric-color',
      title: 'Errors',
      chartType: 'metric',
      valueField: 'errors',
      esqlQuery: 'FROM logs | STATS errors = COUNT(*) WHERE level = "error"',
      color: '#E7664C',
    };
    const out = roundTrip(input, translateMetricPanel) as MetricConfig;
    expect(out.color).toBe('#E7664C');
    expect(out.subtitle).toBeUndefined();
  });

  it('heatmap', () => {
    const input: HeatmapConfig = {
      id: 'heatmap-1',
      title: 'Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
      xField: 'hour',
      yField: 'day',
      valueField: 'c',
    };
    const out = roundTrip(input, translateHeatmapPanel) as HeatmapConfig;
    expect(out.chartType).toBe('heatmap');
    expect(out.title).toBe(input.title);
    expect(out.xField).toBe('hour');
    expect(out.yField).toBe('day');
    expect(out.valueField).toBe('c');
  });

  // -------------------------------------------------------------------------
  // Known gap: trend metadata is not preserved through the Dashboard API path.
  // Kibana's metric schema supports background_chart type 'trend' for
  // non-ES|QL (DSL/data-view) charts, but the ES|QL metric schema
  // (complementaryVizSchemaESQL) only supports 'bar'. Since our pipeline
  // is ES|QL-only, trend cannot roundtrip. If Kibana adds trend support
  // to the ES|QL metric schema, these tests should be updated.
  // See: kbn-lens-embeddable-utils/config_builder/schema/charts/metric.ts
  // -------------------------------------------------------------------------

  describe('metric trend is not preserved (known schema limitation)', () => {
    it('trendEsqlQuery is lost', () => {
      const input: MetricConfig = {
        id: 'metric-trend',
        title: 'Trending Metric',
        chartType: 'metric',
        valueField: 'total',
        esqlQuery: 'FROM logs | STATS total = COUNT(*)',
        trendEsqlQuery: 'FROM logs | STATS total = COUNT(*) BY BUCKET(@timestamp, 1 day)',
        trendXField: 'BUCKET(@timestamp, 1 day)',
        trendYField: 'total',
        trendShape: 'area',
      };
      const out = roundTrip(input, translateMetricPanel) as MetricConfig;
      expect(out.trendEsqlQuery).toBeUndefined();
      expect(out.trendXField).toBeUndefined();
      expect(out.trendYField).toBeUndefined();
      expect(out.trendShape).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Known gap: timeField is not preserved through the Dashboard API path.
  // The Kibana ES|QL data source schema is { type: 'esql', query: string }
  // with no time_field property. If Kibana adds time_field support to the
  // ES|QL data source schema, these tests should be updated to expect
  // the timeField to roundtrip.
  // -------------------------------------------------------------------------

  describe('timeField is not preserved (known schema limitation)', () => {
    it('bar chart timeField is lost', () => {
      const input: ChartConfig = {
        id: 'bar-tf',
        title: 'Timed Bar',
        chartType: 'bar',
        esqlQuery: 'FROM logs | STATS count = COUNT(*) BY host',
        xField: 'host',
        yFields: ['count'],
        timeField: '@timestamp',
      };
      const out = roundTrip(input, translateXYPanel) as ChartConfig;
      expect(out.timeField).toBeUndefined();
    });

    it('metric timeField is lost', () => {
      const input: MetricConfig = {
        id: 'metric-tf',
        title: 'Timed Metric',
        chartType: 'metric',
        valueField: 'total',
        esqlQuery: 'FROM logs | STATS total = COUNT(*)',
        timeField: '@timestamp',
      };
      const out = roundTrip(input, translateMetricPanel) as MetricConfig;
      expect(out.timeField).toBeUndefined();
    });

    it('heatmap timeField is lost', () => {
      const input: HeatmapConfig = {
        id: 'heatmap-tf',
        title: 'Timed Heatmap',
        chartType: 'heatmap',
        esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
        xField: 'hour',
        yField: 'day',
        valueField: 'c',
        timeField: '@timestamp',
      };
      const out = roundTrip(input, translateHeatmapPanel) as HeatmapConfig;
      expect(out.timeField).toBeUndefined();
    });
  });
});

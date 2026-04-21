/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { translatePanelToLens } from './lens-translator.js';
import { translateLensToPanel } from './lens-reverse-translator.js';
import type { ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

function roundTrip(
  config: ChartConfig | MetricConfig | HeatmapConfig,
  ctx?: { indexPattern: string; timeField: string }
) {
  const { attributes } = translatePanelToLens(config, ctx);
  return translateLensToPanel(attributes as Record<string, unknown>, config.id);
}

describe('Lens round-trip: export then import', () => {
  it('bar chart preserves fields', () => {
    const original: ChartConfig = {
      id: 'bar-1',
      title: 'Revenue by Category',
      chartType: 'bar',
      esqlQuery: 'FROM ecommerce | STATS revenue = SUM(price) BY category',
      xField: 'category',
      yFields: ['revenue'],
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.chartType).toBe('bar');
      expect(result.config.title).toBe(original.title);
      expect(result.config.esqlQuery).toBe(original.esqlQuery);
      expect((result.config as ChartConfig).xField).toBe('category');
      expect((result.config as ChartConfig).yFields).toEqual(['revenue']);
    }
  });

  it('line chart preserves fields', () => {
    const original: ChartConfig = {
      id: 'line-1',
      title: 'Orders Over Time',
      chartType: 'line',
      esqlQuery: 'FROM orders | STATS c = COUNT(*) BY BUCKET(@timestamp, 1 day)',
      xField: 'BUCKET(@timestamp, 1 day)',
      yFields: ['c'],
    };
    const result = roundTrip(original);
    if ('config' in result) {
      expect(result.config.chartType).toBe('line');
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).xField).toBe('BUCKET(@timestamp, 1 day)');
    }
  });

  it('pie chart preserves fields', () => {
    const original: ChartConfig = {
      id: 'pie-1',
      title: 'Status Distribution',
      chartType: 'pie',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY status',
      xField: 'status',
      yFields: ['c'],
    };
    const result = roundTrip(original);
    if ('config' in result) {
      expect(result.config.chartType).toBe('pie');
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).xField).toBe('status');
      expect((result.config as ChartConfig).yFields).toEqual(['c']);
    }
  });

  it('metric preserves fields', () => {
    const original: MetricConfig = {
      id: 'metric-1',
      title: 'Total Revenue',
      chartType: 'metric',
      valueField: 'total',
      esqlQuery: 'FROM ecommerce | STATS total = SUM(price)',
      subtitle: 'All time',
      color: '#54B399',
    };
    const result = roundTrip(original);
    if ('config' in result) {
      expect(result.config.chartType).toBe('metric');
      expect(result.config.title).toBe(original.title);
      const m = result.config as MetricConfig;
      expect(m.valueField).toBe('total');
      expect(m.subtitle).toBe('All time');
      expect(m.color).toBe('#54B399');
    }
  });

  it('area chart preserves fields', () => {
    const original: ChartConfig = {
      id: 'area-1',
      title: 'Bytes Over Time',
      chartType: 'area',
      esqlQuery: 'FROM metrics | STATS sum_bytes = SUM(bytes) BY hour',
      xField: 'hour',
      yFields: ['sum_bytes'],
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.chartType).toBe('area');
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).xField).toBe('hour');
      expect((result.config as ChartConfig).yFields).toEqual(['sum_bytes']);
    }
  });

  it('bar chart with splitField preserves split', () => {
    const original: ChartConfig = {
      id: 'bar-split',
      title: 'Split Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY host, region',
      xField: 'host',
      yFields: ['c'],
      splitField: 'region',
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).splitField).toBe('region');
    }
  });

  it('bar chart with palette preserves colors', () => {
    const original: ChartConfig = {
      id: 'bar-palette',
      title: 'Colored Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY host',
      xField: 'host',
      yFields: ['c'],
      palette: ['#E91E63'],
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).palette).toEqual(['#E91E63']);
    }
  });

  it('bar chart with multiple yFields and palette preserves all', () => {
    const original: ChartConfig = {
      id: 'bar-multi',
      title: 'Multi Y',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS a = COUNT(*), b = SUM(bytes) BY host',
      xField: 'host',
      yFields: ['a', 'b'],
      palette: ['#FF0000', '#00FF00'],
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.title).toBe(original.title);
      expect((result.config as ChartConfig).yFields).toEqual(['a', 'b']);
      expect((result.config as ChartConfig).palette).toEqual(['#FF0000', '#00FF00']);
    }
  });

  it('heatmap preserves fields', () => {
    const original: HeatmapConfig = {
      id: 'heatmap-1',
      title: 'Requests by Day/Hour',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
      xField: 'hour',
      yField: 'day',
      valueField: 'c',
    };
    const result = roundTrip(original);
    if ('config' in result) {
      expect(result.config.chartType).toBe('heatmap');
      expect(result.config.title).toBe(original.title);
      const h = result.config as HeatmapConfig;
      expect(h.xField).toBe('hour');
      expect(h.yField).toBe('day');
      expect(h.valueField).toBe('c');
    }
  });

  it('bar chart with timeField preserves timeField', () => {
    const original: ChartConfig = {
      id: 'bar-tf',
      title: 'Timed Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS count = COUNT(*) BY host',
      xField: 'host',
      yFields: ['count'],
      timeField: '@timestamp',
    };
    const result = roundTrip(original, {
      indexPattern: 'logs',
      timeField: '@timestamp',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.title).toBe(original.title);
      expect(result.config.timeField).toBe('@timestamp');
    }
  });

  it('line chart with timeField preserves timeField', () => {
    const original: ChartConfig = {
      id: 'line-tf',
      title: 'Timed Line',
      chartType: 'line',
      esqlQuery: 'FROM metrics | STATS avg_cpu = AVG(cpu) BY minute',
      xField: 'minute',
      yFields: ['avg_cpu'],
      timeField: '@timestamp',
    };
    const result = roundTrip(original, {
      indexPattern: 'metrics',
      timeField: '@timestamp',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.timeField).toBe('@timestamp');
    }
  });

  it('pie chart with timeField preserves timeField', () => {
    const original: ChartConfig = {
      id: 'pie-tf',
      title: 'Timed Pie',
      chartType: 'pie',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY status',
      xField: 'status',
      yFields: ['c'],
      timeField: '@timestamp',
    };
    const result = roundTrip(original, {
      indexPattern: 'logs',
      timeField: '@timestamp',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.timeField).toBe('@timestamp');
    }
  });

  it('metric with timeField preserves timeField', () => {
    const original: MetricConfig = {
      id: 'metric-tf',
      title: 'Timed Metric',
      chartType: 'metric',
      valueField: 'total',
      esqlQuery: 'FROM logs | STATS total = COUNT(*)',
      timeField: '@timestamp',
    };
    const result = roundTrip(original, {
      indexPattern: 'logs',
      timeField: '@timestamp',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.timeField).toBe('@timestamp');
    }
  });

  it('heatmap with timeField preserves timeField', () => {
    const original: HeatmapConfig = {
      id: 'heatmap-tf',
      title: 'Timed Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
      xField: 'hour',
      yField: 'day',
      valueField: 'c',
      timeField: '@timestamp',
    };
    const result = roundTrip(original, {
      indexPattern: 'logs',
      timeField: '@timestamp',
    });
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.timeField).toBe('@timestamp');
    }
  });

  it('heatmap with colorRamp preserves colors', () => {
    const original: HeatmapConfig = {
      id: 'heatmap-colors',
      title: 'Colored Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
      xField: 'hour',
      yField: 'day',
      valueField: 'c',
      colorRamp: ['#aaa', '#bbb', '#ccc'],
    };
    const result = roundTrip(original);
    expect('config' in result).toBe(true);
    if ('config' in result) {
      expect(result.config.title).toBe(original.title);
      expect((result.config as HeatmapConfig).colorRamp).toEqual(['#aaa', '#bbb', '#ccc']);
    }
  });
});

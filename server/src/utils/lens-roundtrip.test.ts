/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { translatePanelToLens } from './lens-translator.js';
import { translateLensToPanel } from './lens-reverse-translator.js';
import type { ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

function roundTrip(config: ChartConfig | MetricConfig | HeatmapConfig) {
  const { attributes } = translatePanelToLens(config);
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
      const m = result.config as MetricConfig;
      expect(m.valueField).toBe('total');
      expect(m.subtitle).toBe('All time');
      expect(m.color).toBe('#54B399');
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
      const h = result.config as HeatmapConfig;
      expect(h.xField).toBe('hour');
      expect(h.yField).toBe('day');
      expect(h.valueField).toBe('c');
    }
  });
});

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { translateDashboardApiPanel, isDashboardApiSection } from './dashboard-api-reverse.js';
import type {
  DashboardApiPanelResponse,
  DashboardApiSectionResponse,
} from './dashboard-api-reverse.js';
import type { ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

function makePanel(config: Record<string, unknown>): DashboardApiPanelResponse {
  return {
    type: 'vis',
    id: 'test-id',
    grid: { x: 0, y: 0, w: 24, h: 15 },
    config,
  };
}

// ---------------------------------------------------------------------------
// XY charts
// ---------------------------------------------------------------------------

describe('reverse XY', () => {
  it('translates a bar chart', () => {
    const panel = makePanel({
      type: 'xy',
      layers: [
        {
          type: 'bar',
          data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY status' },
          x: { column: 'status' },
          y: [{ column: 'c' }],
        },
      ],
    });
    const result = translateDashboardApiPanel(panel, 'bar1');
    expect(result).toEqual({
      config: {
        id: 'bar1',
        title: 'bar1',
        chartType: 'bar',
        esqlQuery: 'FROM logs | STATS c = COUNT() BY status',
        xField: 'status',
        yFields: ['c'],
      } satisfies ChartConfig,
    });
  });

  it('translates a line chart with breakdown', () => {
    const panel = makePanel({
      type: 'xy',
      layers: [
        {
          type: 'line',
          data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY ts, host' },
          x: { column: 'ts' },
          y: [{ column: 'c' }],
          breakdown_by: { column: 'host' },
        },
      ],
    });
    const result = translateDashboardApiPanel(panel, 'line1');
    expect('config' in result && result.config.chartType).toBe('line');
    expect('config' in result && (result.config as ChartConfig).splitField).toBe('host');
  });

  it('translates area chart', () => {
    const panel = makePanel({
      type: 'xy',
      layers: [
        {
          type: 'area',
          data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY ts' },
          x: { column: 'ts' },
          y: [{ column: 'c' }],
        },
      ],
    });
    const result = translateDashboardApiPanel(panel, 'area1');
    expect('config' in result && result.config.chartType).toBe('area');
  });

  it('translates multiple y fields', () => {
    const panel = makePanel({
      type: 'xy',
      layers: [
        {
          type: 'bar',
          data_source: {
            type: 'esql',
            query: 'FROM logs | STATS a = COUNT(), b = SUM(bytes) BY x',
          },
          x: { column: 'x' },
          y: [{ column: 'a' }, { column: 'b' }],
        },
      ],
    });
    const result = translateDashboardApiPanel(panel, 'multi');
    expect('config' in result && (result.config as ChartConfig).yFields).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// Pie
// ---------------------------------------------------------------------------

describe('reverse pie', () => {
  it('translates a pie chart', () => {
    const panel = makePanel({
      type: 'pie',
      data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY os' },
      metrics: [{ column: 'c' }],
      group_by: [{ column: 'os' }],
    });
    const result = translateDashboardApiPanel(panel, 'pie1');
    expect(result).toEqual({
      config: {
        id: 'pie1',
        title: 'pie1',
        chartType: 'pie',
        esqlQuery: 'FROM logs | STATS c = COUNT() BY os',
        xField: 'os',
        yFields: ['c'],
      } satisfies ChartConfig,
    });
  });
});

// ---------------------------------------------------------------------------
// Metric
// ---------------------------------------------------------------------------

describe('reverse metric', () => {
  it('translates a metric', () => {
    const panel = makePanel({
      type: 'metric',
      data_source: { type: 'esql', query: 'FROM logs | STATS total = COUNT()' },
      metrics: [{ type: 'primary', column: 'total', label: 'Total' }],
    });
    const result = translateDashboardApiPanel(panel, 'met1', 'Total Events');
    expect(result).toEqual({
      config: {
        id: 'met1',
        title: 'Total Events',
        chartType: 'metric',
        esqlQuery: 'FROM logs | STATS total = COUNT()',
        valueField: 'total',
      } satisfies MetricConfig,
    });
  });
});

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

describe('reverse heatmap', () => {
  it('translates a heatmap', () => {
    const panel = makePanel({
      type: 'heatmap',
      data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY hour, day' },
      x: { column: 'hour' },
      y: { column: 'day' },
      metric: { column: 'c' },
    });
    const result = translateDashboardApiPanel(panel, 'hm1');
    expect(result).toEqual({
      config: {
        id: 'hm1',
        title: 'hm1',
        chartType: 'heatmap',
        esqlQuery: 'FROM logs | STATS c = COUNT() BY hour, day',
        xField: 'hour',
        yField: 'day',
        valueField: 'c',
      } satisfies HeatmapConfig,
    });
  });
});

// ---------------------------------------------------------------------------
// isDashboardApiSection type guard
// ---------------------------------------------------------------------------

describe('isDashboardApiSection', () => {
  it('returns true for a section entry', () => {
    const section: DashboardApiSectionResponse = {
      title: 'My Section',
      collapsed: false,
      grid: { y: 0 },
      panels: [{ type: 'vis', id: 'p1', grid: { x: 0, y: 0, w: 24, h: 15 }, config: {} }],
    };
    expect(isDashboardApiSection(section)).toBe(true);
  });

  it('returns true for a section with empty panels array', () => {
    const section: DashboardApiSectionResponse = {
      title: 'Empty Section',
      collapsed: true,
      grid: { y: 10 },
      panels: [],
    };
    expect(isDashboardApiSection(section)).toBe(true);
  });

  it('returns false for a panel entry', () => {
    const panel: DashboardApiPanelResponse = {
      type: 'vis',
      id: 'p1',
      grid: { x: 0, y: 0, w: 24, h: 15 },
      config: { type: 'xy' },
    };
    expect(isDashboardApiSection(panel)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Skip cases
// ---------------------------------------------------------------------------

describe('skip cases', () => {
  it('skips non-vis panel type', () => {
    const panel: DashboardApiPanelResponse = {
      type: 'markdown',
      id: 'md1',
      grid: { x: 0, y: 0, w: 48, h: 4 },
      config: { content: '# Hello' },
    };
    const result = translateDashboardApiPanel(panel, 'md1');
    expect('skip' in result).toBe(true);
  });

  it('skips panel without esql data source', () => {
    const panel = makePanel({
      type: 'xy',
      layers: [
        {
          type: 'bar',
          data_source: { type: 'data_view_reference', ref_id: 'some-id' },
          x: { column: 'x' },
          y: [{ column: 'y' }],
        },
      ],
    });
    const result = translateDashboardApiPanel(panel, 'dv1');
    expect('skip' in result).toBe(true);
  });

  it('skips unsupported viz type', () => {
    const panel = makePanel({
      type: 'tag_cloud',
      data_source: { type: 'esql', query: 'FROM logs | STATS c = COUNT() BY kw' },
      tag_by: { column: 'kw' },
      metric: { column: 'c' },
    });
    const result = translateDashboardApiPanel(panel, 'tc1');
    expect('skip' in result).toBe(true);
    expect('skip' in result && result.skip).toContain('tag_cloud');
  });
});

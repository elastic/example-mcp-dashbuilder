/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { translateLensToPanel } from './lens-reverse-translator.js';

function makeLensAttrs(
  visType: string,
  esql: string,
  layerId: string,
  columns: Array<{ columnId: string; fieldName: string; meta?: { type: string } }>,
  visualization: Record<string, unknown>
) {
  return {
    title: 'Test Panel',
    visualizationType: visType,
    state: {
      query: { esql },
      datasourceStates: {
        textBased: {
          layers: {
            [layerId]: {
              query: { esql },
              columns,
            },
          },
        },
      },
      visualization,
    },
  };
}

describe('translateLensToPanel', () => {
  describe('XY', () => {
    it('reverses a bar chart', () => {
      const attrs = makeLensAttrs(
        'lnsXY',
        'FROM logs | STATS c = COUNT(*) BY host',
        'layer1',
        [
          { columnId: 'col-x', fieldName: 'host', meta: { type: 'string' } },
          { columnId: 'col-y', fieldName: 'c', meta: { type: 'number' } },
        ],
        {
          layers: [
            {
              seriesType: 'bar',
              xAccessor: 'col-x',
              accessors: ['col-y'],
            },
          ],
        }
      );

      const result = translateLensToPanel(attrs, 'test-id');
      expect('config' in result).toBe(true);
      if ('config' in result) {
        expect(result.config.chartType).toBe('bar');
        expect(result.config.esqlQuery).toBe('FROM logs | STATS c = COUNT(*) BY host');
        const chart = result.config as { xField: string; yFields: string[] };
        expect(chart.xField).toBe('host');
        expect(chart.yFields).toEqual(['c']);
      }
    });

    it('extracts palette from yConfig', () => {
      const attrs = makeLensAttrs(
        'lnsXY',
        'FROM logs | STATS c = COUNT(*) BY host',
        'layer1',
        [
          { columnId: 'col-x', fieldName: 'host' },
          { columnId: 'col-y', fieldName: 'c' },
        ],
        {
          layers: [
            {
              seriesType: 'line',
              xAccessor: 'col-x',
              accessors: ['col-y'],
              yConfig: [{ forAccessor: 'col-y', color: '#E91E63' }],
            },
          ],
        }
      );

      const result = translateLensToPanel(attrs, 'test-id');
      if ('config' in result) {
        expect((result.config as { palette?: string[] }).palette).toEqual(['#E91E63']);
      }
    });
  });

  describe('pie', () => {
    it('reverses a pie chart', () => {
      const attrs = makeLensAttrs(
        'lnsPie',
        'FROM logs | STATS c = COUNT(*) BY status',
        'layer1',
        [
          { columnId: 'col-g', fieldName: 'status' },
          { columnId: 'col-m', fieldName: 'c' },
        ],
        {
          layers: [
            {
              primaryGroups: ['col-g'],
              metrics: ['col-m'],
            },
          ],
        }
      );

      const result = translateLensToPanel(attrs, 'test-id');
      if ('config' in result) {
        expect(result.config.chartType).toBe('pie');
      }
    });
  });

  describe('metric', () => {
    it('reverses a metric panel', () => {
      const attrs = makeLensAttrs(
        'lnsMetric',
        'FROM logs | STATS total = COUNT(*)',
        'layer1',
        [{ columnId: 'col-v', fieldName: 'total' }],
        {
          metricAccessor: 'col-v',
          subtitle: 'All logs',
          color: '#54B399',
        }
      );

      const result = translateLensToPanel(attrs, 'test-id');
      if ('config' in result) {
        expect(result.config.chartType).toBe('metric');
        const metric = result.config as { valueField: string; subtitle?: string; color?: string };
        expect(metric.valueField).toBe('total');
        expect(metric.subtitle).toBe('All logs');
        expect(metric.color).toBe('#54B399');
      }
    });
  });

  describe('heatmap', () => {
    it('reverses a heatmap', () => {
      const attrs = makeLensAttrs(
        'lnsHeatmap',
        'FROM logs | STATS c = COUNT(*) BY day, hour',
        'layer1',
        [
          { columnId: 'col-x', fieldName: 'hour' },
          { columnId: 'col-y', fieldName: 'day' },
          { columnId: 'col-v', fieldName: 'c' },
        ],
        {
          xAccessor: 'col-x',
          yAccessor: 'col-y',
          valueAccessor: 'col-v',
        }
      );

      const result = translateLensToPanel(attrs, 'test-id');
      if ('config' in result) {
        expect(result.config.chartType).toBe('heatmap');
        const hm = result.config as { xField: string; yField: string; valueField: string };
        expect(hm.xField).toBe('hour');
        expect(hm.yField).toBe('day');
        expect(hm.valueField).toBe('c');
      }
    });
  });

  describe('skip cases', () => {
    it('skips unsupported visualization type', () => {
      const attrs = makeLensAttrs('lnsGauge', 'FROM logs', 'l', [], {});
      const result = translateLensToPanel(attrs, 'test');
      expect('skip' in result).toBe(true);
      if ('skip' in result) expect(result.skip).toContain('unsupported');
    });

    it('skips when no ES|QL query', () => {
      const attrs = makeLensAttrs('lnsXY', '', 'l', [], {});
      const result = translateLensToPanel(attrs, 'test');
      expect('skip' in result).toBe(true);
    });

    it('skips when no state', () => {
      const result = translateLensToPanel({ visualizationType: 'lnsXY' }, 'test');
      expect('skip' in result).toBe(true);
    });

    it('skips formBased (non-ES|QL) panels', () => {
      const attrs = {
        visualizationType: 'lnsXY',
        state: {
          query: { esql: 'FROM logs' },
          datasourceStates: { formBased: { layers: {} } },
          visualization: {},
        },
      };
      const result = translateLensToPanel(attrs, 'test');
      expect('skip' in result).toBe(true);
      if ('skip' in result) expect(result.skip).toContain('not ES|QL');
    });
  });
});

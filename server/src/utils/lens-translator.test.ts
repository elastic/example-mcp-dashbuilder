import { describe, it, expect } from 'vitest';
import { translatePanelToLens } from './lens-translator.js';
import type { ChartConfig, MetricConfig, HeatmapConfig } from '../types.js';

describe('translatePanelToLens', () => {
  describe('XY charts', () => {
    const barChart: ChartConfig = {
      id: 'test-bar',
      title: 'Test Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs | STATS count = COUNT(*) BY host',
      xField: 'host',
      yFields: ['count'],
    };

    it('produces lnsXY visualization type', () => {
      const result = translatePanelToLens(barChart);
      expect(result.visualizationType).toBe('lnsXY');
    });

    it('stores the ES|QL query', () => {
      const result = translatePanelToLens(barChart);
      const state = result.attributes.state as Record<string, unknown>;
      expect((state.query as { esql: string }).esql).toBe(barChart.esqlQuery);
    });

    it('creates columns for xField and yFields', () => {
      const result = translatePanelToLens(barChart);
      const state = result.attributes.state as Record<string, unknown>;
      const ds = state.datasourceStates as Record<string, unknown>;
      const textBased = ds.textBased as {
        layers: Record<string, { columns: Array<{ fieldName: string }> }>;
      };
      const layer = Object.values(textBased.layers)[0];
      const fieldNames = layer.columns.map((c) => c.fieldName);
      expect(fieldNames).toContain('host');
      expect(fieldNames).toContain('count');
    });

    it('includes adHocDataViews when TimeFieldContext provided', () => {
      const result = translatePanelToLens(barChart, {
        indexPattern: 'logs',
        timeField: '@timestamp',
      });
      expect(result.attributes.adHocDataViews).toBeDefined();
      const views = result.attributes.adHocDataViews as Record<string, { timeFieldName: string }>;
      const view = Object.values(views)[0];
      expect(view.timeFieldName).toBe('@timestamp');
    });

    it('applies yConfig colors from palette', () => {
      const chart: ChartConfig = { ...barChart, palette: ['#E91E63'] };
      const result = translatePanelToLens(chart);
      const state = result.attributes.state as Record<string, unknown>;
      const vis = state.visualization as { layers: Array<{ yConfig?: Array<{ color: string }> }> };
      expect(vis.layers[0].yConfig?.[0].color).toBe('#E91E63');
    });
  });

  describe('pie', () => {
    const pie: ChartConfig = {
      id: 'test-pie',
      title: 'Test Pie',
      chartType: 'pie',
      esqlQuery: 'FROM logs | STATS count = COUNT(*) BY status',
      xField: 'status',
      yFields: ['count'],
    };

    it('produces lnsPie visualization type', () => {
      expect(translatePanelToLens(pie).visualizationType).toBe('lnsPie');
    });
  });

  describe('metric', () => {
    const metric: MetricConfig = {
      id: 'test-metric',
      title: 'Total',
      chartType: 'metric',
      valueField: 'total',
      esqlQuery: 'FROM logs | STATS total = COUNT(*)',
      subtitle: 'All logs',
      color: '#54B399',
    };

    it('produces lnsMetric visualization type', () => {
      expect(translatePanelToLens(metric).visualizationType).toBe('lnsMetric');
    });

    it('includes subtitle and color', () => {
      const result = translatePanelToLens(metric);
      const state = result.attributes.state as Record<string, unknown>;
      const vis = state.visualization as Record<string, unknown>;
      expect(vis.subtitle).toBe('All logs');
      expect(vis.color).toBe('#54B399');
    });
  });

  describe('heatmap', () => {
    const heatmap: HeatmapConfig = {
      id: 'test-heatmap',
      title: 'Test Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs | STATS c = COUNT(*) BY day, hour',
      xField: 'hour',
      yField: 'day',
      valueField: 'c',
    };

    it('produces lnsHeatmap visualization type', () => {
      expect(translatePanelToLens(heatmap).visualizationType).toBe('lnsHeatmap');
    });

    it('includes custom palette when colorRamp provided', () => {
      const h: HeatmapConfig = { ...heatmap, colorRamp: ['#aaa', '#bbb', '#ccc'] };
      const result = translatePanelToLens(h);
      const state = result.attributes.state as Record<string, unknown>;
      const vis = state.visualization as { palette?: { name: string } };
      expect(vis.palette?.name).toBe('custom');
    });
  });
});

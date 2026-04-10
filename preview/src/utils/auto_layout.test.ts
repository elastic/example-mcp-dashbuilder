import { describe, expect, it } from 'vitest';
import type { ChartConfig, MetricConfig, SectionConfig } from '../types';
import { autoPlacePanels, buildAutoGridLayout } from './auto_layout';

function makeBarChart(id: string): ChartConfig {
  return {
    id,
    title: `Bar ${id}`,
    chartType: 'bar',
    esqlQuery: 'FROM ecommerce | STATS revenue = SUM(price) BY category',
    xField: 'category',
    yFields: ['revenue'],
  };
}

function makeMetric(id: string): MetricConfig {
  return {
    id,
    title: `Metric ${id}`,
    chartType: 'metric',
    valueField: 'total',
    esqlQuery: 'FROM ecommerce | STATS total = COUNT(*)',
  };
}

describe('autoPlacePanels', () => {
  it('makes a single chart span the full row', () => {
    const { panels, nextRow } = autoPlacePanels([makeBarChart('bar-1')]);

    expect(panels['bar-1']).toMatchObject({
      column: 0,
      row: 0,
      width: 48,
      height: 15,
    });
    expect(nextRow).toBe(15);
  });

  it('splits two charts evenly across the row', () => {
    const { panels } = autoPlacePanels([makeBarChart('bar-1'), makeMetric('metric-1')]);

    expect(panels['bar-1']).toMatchObject({ column: 0, row: 0, width: 24, height: 15 });
    expect(panels['metric-1']).toMatchObject({ column: 24, row: 0, width: 24, height: 10 });
  });

  it('splits three charts evenly while preserving heights', () => {
    const { panels, nextRow } = autoPlacePanels([
      makeBarChart('bar-1'),
      makeMetric('metric-1'),
      makeMetric('metric-2'),
    ]);

    expect(panels['bar-1']).toMatchObject({ column: 0, row: 0, width: 16, height: 15 });
    expect(panels['metric-1']).toMatchObject({ column: 16, row: 0, width: 16, height: 10 });
    expect(panels['metric-2']).toMatchObject({ column: 32, row: 0, width: 16, height: 10 });
    expect(nextRow).toBe(15);
  });
});

describe('buildAutoGridLayout', () => {
  it('balances section panels independently of top-level panels', () => {
    const section: SectionConfig = {
      id: 'sec-1',
      title: 'KPIs',
      collapsed: false,
      panelIds: ['metric-1', 'metric-2'],
    };

    const layout = buildAutoGridLayout(
      [makeBarChart('bar-1'), makeMetric('metric-1'), makeMetric('metric-2')],
      [section]
    );

    expect(layout['bar-1']).toMatchObject({
      type: 'panel',
      column: 0,
      row: 0,
      width: 48,
      height: 15,
    });
    expect(layout['sec-1']).toMatchObject({
      type: 'section',
      row: 15,
      title: 'KPIs',
    });
    const sectionLayout = layout['sec-1'];
    expect(sectionLayout.type).toBe('section');
    if (sectionLayout.type !== 'section') {
      throw new Error('Expected a section layout');
    }

    expect(sectionLayout.panels['metric-1']).toMatchObject({
      column: 0,
      row: 0,
      width: 24,
      height: 10,
    });
    expect(sectionLayout.panels['metric-2']).toMatchObject({
      column: 24,
      row: 0,
      width: 24,
      height: 10,
    });
  });
});

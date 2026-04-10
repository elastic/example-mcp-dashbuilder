/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { translateDashboardToSavedObject } from './dashboard-translator.js';
import type { DashboardConfig, ChartConfig, MetricConfig } from '../types.js';

function makeDashboard(overrides?: Partial<DashboardConfig>): DashboardConfig {
  return {
    title: 'Test Dashboard',
    charts: [],
    sections: [],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const barChart: ChartConfig = {
  id: 'bar-1',
  title: 'Revenue',
  chartType: 'bar',
  esqlQuery: 'FROM ecommerce | STATS revenue = SUM(price) BY category',
  xField: 'category',
  yFields: ['revenue'],
};

const metric: MetricConfig = {
  id: 'metric-1',
  title: 'Total Orders',
  chartType: 'metric',
  valueField: 'total',
  esqlQuery: 'FROM ecommerce | STATS total = COUNT(*)',
};

function makeMetric(id: string): MetricConfig {
  return {
    ...metric,
    id,
    title: `Metric ${id}`,
  };
}

describe('translateDashboardToSavedObject', () => {
  it('produces valid attributes with title and panelsJSON', () => {
    const config = makeDashboard({ charts: [barChart] });
    const { attributes } = translateDashboardToSavedObject(config);

    expect(attributes.title).toBe('Test Dashboard');
    expect(typeof attributes.panelsJSON).toBe('string');

    const panels = JSON.parse(attributes.panelsJSON as string);
    expect(panels).toHaveLength(1);
    expect(panels[0].type).toBe('lens');
    expect(panels[0].gridData).toMatchObject({ x: 0, y: 0, w: 48, h: 15 });
  });

  it('evenly distributes two charts across the row', () => {
    const config = makeDashboard({ charts: [barChart, metric] });
    const { attributes } = translateDashboardToSavedObject(config);
    const panels = JSON.parse(attributes.panelsJSON as string);

    expect(panels[0].gridData).toMatchObject({ x: 0, y: 0, w: 24, h: 15 });
    expect(panels[1].gridData).toMatchObject({ x: 24, y: 0, w: 24, h: 10 });
  });

  it('evenly distributes three charts in the same row while preserving heights', () => {
    const config = makeDashboard({ charts: [barChart, metric, makeMetric('metric-2')] });
    const { attributes } = translateDashboardToSavedObject(config);
    const panels = JSON.parse(attributes.panelsJSON as string);

    expect(panels[0].gridData).toMatchObject({ x: 0, y: 0, w: 16, h: 15 });
    expect(panels[1].gridData).toMatchObject({ x: 16, y: 0, w: 16, h: 10 });
    expect(panels[2].gridData).toMatchObject({ x: 32, y: 0, w: 16, h: 10 });
  });

  it('uses gridLayout positions when provided', () => {
    const config = makeDashboard({
      charts: [barChart],
      gridLayout: {
        'bar-1': { type: 'panel', column: 10, row: 5, width: 30, height: 20 },
      },
    });
    const { attributes } = translateDashboardToSavedObject(config);
    const panels = JSON.parse(attributes.panelsJSON as string);

    expect(panels[0].gridData.x).toBe(10);
    expect(panels[0].gridData.y).toBe(5);
    expect(panels[0].gridData.w).toBe(30);
    expect(panels[0].gridData.h).toBe(20);
  });

  it('balances section panels using the same row logic', () => {
    const config = makeDashboard({
      charts: [barChart, metric, makeMetric('metric-2')],
      sections: [
        {
          id: 'sec-1',
          title: 'Revenue Section',
          collapsed: false,
          panelIds: ['metric-1', 'metric-2'],
        },
      ],
    });
    const { attributes } = translateDashboardToSavedObject(config);
    const panels = JSON.parse(attributes.panelsJSON as string);
    const sectionPanels = panels.filter(
      (panel: { gridData: { sectionId?: string } }) => panel.gridData.sectionId === 'sec-1'
    );

    expect(attributes.sections).toBeDefined();
    const sections = attributes.sections as Array<{ title: string; gridData: { y: number } }>;
    expect(sections[0].title).toBe('Revenue Section');
    expect(sections[0].gridData.y).toBe(15);
    expect(sectionPanels).toHaveLength(2);
    expect(sectionPanels[0].gridData).toMatchObject({
      x: 0,
      y: 0,
      w: 24,
      h: 10,
      sectionId: 'sec-1',
    });
    expect(sectionPanels[1].gridData).toMatchObject({
      x: 24,
      y: 0,
      w: 24,
      h: 10,
      sectionId: 'sec-1',
    });
  });

  it('embeds Lens attributes in each panel', () => {
    const config = makeDashboard({ charts: [barChart] });
    const { attributes } = translateDashboardToSavedObject(config);
    const panels = JSON.parse(attributes.panelsJSON as string);
    const lensAttrs = panels[0].embeddableConfig.attributes;

    expect(lensAttrs.visualizationType).toBe('lnsXY');
    expect(lensAttrs.state.query.esql).toBe(barChart.esqlQuery);
  });

  it('passes time field context when timeFieldMap provided', () => {
    const config = makeDashboard({ charts: [barChart] });
    const timeFieldMap = new Map([['ecommerce', '@timestamp']]);
    const { attributes } = translateDashboardToSavedObject(config, timeFieldMap);
    const panels = JSON.parse(attributes.panelsJSON as string);
    const lensAttrs = panels[0].embeddableConfig.attributes;

    expect(lensAttrs.adHocDataViews).toBeDefined();
    const views = Object.values(lensAttrs.adHocDataViews) as Array<{ timeFieldName: string }>;
    expect(views[0].timeFieldName).toBe('@timestamp');
  });

  it('returns empty references array', () => {
    const config = makeDashboard({ charts: [barChart] });
    const { references } = translateDashboardToSavedObject(config);
    expect(references).toEqual([]);
  });
});

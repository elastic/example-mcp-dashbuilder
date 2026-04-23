/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import {
  buildKibanaConsole,
  buildJupyterNotebook,
  buildKibanaNdjson,
  pandasVisualization,
} from './export-queries.js';
import type {
  ChartConfig,
  DashboardConfig,
  HeatmapConfig,
  MetricConfig,
  PanelConfig,
} from '../types.js';

const barChart: ChartConfig = {
  id: 'bar-1',
  title: 'Revenue by category',
  chartType: 'bar',
  esqlQuery: 'FROM ecommerce\n| STATS revenue = SUM(price) BY category',
  xField: 'category',
  yFields: ['revenue'],
  timeField: 'order_date',
};

const metric: MetricConfig = {
  id: 'metric-1',
  title: 'Total orders',
  chartType: 'metric',
  valueField: 'total',
  esqlQuery: 'FROM ecommerce | STATS total = COUNT(*)',
  timeField: 'order_date',
};

const metricWithTrend: MetricConfig = {
  ...metric,
  id: 'metric-2',
  trendEsqlQuery: 'FROM ecommerce | STATS total = COUNT(*) BY BUCKET(order_date, 1 day)',
  trendXField: 'order_date',
  trendYField: 'total',
};

const heatmap: HeatmapConfig = {
  id: 'heatmap-1',
  title: 'Orders heatmap',
  chartType: 'heatmap',
  esqlQuery: 'FROM ecommerce | STATS c = COUNT(*) BY day, hour',
  xField: 'hour',
  yField: 'day',
  valueField: 'c',
  timeField: 'order_date',
};

function makeDashboard(charts: PanelConfig[], title = 'Test Dashboard'): DashboardConfig {
  return {
    title,
    charts,
    sections: [],
    updatedAt: '2026-04-20T00:00:00.000Z',
  };
}

describe('buildKibanaConsole', () => {
  it('includes the dashboard title as a header comment', () => {
    const out = buildKibanaConsole([barChart], 'My Dashboard');
    expect(out.startsWith('# My Dashboard')).toBe(true);
  });

  it('emits POST /_query for each chart with JSON-encoded query', () => {
    const out = buildKibanaConsole([barChart, metric], 'D');
    const postCount = (out.match(/^POST \/_query$/gm) || []).length;
    expect(postCount).toBe(2);
    expect(out).toContain(JSON.stringify(barChart.esqlQuery));
    expect(out).toContain(JSON.stringify(metric.esqlQuery));
  });

  it('emits an additional block for a metric trend query', () => {
    const out = buildKibanaConsole([metricWithTrend], 'D');
    expect((out.match(/^POST \/_query$/gm) || []).length).toBe(2);
    expect(out).toContain(JSON.stringify(metricWithTrend.trendEsqlQuery));
    expect(out).toContain('trend sparkline');
  });
});

describe('pandasVisualization', () => {
  it('escapes user-controlled strings as Python literals', () => {
    const tricky: ChartConfig = {
      ...barChart,
      title: 'My "tricky" title',
      xField: 'field with spaces',
    };
    const { code } = pandasVisualization(tricky);
    expect(code).toContain('"My \\"tricky\\" title"');
    expect(code).toContain('"field with spaces"');
  });

  it('renders metrics as an HTML card without matplotlib', () => {
    const { code, usesMatplotlib } = pandasVisualization(metric);
    expect(usesMatplotlib).toBe(false);
    expect(code).toContain('from IPython.display import HTML, display');
    expect(code).toContain('from html import escape');
    expect(code).toContain('{escape(str(value))}');
    expect(code).toContain('Total orders');
    expect(code).not.toContain('import seaborn');
  });

  it('html-escapes the metric title to prevent HTML injection', () => {
    const xssMetric: MetricConfig = { ...metric, title: '<script>alert(1)</script>' };
    const { code } = pandasVisualization(xssMetric);
    expect(code).not.toContain('<script>');
    expect(code).toContain('&lt;script&gt;');
  });

  it('renders heatmaps with matplotlib imshow (no seaborn)', () => {
    const { code, usesMatplotlib } = pandasVisualization(heatmap);
    expect(usesMatplotlib).toBe(true);
    expect(code).toContain('ax.imshow');
    expect(code).toContain('fig.colorbar');
    expect(code).not.toContain('seaborn');
  });
});

describe('buildJupyterNotebook', () => {
  it('produces a parseable ipynb with nbformat 4', () => {
    const nb = JSON.parse(buildJupyterNotebook([barChart], 'My Dashboard'));
    expect(nb.nbformat).toBe(4);
    expect(nb.nbformat_minor).toBe(5);
    expect(Array.isArray(nb.cells)).toBe(true);
  });

  it('first cell is a markdown title with the dashboard name', () => {
    const nb = JSON.parse(buildJupyterNotebook([barChart], 'My Dashboard'));
    expect(nb.cells[0].cell_type).toBe('markdown');
    expect(nb.cells[0].source.join('')).toContain('My Dashboard');
  });

  it('setup cell loads .env and reads credentials from env at runtime, never baking literals', () => {
    const prevKey = process.env.ES_API_KEY;
    process.env.ES_API_KEY = 'secret-key-should-not-leak';
    try {
      const nb = JSON.parse(buildJupyterNotebook([barChart], 'D'));
      const setup = nb.cells[1].source.join('');
      expect(setup).toContain('_load_dotenv');
      expect(setup).toContain('read_text');
      expect(setup).toContain('os.environ.get("ES_API_KEY")');
      expect(setup).not.toContain('secret-key-should-not-leak');
    } finally {
      if (prevKey === undefined) delete process.env.ES_API_KEY;
      else process.env.ES_API_KEY = prevKey;
    }
  });

  it('emits markdown + code cells for each chart', () => {
    const nb = JSON.parse(buildJupyterNotebook([barChart, heatmap], 'D'));
    // title + setup + (markdown+code) × 2
    expect(nb.cells.length).toBe(2 + 2 * 2);
  });

  it('adds a trend cell for metrics with trendEsqlQuery', () => {
    const nb = JSON.parse(buildJupyterNotebook([metricWithTrend], 'D'));
    // title + setup + markdown + value cell + trend cell
    expect(nb.cells.length).toBe(5);
    const trendSource = nb.cells[4].source.join('');
    expect(trendSource).toContain('trend sparkline');
    expect(trendSource).toContain(metricWithTrend.trendEsqlQuery!);
    expect(trendSource).toContain('trend_df.plot(x=');
    expect(trendSource).toContain('y=');
    expect(trendSource).toContain(JSON.stringify(metricWithTrend.trendXField));
    expect(trendSource).toContain(JSON.stringify(metricWithTrend.trendYField));
  });

  it('trend cell falls back to title-only plot when trend x/y are missing', () => {
    const noAxes: MetricConfig = {
      ...metricWithTrend,
      trendXField: undefined,
      trendYField: undefined,
    };
    const nb = JSON.parse(buildJupyterNotebook([noAxes], 'D'));
    const trendSource = nb.cells[4].source.join('');
    expect(trendSource).toContain('trend_df.plot(title=');
    expect(trendSource).not.toContain('trend_df.plot(x=');
  });

  it('strips newlines from chart titles so they cannot escape Python comments', () => {
    const evil: MetricConfig = {
      ...metricWithTrend,
      title: "Evil\n__import__('os').system('ls') #",
    };
    const nb = JSON.parse(buildJupyterNotebook([evil], 'D'));
    const trendSource: string = nb.cells[4].source.join('');
    // The trend cell comment must stay on a single line — no extra lines starting with `#`.
    const commentLines = trendSource.split('\n').filter((l: string) => l.startsWith('#'));
    expect(commentLines).toHaveLength(1);
    expect(commentLines[0]).toContain('trend sparkline');
  });

  it('escapes triple-quotes in ES|QL queries so they cannot break out of the Python block', () => {
    const regexChart: ChartConfig = {
      ...barChart,
      esqlQuery:
        'FROM logs | WHERE msg LIKE """.*""" | STATS c = COUNT(*)\n"""; __import__("os").system("ls") #',
    };
    const nb = JSON.parse(buildJupyterNotebook([regexChart], 'D'));
    const querySource: string = nb.cells[3].source.join('');
    // Only two raw `"""` sequences should survive: the query block open and close.
    // Every `"""` from the user's ES|QL body must be escaped to `\"\"\"`.
    const tripleQuoteCount = (querySource.match(/"""/g) || []).length;
    expect(tripleQuoteCount).toBe(2);
    expect(querySource).toContain('\\"\\"\\".*\\"\\"\\"');
  });
});

describe('buildKibanaNdjson', () => {
  it('returns a saved-object line and a summary line', async () => {
    const dashboard = makeDashboard([barChart, metric], 'My Dashboard');
    const ndjson = await buildKibanaNdjson(dashboard);
    const lines = ndjson.trim().split('\n');
    expect(lines).toHaveLength(2);

    const savedObject = JSON.parse(lines[0]);
    expect(savedObject.type).toBe('dashboard');
    expect(typeof savedObject.id).toBe('string');
    expect(savedObject.attributes.title).toBe('My Dashboard');
    expect(Array.isArray(savedObject.references)).toBe(true);

    const summary = JSON.parse(lines[1]);
    expect(summary).toMatchObject({
      exportedCount: 1,
      missingRefCount: 0,
      missingReferences: [],
      excludedObjectsCount: 0,
    });
  });

  it('uses an explicit chart.timeField without calling ES', async () => {
    // timeField is set on every fixture — if detectTimeField were reached it would
    // throw because no ES client is configured in the test env. Passing here proves
    // the fast path is taken.
    const dashboard = makeDashboard([barChart], 'D');
    const ndjson = await buildKibanaNdjson(dashboard);
    expect(ndjson).toContain('"type":"dashboard"');
  });
});

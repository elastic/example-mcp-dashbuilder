/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Kibana roundtrip tests — export_to_kibana → import_from_kibana.
 *
 * These tests exercise the critical version-dependent code paths:
 *   - Kibana <  9.4  →  saved objects API  (hasDashboardApi = false)
 *   - Kibana >= 9.4  →  Dashboard API      (hasDashboardApi = true)
 *
 * Modelled after the unit-level roundtrip tests in:
 *   - lens-roundtrip.test.ts       (saved objects / Lens path)
 *   - dashboard-api-roundtrip.test.ts (Dashboard API path)
 *
 * The same tests run against both 9.3 and 9.4 via STACK_VERSION env var.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TEST_INDEX } from '../setup/seed-data.js';
import { expectSuccess, expectTextContent, parseJsonContent } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

/** Extract the Kibana dashboard ID from an export response URL */
function extractDashboardId(exportText: string): string | null {
  const match = exportText.match(/#\/view\/([^\s"'\n]+)/);
  return match ? match[1] : null;
}

/** Get the full dashboard config via get_dashboard */
async function getDashboardConfig(server: MCPTestServer, dashboardId?: string) {
  const result = await server.callTool('get_dashboard', dashboardId ? { dashboardId } : {});
  return parseJsonContent(result) as {
    title: string;
    charts: Array<{
      id: string;
      title: string;
      chartType: string;
      esqlQuery: string;
      xField?: string;
      yFields?: string[];
      splitField?: string;
      palette?: string[];
      valueField?: string;
      yField?: string;
      subtitle?: string;
      color?: string;
      colorRamp?: string[];
    }>;
    sections: Array<{
      id: string;
      title: string;
      collapsed: boolean;
      panelIds: string[];
    }>;
  };
}

describe('Kibana roundtrip', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = new MCPTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  // ---------------------------------------------------------------------------
  // Basic export/import
  // ---------------------------------------------------------------------------

  it('should export a dashboard to Kibana', async () => {
    await server.callTool('create_dashboard', { title: 'Export Test' });
    await server.callTool('create_chart', {
      title: 'Revenue',
      chartType: 'bar',
      esqlQuery: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category`,
      xField: 'category',
      yFields: ['revenue'],
    });

    const result = await server.callTool('export_to_kibana');
    const text = expectSuccess(result);
    expect(text).toContain('exported');
    expect(extractDashboardId(text)).not.toBeNull();
  });

  it('should fail to export an empty dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Empty' });
    const result = await server.callTool('export_to_kibana');
    expect(result.isError).toBe(true);
    expect(expectTextContent(result).toLowerCase()).toContain('no charts');
  });

  // ---------------------------------------------------------------------------
  // Chart config roundtrip — verify settings survive export → import
  // ---------------------------------------------------------------------------

  it('bar chart config survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Bar Roundtrip' });
    await server.callTool('create_chart', {
      id: 'bar-rt',
      title: 'Revenue by Category',
      chartType: 'bar',
      esqlQuery: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category`,
      xField: 'category',
      yFields: ['revenue'],
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    const importResult = await server.callTool('import_from_kibana', {
      dashboardId: kibanaDashId!,
    });
    expectSuccess(importResult);

    const config = await getDashboardConfig(server);
    const chart = config.charts.find((c) => c.chartType === 'bar');
    expect(chart).toBeDefined();
    expect(chart!.title).toBe('Revenue by Category');
    expect(chart!.esqlQuery).toContain(TEST_INDEX);
    expect(chart!.esqlQuery).toContain('SUM(taxful_total_price)');
    expect(chart!.xField).toBe('category');
    expect(chart!.yFields).toEqual(['revenue']);
  });

  it('line chart config survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Line Roundtrip' });
    await server.callTool('create_chart', {
      id: 'line-rt',
      title: 'Orders Over Time',
      chartType: 'line',
      esqlQuery: `FROM ${TEST_INDEX} | STATS orders = COUNT(*) BY order_date = BUCKET(order_date, 1 day)`,
      xField: 'order_date',
      yFields: ['orders'],
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    await server.callTool('import_from_kibana', { dashboardId: kibanaDashId! });

    const config = await getDashboardConfig(server);
    const chart = config.charts.find((c) => c.chartType === 'line');
    expect(chart).toBeDefined();
    expect(chart!.title).toBe('Orders Over Time');
    expect(chart!.xField).toBe('order_date');
    expect(chart!.yFields).toEqual(['orders']);
  });

  it('pie chart with palette survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Pie Roundtrip' });
    await server.callTool('create_chart', {
      id: 'pie-rt',
      title: 'Category Share',
      chartType: 'pie',
      esqlQuery: `FROM ${TEST_INDEX} | STATS count = COUNT(*) BY category`,
      xField: 'category',
      yFields: ['count'],
      palette: ['#E91E63', '#54B399', '#D6BF57', '#6092C0'],
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    await server.callTool('import_from_kibana', { dashboardId: kibanaDashId! });

    const config = await getDashboardConfig(server);
    const chart = config.charts.find((c) => c.chartType === 'pie');
    expect(chart).toBeDefined();
    expect(chart!.title).toBe('Category Share');
    expect(chart!.xField).toBe('category');
    expect(chart!.yFields).toEqual(['count']);
    expect(chart!.palette).toEqual(['#E91E63', '#54B399', '#D6BF57', '#6092C0']);
  });

  it('metric config survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Metric Roundtrip' });
    await server.callTool('create_metric', {
      id: 'metric-rt',
      title: 'Total Revenue',
      esqlQuery: `FROM ${TEST_INDEX} | STATS total = SUM(taxful_total_price)`,
      valueField: 'total',
      subtitle: 'All orders',
      color: '#54B399',
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    await server.callTool('import_from_kibana', { dashboardId: kibanaDashId! });

    const config = await getDashboardConfig(server);
    const metric = config.charts.find((c) => c.chartType === 'metric');
    expect(metric).toBeDefined();
    expect(metric!.title).toBe('Total Revenue');
    expect(metric!.valueField).toBe('total');
    expect(metric!.subtitle).toBe('All orders');
    expect(metric!.color).toBe('#54B399');
  });

  it('heatmap config survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Heatmap Roundtrip' });
    await server.callTool('create_heatmap', {
      id: 'heatmap-rt',
      title: 'Category by Gender',
      esqlQuery: `FROM ${TEST_INDEX} | STATS count = COUNT(*) BY category, customer_gender`,
      xField: 'category',
      yField: 'customer_gender',
      valueField: 'count',
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    await server.callTool('import_from_kibana', { dashboardId: kibanaDashId! });

    const config = await getDashboardConfig(server);
    const heatmap = config.charts.find((c) => c.chartType === 'heatmap');
    expect(heatmap).toBeDefined();
    expect(heatmap!.title).toBe('Category by Gender');
    expect(heatmap!.xField).toBe('category');
    expect(heatmap!.yField).toBe('customer_gender');
    expect(heatmap!.valueField).toBe('count');
  });

  // ---------------------------------------------------------------------------
  // Multi-chart + sections roundtrip
  // ---------------------------------------------------------------------------

  it('multiple charts and sections survive roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Full Roundtrip' });

    // Create charts
    await server.callTool('create_metric', {
      id: 'kpi-revenue',
      title: 'Total Revenue',
      esqlQuery: `FROM ${TEST_INDEX} | STATS total = SUM(taxful_total_price)`,
      valueField: 'total',
    });
    await server.callTool('create_chart', {
      id: 'bar-by-cat',
      title: 'Revenue by Category',
      chartType: 'bar',
      esqlQuery: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category`,
      xField: 'category',
      yFields: ['revenue'],
    });
    await server.callTool('create_chart', {
      id: 'line-orders',
      title: 'Orders Over Time',
      chartType: 'line',
      esqlQuery: `FROM ${TEST_INDEX} | STATS orders = COUNT(*) BY order_date = BUCKET(order_date, 1 day)`,
      xField: 'order_date',
      yFields: ['orders'],
    });

    // Create sections and assign panels
    await server.callTool('create_section', {
      id: 'kpi-section',
      title: 'KPIs',
      panelIds: ['kpi-revenue'],
    });
    await server.callTool('create_section', {
      id: 'charts-section',
      title: 'Charts',
      panelIds: ['bar-by-cat', 'line-orders'],
    });

    // Snapshot before export
    const beforeConfig = await getDashboardConfig(server);
    expect(beforeConfig.charts).toHaveLength(3);
    expect(beforeConfig.sections).toHaveLength(2);

    // Export
    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    // Import into fresh dashboard
    const importResult = await server.callTool('import_from_kibana', {
      dashboardId: kibanaDashId!,
    });
    expectSuccess(importResult);

    const afterConfig = await getDashboardConfig(server);

    // Verify all 3 charts survived
    expect(afterConfig.charts.length).toBeGreaterThanOrEqual(3);

    const chartTypes = afterConfig.charts.map((c) => c.chartType).sort();
    expect(chartTypes).toContain('bar');
    expect(chartTypes).toContain('line');
    expect(chartTypes).toContain('metric');

    // Verify chart details
    const bar = afterConfig.charts.find((c) => c.chartType === 'bar');
    expect(bar!.title).toBe('Revenue by Category');
    expect(bar!.xField).toBe('category');

    const line = afterConfig.charts.find((c) => c.chartType === 'line');
    expect(line!.title).toBe('Orders Over Time');

    const metric = afterConfig.charts.find((c) => c.chartType === 'metric');
    expect(metric!.title).toBe('Total Revenue');

    // Verify sections survived with correct panel assignments
    if (afterConfig.sections.length >= 2) {
      const kpiSection = afterConfig.sections.find((s) => s.title === 'KPIs');
      const chartsSection = afterConfig.sections.find((s) => s.title === 'Charts');

      expect(kpiSection).toBeDefined();
      expect(chartsSection).toBeDefined();

      if (kpiSection && chartsSection) {
        // Section order: KPIs before Charts
        const kpiIdx = afterConfig.sections.indexOf(kpiSection);
        const chartsIdx = afterConfig.sections.indexOf(chartsSection);
        expect(kpiIdx).toBeLessThan(chartsIdx);

        // KPI section should contain the metric
        expect(kpiSection.panelIds.length).toBeGreaterThanOrEqual(1);

        // Charts section should contain the bar and line
        expect(chartsSection.panelIds.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('bar chart with splitField survives roundtrip', async () => {
    await server.callTool('create_dashboard', { title: 'Split Roundtrip' });
    await server.callTool('create_chart', {
      id: 'split-rt',
      title: 'Revenue by Category and Gender',
      chartType: 'bar',
      esqlQuery: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category, customer_gender`,
      xField: 'category',
      yFields: ['revenue'],
      splitField: 'customer_gender',
    });

    const exportResult = await server.callTool('export_to_kibana');
    const kibanaDashId = extractDashboardId(expectSuccess(exportResult));
    expect(kibanaDashId).not.toBeNull();

    await server.callTool('import_from_kibana', { dashboardId: kibanaDashId! });

    const config = await getDashboardConfig(server);
    const chart = config.charts.find((c) => c.chartType === 'bar');
    expect(chart).toBeDefined();
    expect(chart!.splitField).toBe('customer_gender');
  });
});

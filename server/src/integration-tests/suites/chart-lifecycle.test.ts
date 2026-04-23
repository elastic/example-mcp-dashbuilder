/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SAMPLE_BAR_CHART_ARGS,
  SAMPLE_LINE_CHART_ARGS,
} from '../__fixtures__/dashboard-factory.js';
import { expectSuccess, expectTextContent } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('Chart lifecycle', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = new MCPTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should create a dashboard and return its ID', async () => {
    const result = await server.callTool('create_dashboard', {
      title: 'Test Dashboard',
    });
    const text = expectSuccess(result);
    expect(text).toContain('Test Dashboard');
    expect(text).toContain('created');
  });

  it('should create a bar chart on a dashboard', async () => {
    // Create dashboard first
    await server.callTool('create_dashboard', { title: 'Chart Test' });

    // Create chart
    const result = await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);
    const text = expectSuccess(result);
    expect(text).toContain('Revenue by Category');
  });

  it('should create a line chart on a dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Line Chart Test' });

    const result = await server.callTool('create_chart', SAMPLE_LINE_CHART_ARGS);
    const text = expectSuccess(result);
    expect(text).toContain('Orders Over Time');
  });

  it('should view a dashboard with its charts', async () => {
    await server.callTool('create_dashboard', { title: 'View Test' });
    await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);

    // view_dashboard returns a summary; get_dashboard returns full config
    const viewResult = await server.callTool('view_dashboard');
    const viewText = expectSuccess(viewResult);
    expect(viewText).toContain('View Test');
    expect(viewText).toContain('1 chart');

    const getResult = await server.callTool('get_dashboard');
    const getText = expectSuccess(getResult);
    expect(getText).toContain('Revenue by Category');
  });

  it('should create multiple charts on one dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Multi Chart' });
    await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);
    await server.callTool('create_chart', SAMPLE_LINE_CHART_ARGS);

    const getResult = await server.callTool('get_dashboard');
    const text = expectSuccess(getResult);
    expect(text).toContain('Revenue by Category');
    expect(text).toContain('Orders Over Time');
  });

  it('should remove a chart from the dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Remove Test' });
    const chartResult = await server.callTool('create_chart', {
      ...SAMPLE_BAR_CHART_ARGS,
      id: 'chart-to-remove',
    });
    expectSuccess(chartResult);

    const removeResult = await server.callTool('remove_chart', { chartId: 'chart-to-remove' });
    expectSuccess(removeResult);

    const viewResult = await server.callTool('view_dashboard');
    const text = expectTextContent(viewResult);
    expect(text).not.toContain('Revenue by Category');
  });

  it('should handle chart creation with invalid ES|QL gracefully', async () => {
    await server.callTool('create_dashboard', { title: 'Error Test' });

    const result = await server.callTool('create_chart', {
      ...SAMPLE_BAR_CHART_ARGS,
      esqlQuery: 'INVALID SYNTAX',
    });
    const text = expectTextContent(result);
    // Should return an error message, not crash
    expect(text.toLowerCase()).toMatch(/error|failed|invalid|parse/);
  });
});

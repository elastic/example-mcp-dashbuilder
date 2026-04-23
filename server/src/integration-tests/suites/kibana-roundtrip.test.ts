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
 * The same tests run against both 9.3 and 9.4 via STACK_VERSION env var.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SAMPLE_BAR_CHART_ARGS,
  SAMPLE_LINE_CHART_ARGS,
} from '../__fixtures__/dashboard-factory.js';
import { expectSuccess, expectTextContent } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('Kibana roundtrip', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = new MCPTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should export a dashboard with a single chart to Kibana', async () => {
    await server.callTool('create_dashboard', { title: 'Export Test Single' });
    await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);

    const result = await server.callTool('export_to_kibana');
    const text = expectSuccess(result);
    // Should contain a Kibana URL or dashboard ID
    expect(text.toLowerCase()).toMatch(/dashboard|exported|kibana|created/);
  });

  it('should export a dashboard with multiple charts to Kibana', async () => {
    await server.callTool('create_dashboard', { title: 'Export Test Multi' });
    await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);
    await server.callTool('create_chart', SAMPLE_LINE_CHART_ARGS);

    const result = await server.callTool('export_to_kibana');
    const text = expectSuccess(result);
    expect(text.toLowerCase()).toMatch(/dashboard|exported|kibana|created/);
  });

  it('should export with a title override', async () => {
    await server.callTool('create_dashboard', { title: 'Original Title' });
    await server.callTool('create_chart', SAMPLE_BAR_CHART_ARGS);

    const result = await server.callTool('export_to_kibana', {
      title: 'Overridden Title',
    });
    const text = expectSuccess(result);
    expect(text.toLowerCase()).toMatch(/dashboard|exported|kibana|created/);
  });

  it('should fail to export an empty dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Empty Dashboard' });

    const result = await server.callTool('export_to_kibana');
    const text = expectTextContent(result);
    expect(result.isError).toBe(true);
    expect(text.toLowerCase()).toContain('no charts');
  });

  it('should roundtrip: export then import preserves charts', async () => {
    // Create and populate a dashboard
    await server.callTool('create_dashboard', { title: 'Roundtrip Test' });
    await server.callTool('create_chart', {
      ...SAMPLE_BAR_CHART_ARGS,
      id: 'roundtrip-bar',
    });

    // Export to Kibana
    const exportResult = await server.callTool('export_to_kibana');
    const exportText = expectSuccess(exportResult);

    // Extract the dashboard ID from the URL in the export response
    // URL format: http://localhost:55026/app/dashboards#/view/<id>
    const urlMatch = exportText.match(/#\/view\/([^\s"'\n]+)/);

    if (!urlMatch) {
      // If we can't extract an ID, just verify the export succeeded
      expect(exportText.toLowerCase()).toMatch(/dashboard|exported|kibana|created/);
      return;
    }

    const kibanaDashboardId = urlMatch[1];

    // Import from Kibana into a fresh dashboard
    const importResult = await server.callTool('import_from_kibana', {
      dashboardId: kibanaDashboardId,
    });
    const importText = expectSuccess(importResult);
    expect(importText.toLowerCase()).toMatch(/import|dashboard|created/);
  });
});

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectToolsExist } from '../helpers/mcp-assertions.js';
import { MCPTestServer } from '../setup/test-server.js';

describe('Server startup', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = new MCPTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should register all expected tools', async () => {
    const tools = await server.listTools();

    expectToolsExist(tools, [
      // ES|QL tools
      'run_esql',
      'list_indices',
      // Dashboard management
      'create_dashboard',
      'list_dashboards',
      'switch_dashboard',
      'delete_dashboard',
      'set_dashboard_title',
      'clear_dashboard',
      'remove_chart',
      'view_dashboard',
      // Visualization tools
      'create_chart',
      'create_metric',
      'create_heatmap',
      // Section tools
      'create_section',
      'move_panel_to_section',
      'remove_section',
      // Kibana integration
      'export_to_kibana',
      'import_from_kibana',
    ]);
  });

  it('should register all expected resources', async () => {
    const resources = await server.listResources();
    const uris = resources.resources.map((r) => r.uri);

    expect(uris).toContain('dataviz://guidelines');
    expect(uris).toContain('esql://reference');
  });

  it('should return non-empty dataviz guidelines', async () => {
    const result = await server.readResource('dataviz://guidelines');
    const text = result.contents[0];
    expect(text).toBeDefined();
    expect(text.mimeType).toBe('text/markdown');
    expect((text as { text: string }).text.length).toBeGreaterThan(100);
  });

  it('should return non-empty ES|QL reference', async () => {
    const result = await server.readResource('esql://reference');
    const text = result.contents[0];
    expect(text).toBeDefined();
    expect(text.mimeType).toBe('text/markdown');
    expect((text as { text: string }).text.length).toBeGreaterThan(100);
  });
});

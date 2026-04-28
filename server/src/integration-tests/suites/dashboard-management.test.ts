/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expectSuccess, expectTextContent } from '../helpers/mcp-assertions.js';
import { createTestServer } from '../setup/create-test-server.js';
import type { MCPTestServer } from '../setup/test-server-interface.js';

describe('Dashboard management', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = createTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should list dashboards', async () => {
    await server.callTool('create_dashboard', { title: 'Dashboard A' });
    await server.callTool('create_dashboard', { title: 'Dashboard B' });

    const result = await server.callTool('list_dashboards');
    const text = expectSuccess(result);
    expect(text).toContain('Dashboard A');
    expect(text).toContain('Dashboard B');
  });

  it('should rename a dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Old Title' });

    const result = await server.callTool('set_dashboard_title', { title: 'New Title' });
    const text = expectSuccess(result);
    expect(text).toContain('New Title');
  });

  it('should switch between dashboards', async () => {
    const createA = await server.callTool('create_dashboard', { title: 'Dash A', id: 'dash-a' });
    expectSuccess(createA);

    await server.callTool('create_dashboard', { title: 'Dash B', id: 'dash-b' });

    // Switch back to A
    const switchResult = await server.callTool('switch_dashboard', { id: 'dash-a' });
    const text = expectSuccess(switchResult);
    expect(text).toContain('Dash A');
  });

  it('should delete a dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Keep', id: 'keep' });
    await server.callTool('create_dashboard', { title: 'Delete Me', id: 'delete-me' });

    const result = await server.callTool('delete_dashboard', { id: 'delete-me' });
    const text = expectSuccess(result);
    expect(text.toLowerCase()).toContain('delete');

    // Verify it's gone
    const listResult = await server.callTool('list_dashboards');
    const listText = expectTextContent(listResult);
    expect(listText).not.toContain('Delete Me');
  });

  it('should clear a dashboard', async () => {
    await server.callTool('create_dashboard', { title: 'Clear Test' });

    const result = await server.callTool('clear_dashboard');
    const text = expectSuccess(result);
    expect(text.toLowerCase()).toContain('clear');
  });
});

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SAMPLE_BAR_CHART_ARGS } from '../__fixtures__/dashboard-factory.js';
import { expectSuccess } from '../helpers/mcp-assertions.js';
import { createTestServer } from '../setup/create-test-server.js';

describe('Section tools', () => {
  let server: ReturnType<typeof createTestServer>;

  beforeEach(async () => {
    server = createTestServer();
    await server.start();
    await server.callTool('create_dashboard', { title: 'Section Test' });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should create a section', async () => {
    const result = await server.callTool('create_section', {
      id: 'overview-section',
      title: 'Overview',
    });
    const text = expectSuccess(result);
    expect(text).toContain('Overview');
  });

  it('should move a panel into a section', async () => {
    // Create a chart first
    await server.callTool('create_chart', {
      ...SAMPLE_BAR_CHART_ARGS,
      id: 'revenue-chart',
    });

    // Create a section
    await server.callTool('create_section', {
      id: 'metrics-section',
      title: 'Metrics',
    });

    // Move chart into section
    const result = await server.callTool('move_panel_to_section', {
      panelId: 'revenue-chart',
      sectionId: 'metrics-section',
    });
    const text = expectSuccess(result);
    expect(text).toContain('revenue-chart');
    expect(text).toContain('metrics-section');
  });

  it('should create a section with initial panel IDs', async () => {
    await server.callTool('create_chart', {
      ...SAMPLE_BAR_CHART_ARGS,
      id: 'chart-in-section',
    });

    const result = await server.callTool('create_section', {
      id: 'pre-populated',
      title: 'Pre-populated Section',
      panelIds: ['chart-in-section'],
    });
    const text = expectSuccess(result);
    expect(text).toContain('Pre-populated Section');
  });

  it('should remove a section', async () => {
    await server.callTool('create_section', {
      id: 'temp-section',
      title: 'Temporary',
    });

    const result = await server.callTool('remove_section', {
      sectionId: 'temp-section',
    });
    const text = expectSuccess(result);
    expect(text.toLowerCase()).toContain('temp-section');
  });
});

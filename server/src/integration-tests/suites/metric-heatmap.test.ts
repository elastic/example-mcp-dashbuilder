/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SAMPLE_METRIC_ARGS, SAMPLE_HEATMAP_ARGS } from '../__fixtures__/dashboard-factory.js';
import { expectSuccess, expectTextContent } from '../helpers/mcp-assertions.js';
import { createTestServer } from '../setup/create-test-server.js';
import type { MCPTestServer } from '../setup/test-server-interface.js';

describe('Metric and heatmap tools', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = createTestServer();
    await server.start();
    await server.callTool('create_dashboard', { title: 'Metric Heatmap Test' });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('create_metric', () => {
    it('should create a metric visualization', async () => {
      const result = await server.callTool('create_metric', SAMPLE_METRIC_ARGS);
      const text = expectSuccess(result);
      expect(text).toContain('Total Revenue');
    });

    it('should create a metric with subtitle and color', async () => {
      const result = await server.callTool('create_metric', {
        ...SAMPLE_METRIC_ARGS,
        subtitle: 'Last 30 days',
        color: '#E91E63',
      });
      const text = expectSuccess(result);
      expect(text).toContain('Total Revenue');
    });

    it('should handle invalid ES|QL gracefully', async () => {
      const result = await server.callTool('create_metric', {
        ...SAMPLE_METRIC_ARGS,
        esqlQuery: 'INVALID QUERY',
      });
      const text = expectTextContent(result);
      expect(text.toLowerCase()).toMatch(/error|failed|invalid|parse/);
    });
  });

  describe('create_heatmap', () => {
    it('should create a heatmap visualization', async () => {
      const result = await server.callTool('create_heatmap', SAMPLE_HEATMAP_ARGS);
      const text = expectSuccess(result);
      expect(text).toContain('Category by Gender');
    });

    it('should handle invalid ES|QL gracefully', async () => {
      const result = await server.callTool('create_heatmap', {
        ...SAMPLE_HEATMAP_ARGS,
        esqlQuery: 'INVALID QUERY',
      });
      const text = expectTextContent(result);
      expect(text.toLowerCase()).toMatch(/error|failed|invalid|parse/);
    });
  });
});

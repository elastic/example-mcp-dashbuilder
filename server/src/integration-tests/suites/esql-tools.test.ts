/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TEST_INDEX } from '../setup/seed-data.js';
import { expectSuccess, expectTextContent } from '../helpers/mcp-assertions.js';
import { createTestServer } from '../setup/create-test-server.js';
import type { MCPTestServer } from '../setup/test-server-interface.js';

describe('ES|QL tools', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = createTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('list_indices', () => {
    it('should return the seeded test index', async () => {
      const result = await server.callTool('list_indices');
      const text = expectSuccess(result);
      expect(text).toContain(TEST_INDEX);
    });
  });

  describe('run_esql', () => {
    it('should execute a valid query and return results', async () => {
      const result = await server.callTool('run_esql', {
        query: `FROM ${TEST_INDEX} | STATS count = COUNT(*)`,
      });
      const text = expectSuccess(result);
      // Should contain the count of 20 seeded documents
      expect(text).toContain('20');
    });

    it('should return tabular data for aggregations', async () => {
      const result = await server.callTool('run_esql', {
        query: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category | SORT category`,
      });
      const text = expectSuccess(result);
      // Should contain category names from seed data
      expect(text).toContain("Men's Clothing");
    });

    it('should handle queries with LIMIT', async () => {
      const result = await server.callTool('run_esql', {
        query: `FROM ${TEST_INDEX} | LIMIT 5`,
      });
      const text = expectSuccess(result);
      // Should return data (field names from seed data)
      expect(text).toContain('customer_first_name');
    });

    it('should return an error for invalid queries', async () => {
      const result = await server.callTool('run_esql', {
        query: 'INVALID QUERY SYNTAX',
      });
      const text = expectTextContent(result);
      // Should contain error information rather than crashing
      expect(text.toLowerCase()).toMatch(/error|failed|invalid|parse/);
    });

    it('should return an error for non-existent indices', async () => {
      const result = await server.callTool('run_esql', {
        query: 'FROM nonexistent_index_xyz_999 | STATS count = COUNT(*)',
      });
      const text = expectTextContent(result);
      expect(text.toLowerCase()).toMatch(/error|unknown|not found|no such/);
    });
  });
});

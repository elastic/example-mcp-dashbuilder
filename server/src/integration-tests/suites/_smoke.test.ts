/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { TEST_INDEX } from '../setup/seed-data.js';
import { MCPTestServer } from '../setup/test-server.js';

function authHeader(): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${process.env.ES_USERNAME}:${process.env.ES_PASSWORD}`).toString('base64')}`,
  };
}

describe('Smoke test: containers and seed data', () => {
  it('should have ES_NODE set by global setup', () => {
    expect(process.env.ES_NODE).toBeDefined();
    expect(process.env.ES_NODE).toMatch(/^http/);
  });

  it('should have KIBANA_URL set by global setup', () => {
    expect(process.env.KIBANA_URL).toBeDefined();
    expect(process.env.KIBANA_URL).toMatch(/^http/);
  });

  it('should have seeded test data in Elasticsearch', async () => {
    const res = await fetch(`${process.env.ES_NODE}/${TEST_INDEX}/_count`, {
      headers: authHeader(),
    });
    const body = await res.json();
    expect(body.count).toBe(20);
  });

  it('should have correct field mappings', async () => {
    const res = await fetch(`${process.env.ES_NODE}/${TEST_INDEX}/_mapping`, {
      headers: authHeader(),
    });
    const body = await res.json();
    const props = body[TEST_INDEX].mappings.properties;
    expect(props.order_date.type).toBe('date');
    expect(props.category.type).toBe('keyword');
    expect(props.taxful_total_price.type).toBe('double');
    expect(props.geoip.properties.location.type).toBe('geo_point');
  });

  it('Kibana should be reachable', async () => {
    const res = await fetch(`${process.env.KIBANA_URL}/api/status`, { headers: authHeader() });
    expect(res.status).toBe(200);
  });
});

describe('Smoke test: MCPTestServer harness', () => {
  let server: MCPTestServer;

  beforeEach(async () => {
    server = new MCPTestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should connect and list tools', async () => {
    const result = await server.listTools();
    expect(result.tools.length).toBeGreaterThan(0);
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('run_esql');
    expect(toolNames).toContain('list_indices');
    expect(toolNames).toContain('create_chart');
  });

  it('should list resources', async () => {
    const result = await server.listResources();
    expect(result.resources.length).toBeGreaterThan(0);
    const uris = result.resources.map((r) => r.uri);
    expect(uris).toContain('dataviz://guidelines');
    expect(uris).toContain('esql://reference');
  });
});

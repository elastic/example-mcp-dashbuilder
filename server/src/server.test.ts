/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './server.js';

describe('createServer', () => {
  async function connectClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.1.0' });

    await Promise.all([client.connect(clientTransport), server.server.connect(serverTransport)]);

    return client;
  }

  it('returns an McpServer instance with the expected name', async () => {
    const client = await connectClient();
    const info = client.getServerVersion();
    expect(info?.name).toBe('example-mcp-dashbuilder');
  });

  it('has expected tools registered', async () => {
    const client = await connectClient();
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);

    const expectedTools = [
      'run_esql',
      'list_indices',
      'create_chart',
      'create_metric',
      'create_heatmap',
      'create_dashboard',
      'export_to_kibana',
      'import_from_kibana',
      'view_dashboard',
      'export_queries',
      'export_chart_image',
    ];

    for (const name of expectedTools) {
      expect(toolNames).toContain(name);
    }
  });

  it('has expected resources registered', async () => {
    const client = await connectClient();
    const result = await client.listResources();
    const resourceNames = result.resources.map((r) => r.name);

    expect(resourceNames).toContain('dataviz-guidelines');
    expect(resourceNames).toContain('esql-reference');
    expect(resourceNames).toContain('analysis-guidelines');
  });
});

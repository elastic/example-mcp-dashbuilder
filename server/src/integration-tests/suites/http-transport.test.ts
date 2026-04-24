/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'http';
import { createApp } from '../../app.js';

describe('HTTP transport', () => {
  let httpServer: Server | undefined;

  function startServer(): Promise<string> {
    return new Promise((resolve) => {
      const app = createApp();
      httpServer = app.listen(0, () => {
        const address = httpServer!.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        resolve(`http://localhost:${port}`);
      });
    });
  }

  afterEach(() => {
    return new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
        httpServer = undefined;
      } else {
        resolve();
      }
    });
  });

  it('POST /mcp with initialize request returns valid JSON-RPC response', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(200);

    const text = await response.text();
    const jsonLines = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6));

    expect(jsonLines.length).toBeGreaterThan(0);

    const body = JSON.parse(jsonLines[0]) as Record<string, unknown>;
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: {
          name: 'example-mcp-dashbuilder',
        },
        capabilities: expect.any(Object),
      },
    });
  });

  it('GET /mcp returns 405', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/mcp`);
    expect(response.status).toBe(405);
  });

  it('DELETE /mcp returns 405', async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/mcp`, { method: 'DELETE' });
    expect(response.status).toBe(405);
  });
});

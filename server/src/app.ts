/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { createServer } from './server.js';

export function createApp(): ReturnType<typeof createMcpExpressApp> {
  const app = createMcpExpressApp();

  // Each session gets its own server + transport pair so in-memory
  // state (dashboards) persists across requests within a session.
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const lastActivity = new Map<string, number>();

  // Close and remove sessions idle for longer than the TTL.
  const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, timestamp] of lastActivity) {
      if (now - timestamp > SESSION_TTL_MS) {
        const transport = transports.get(id);
        if (transport) {
          transport.close().catch(() => {});
        }
        transports.delete(id);
        lastActivity.delete(id);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweepInterval.unref();

  function touchSession(id: string): void {
    lastActivity.set(id, Date.now());
  }

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId);
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport);
            touchSession(id);
          },
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) {
            transports.delete(id);
            lastActivity.delete(id);
          }
        };

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
    } catch (err) {
      console.error('MCP POST /mcp error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId);
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.writeHead(405).end(JSON.stringify({ error: 'Use POST for MCP requests' }));
    } catch (err) {
      console.error('MCP GET /mcp error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.delete('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId);
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.status(404).end(JSON.stringify({ error: 'Session not found' }));
    } catch (err) {
      console.error('MCP DELETE /mcp error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  return app;
}

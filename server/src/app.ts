/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { createServer } from './server.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/mcp', async (_req, res) => {
    res.writeHead(405).end(JSON.stringify({ error: 'Use POST for MCP requests' }));
  });

  app.delete('/mcp', async (_req, res) => {
    res
      .writeHead(405)
      .end(JSON.stringify({ error: 'Session management not supported in stateless mode' }));
  });

  return app;
}

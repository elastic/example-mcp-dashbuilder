/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file if it exists (before any other imports that read env vars)
const __root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = resolve(__root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApp, DEFAULT_HOST } from './app.js';
import { createServer } from './server.js';
import { tryListen, parseHttpFlag } from './http-server.js';

const DEFAULT_PORT = 3001;

const isHttp = parseHttpFlag(process.argv);

// Clean up on shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (!isHttp) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // HTTP mode: streamable HTTP transport with session management
  const host = process.env.HOST || DEFAULT_HOST;
  const app = createApp(host);
  const explicitPort = !!process.env.PORT;
  const requestedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

  let httpServer;
  try {
    httpServer = await tryListen(app, requestedPort, host, { explicitPort });
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address !== null ? address.port : requestedPort;
  console.log(`Elastic Dashbuilder MCP App server running on http://${host}:${boundPort}/mcp`);
}

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

import { createServer as createNetServer } from 'net';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApp } from './app.js';
import { createServer } from './server.js';

const DEFAULT_PORT = 3001;
const PORT_RANGE_SIZE = 99;

function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createNetServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, host, () => srv.close(() => resolve(true)));
  });
}

async function findAvailablePort(start: number, host: string): Promise<number> {
  for (let port = start; port <= start + PORT_RANGE_SIZE; port++) {
    if (await isPortAvailable(port, host)) return port;
  }
  throw new Error(
    `No available port found in range ${start}–${start + PORT_RANGE_SIZE}. Set PORT to specify one explicitly.`
  );
}

const isHttp = process.argv.includes('--http');

// Clean up on shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (!isHttp) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  // HTTP mode: streamable HTTP transport with session management
  const app = createApp();

  const host = process.env.HOST || '127.0.0.1';
  const explicitPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const port = explicitPort ?? (await findAvailablePort(DEFAULT_PORT, host));

  const httpServer = app.listen(port, host, () => {
    const address = httpServer.address();
    const boundPort = typeof address === 'object' && address !== null ? address.port : port;
    console.log(`Elastic Dashbuilder MCP App server running on http://${host}:${boundPort}/mcp`);
  });
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Error: Port ${port} is already in use. Set a different port with the PORT environment variable.`
      );
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });
}

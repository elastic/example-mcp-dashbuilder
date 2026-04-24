#!/usr/bin/env node
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
import { createServer } from './server.js';
import { createApp } from './app.js';

const isStdio = process.argv.includes('--stdio');

// Clean up on shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

if (isStdio) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  const app = createApp();

  const port = parseInt(process.env.PORT || '3001', 10);
  const httpServer = app.listen(port, () => {
    console.log(`Elastic Dashbuilder MCP App server running on http://localhost:${port}/mcp`);
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

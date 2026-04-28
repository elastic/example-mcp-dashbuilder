/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * MCP Test Server Harness
 *
 * Spawns the MCP server as a child process via StdioClientTransport,
 * providing an isolated in-memory dashboard store per instance.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { MCPTestServerBase } from './test-server-base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_CWD = resolve(__dirname, '..', '..', '..');

export class MCPTestServerStdio extends MCPTestServerBase {
  private transport: StdioClientTransport | null = null;

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started. Call stop() first.');
    }

    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: SERVER_CWD,
      env: {
        ...process.env,
        // Forward container URLs set by global setup
        ES_NODE: process.env.ES_NODE!,
        KIBANA_URL: process.env.KIBANA_URL!,
        // Isolate dashboard storage to a temp dir (never touches user dashboards)
        DASHBOARDS_DIR: this.dashboardsDir,
        // Forward credentials set by global setup (security enabled in containers)
        ES_USERNAME: process.env.ES_USERNAME!,
        ES_PASSWORD: process.env.ES_PASSWORD!,
        // Prevent the server from reading a local .env that could override test URLs
        NODE_ENV: 'test',
      },
    });

    await this.connectClient(this.transport);
  }

  async stop(): Promise<void> {
    await this.closeClient();
    this.transport = null;
  }
}

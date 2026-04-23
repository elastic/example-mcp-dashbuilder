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

import { mkdtempSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_CWD = resolve(__dirname, '..', '..', '..');

export class MCPTestServer {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private timeout: number;
  private dashboardsDir: string;

  constructor(opts: { timeout?: number } = {}) {
    this.timeout = opts.timeout ?? 30_000;
    // Each instance gets its own temp dir — tests never touch user dashboards
    this.dashboardsDir = mkdtempSync(resolve(tmpdir(), 'mcp-test-dashboards-'));
  }

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

    this.client = new Client({
      name: 'integration-test-client',
      version: '1.0.0',
    });

    const connectPromise = this.client.connect(this.transport);
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MCP client connection timeout')), this.timeout);
    });
    try {
      await Promise.race([connectPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors — process may have already exited
      }
      this.client = null;
    }
    this.transport = null;
  }

  // ── Tool helpers ──────────────────────────────────────────────

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
    return this.getClient().callTool({ name, arguments: args }) as Promise<CallToolResult>;
  }

  async listTools(): Promise<ListToolsResult> {
    return this.getClient().listTools();
  }

  // ── Resource helpers ──────────────────────────────────────────

  async listResources(): Promise<ListResourcesResult> {
    return this.getClient().listResources();
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    return this.getClient().readResource({ uri });
  }

  // ── Internal ──────────────────────────────────────────────────

  private getClient(): Client {
    if (!this.client) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.client;
  }
}

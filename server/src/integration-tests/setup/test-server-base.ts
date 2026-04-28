/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { mkdtempSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { MCPTestServer } from './test-server-interface.js';

export abstract class MCPTestServerBase implements MCPTestServer {
  protected client: Client | null = null;
  protected timeout: number;
  protected dashboardsDir: string;

  constructor(opts: { timeout?: number } = {}) {
    this.timeout = opts.timeout ?? 30_000;
    this.dashboardsDir = mkdtempSync(resolve(tmpdir(), 'mcp-test-dashboards-'));
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  protected async connectClient(transport: Transport): Promise<void> {
    this.client = new Client({
      name: 'integration-test-client',
      version: '1.0.0',
    });

    const connectPromise = this.client.connect(transport);
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

  protected async closeClient(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close errors — process may have already exited
      }
      this.client = null;
    }
  }

  protected getClient(): Client {
    if (!this.client) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.client;
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
}

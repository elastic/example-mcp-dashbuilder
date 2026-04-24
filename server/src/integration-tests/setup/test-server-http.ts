/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * MCP HTTP Test Server Harness
 *
 * Starts the MCP server in-process via StreamableHTTP transport,
 * providing an isolated in-memory dashboard store per instance.
 */

import { mkdtempSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import type { Server } from 'http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';

import { createApp } from '../../app.js';

export class MCPHttpTestServer {
  private client: Client | null = null;
  private httpServer: Server | null = null;
  private timeout: number;
  private dashboardsDir: string;
  private previousDashboardsDir: string | undefined;
  private baseUrl: string | null = null;

  constructor(opts: { timeout?: number } = {}) {
    this.timeout = opts.timeout ?? 30_000;
    this.dashboardsDir = mkdtempSync(resolve(tmpdir(), 'mcp-test-dashboards-'));
  }

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started. Call stop() first.');
    }

    // Set DASHBOARDS_DIR for in-process server, preserving previous value for restore
    this.previousDashboardsDir = process.env.DASHBOARDS_DIR;
    process.env.DASHBOARDS_DIR = this.dashboardsDir;

    const app = createApp();
    this.httpServer = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = this.httpServer.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    this.baseUrl = `http://localhost:${port}`;
    const url = new URL(`${this.baseUrl}/mcp`);

    const transport = new StreamableHTTPClientTransport(url);
    this.client = new Client({
      name: 'integration-test-client',
      version: '1.0.0',
    });

    const connectPromise = this.client.connect(transport);
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('MCP HTTP client connection timeout')),
        this.timeout
      );
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
        // Ignore close errors
      }
      this.client = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }

    // Restore previous DASHBOARDS_DIR
    if (this.previousDashboardsDir !== undefined) {
      process.env.DASHBOARDS_DIR = this.previousDashboardsDir;
    } else {
      delete process.env.DASHBOARDS_DIR;
    }
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

  getBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.baseUrl;
  }

  // ── Internal ──────────────────────────────────────────────────

  private getClient(): Client {
    if (!this.client) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.client;
  }
}

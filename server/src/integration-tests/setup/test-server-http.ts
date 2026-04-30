/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * MCP HTTP Test Server Harness
 *
 * Spawns the MCP server as a child process in HTTP mode, then connects
 * via StreamableHTTPClientTransport. Each instance gets its own temp
 * dashboard directory for isolation — same as MCPTestServerStdio.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { MCPTestServerBase } from './test-server-base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_CWD = resolve(__dirname, '..', '..', '..');

export class MCPTestServerHttp extends MCPTestServerBase {
  private childProcess: ChildProcess | null = null;
  private baseUrl: string | null = null;

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started. Call start() first.');
    }

    // Spawn server as child process in HTTP mode (--http flag).
    // Use port 0 via PORT env var — the server prints the actual port to stdout.
    const child = spawn('node', ['--import', 'tsx', 'src/index.ts', '--http'], {
      cwd: SERVER_CWD,
      env: {
        ...process.env,
        ES_NODE: process.env.ES_NODE!,
        KIBANA_URL: process.env.KIBANA_URL!,
        ES_USERNAME: process.env.ES_USERNAME!,
        ES_PASSWORD: process.env.ES_PASSWORD!,
        DASHBOARDS_DIR: this.dashboardsDir,
        NODE_ENV: 'test',
        PORT: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.childProcess = child;

    // Wait for the server to print its URL with the actual port
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('HTTP server startup timeout'));
      }, this.timeout);

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.stdout?.on('data', (chunk: Buffer) => {
        const output = chunk.toString();
        const match = output.match(/running on (http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited with code ${code}. stderr: ${stderr}`));
      });
    });

    this.baseUrl = url.replace(/\/mcp$/, '');

    const transport = new StreamableHTTPClientTransport(new URL(url));
    await this.connectClient(transport);
  }

  async stop(): Promise<void> {
    await this.closeClient();

    if (this.childProcess) {
      this.childProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.childProcess?.kill('SIGKILL');
          resolve();
        }, 5000);
        this.childProcess!.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.childProcess = null;
    }
  }

  getBaseUrl(): string {
    if (!this.baseUrl) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.baseUrl;
  }
}

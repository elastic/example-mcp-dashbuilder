/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type {
  CallToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Shared contract for MCP test server harnesses (stdio and HTTP).
 */
export interface TestServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
  listTools(): Promise<ListToolsResult>;
  listResources(): Promise<ListResourcesResult>;
  readResource(uri: string): Promise<ReadResourceResult>;
}

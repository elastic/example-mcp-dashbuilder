/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { MCPTestServer } from './test-server.js';
import { MCPHttpTestServer } from './test-server-http.js';

export type TransportType = 'stdio' | 'http';

export function createTestServer(transport?: TransportType): MCPTestServer | MCPHttpTestServer {
  const resolved = transport ?? (process.env.TRANSPORT as TransportType) ?? 'stdio';
  if (resolved === 'http') return new MCPHttpTestServer();
  return new MCPTestServer();
}

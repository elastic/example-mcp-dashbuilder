/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { MCPTestServerStdio } from './test-server-stdio.js';
import { MCPTestServerHttp } from './test-server-http.js';
import type { TestServer } from './test-server-interface.js';

export type TransportType = 'stdio' | 'http';

export function createTestServer(transport?: TransportType): TestServer {
  const resolved = transport ?? (process.env.TRANSPORT as TransportType) ?? 'stdio';
  if (resolved === 'http') return new MCPTestServerHttp();
  return new MCPTestServerStdio();
}

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { createContext, useContext } from 'react';
import type { App } from '@modelcontextprotocol/ext-apps';

const McpAppContext = createContext<App | null>(null);

export function McpAppProvider({ app, children }: { app: App; children: React.ReactNode }) {
  return <McpAppContext.Provider value={app}>{children}</McpAppContext.Provider>;
}

export function useMcpApp(): App {
  const app = useContext(McpAppContext);
  if (!app) throw new Error('useMcpApp must be used within McpAppProvider');
  return app;
}

/** Returns the MCP App instance if available, or null if not inside a provider. */
export function useMcpAppOptional(): App | null {
  return useContext(McpAppContext);
}

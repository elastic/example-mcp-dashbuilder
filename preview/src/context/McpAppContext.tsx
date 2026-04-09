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

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { EuiProvider } from '@elastic/eui';
import { ExportView } from './components/ExportView';
import type { PanelConfig } from './types';

export interface ExportBootstrap {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
  colorMode?: 'light' | 'dark';
}

function readExportData(): ExportBootstrap | undefined {
  return (window as unknown as { __EXPORT_DATA__?: ExportBootstrap }).__EXPORT_DATA__;
}

/**
 * Try to render in Puppeteer export mode.
 * Returns true if export data was found and rendering was initiated,
 * false if the app should proceed with normal MCP mode.
 */
export function tryExportMode(reactRoot: { render: (node: React.ReactNode) => void }): boolean {
  const exportData = readExportData();
  if (exportData) {
    reactRoot.render(
      <EuiProvider colorMode={exportData.colorMode ?? 'dark'}>
        <ExportView exportData={exportData} />
      </EuiProvider>
    );
    return true;
  }
  return false;
}

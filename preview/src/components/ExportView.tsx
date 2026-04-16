/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useEffect, useMemo } from 'react';
import { ChartPanel } from './ChartPanel';
import { buildRenderableConfig } from '../utils/build-renderable-config';
import type { PanelConfig } from '../types';

interface ExportData {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/**
 * Static chart renderer for Puppeteer export.
 * Renders the chart with pre-loaded data and signals readiness
 * via window.__EXPORT_READY__ for the screenshot.
 */
export function ExportView({ exportData }: { exportData: ExportData }) {
  const { chart, data, trendData } = exportData;

  const renderableConfig = useMemo(
    () => buildRenderableConfig(chart, data, trendData),
    [chart, data, trendData]
  );

  const height = chart.chartType === 'metric' ? 200 : 350;

  // Signal to Puppeteer that the chart has rendered
  useEffect(() => {
    requestAnimationFrame(() => {
      (window as unknown as { __EXPORT_READY__: boolean }).__EXPORT_READY__ = true;
    });
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height,
        padding: 16,
        fontFamily: "'Elastic UI Numeric', Inter, sans-serif",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{chart.title}</div>
      <div style={{ height: height - 50 }}>
        <ChartPanel config={renderableConfig} />
      </div>
    </div>
  );
}

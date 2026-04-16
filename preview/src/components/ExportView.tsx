/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useEffect, useMemo } from 'react';
import { ChartPanel } from './ChartPanel';
import type { PanelConfig, RenderablePanelConfig } from '../types';

interface ExportData {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/**
 * Static chart renderer for Puppeteer export.
 * Detects window.__EXPORT_DATA__, renders the chart with pre-loaded data,
 * and signals readiness via window.__EXPORT_READY__.
 */
export function ExportView({ exportData }: { exportData: ExportData }) {
  const { chart, data, trendData } = exportData;

  const renderableConfig: RenderablePanelConfig = useMemo(() => {
    const base = { ...chart, data };

    if (chart.chartType === 'metric' && trendData && trendData.length > 0) {
      return {
        ...base,
        trend: {
          data: trendData.map((row) => ({
            x: new Date(row[chart.trendXField!] as string).getTime(),
            y: Number(row[chart.trendYField!]) || 0,
          })),
          shape: chart.trendShape || 'area',
        },
      };
    }

    return base;
  }, [chart, data, trendData]);

  const height = chart.chartType === 'metric' ? 200 : 350;

  // Signal to Puppeteer that the chart has rendered
  useEffect(() => {
    requestAnimationFrame(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__EXPORT_READY__ = true;
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

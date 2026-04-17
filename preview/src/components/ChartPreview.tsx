/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { ChartPanel } from './ChartPanel';
import { PanelChrome } from './PanelChrome';
import { useBuildRenderableConfig } from '../hooks/useBuildRenderableConfig';
import type { PanelConfig } from '../types';

interface ChartPreviewData {
  mode: 'chart-preview';
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/**
 * Renders a single chart with pre-loaded data.
 * Used for inline chart previews after create_chart/create_metric/create_heatmap.
 */
export function ChartPreview({ preview }: { preview: ChartPreviewData }) {
  const { chart, data, trendData } = preview;

  const renderableConfig = useBuildRenderableConfig(chart, data, trendData);

  const height = chart.chartType === 'metric' ? 200 : 350;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 600,
        height,
        padding: 16,
        fontFamily: "'Elastic UI Numeric', Inter, sans-serif",
      }}
    >
      <PanelChrome title={chart.title}>
        <ChartPanel config={renderableConfig} />
      </PanelChrome>
    </div>
  );
}

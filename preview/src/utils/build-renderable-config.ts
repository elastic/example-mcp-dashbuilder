/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PanelConfig, RenderablePanelConfig } from '../types';

/**
 * Build a renderable chart config from raw panel config + query data.
 * Handles metric sparkline trend transformation.
 */
export function buildRenderableConfig(
  chart: PanelConfig,
  data: Record<string, unknown>[],
  trendData?: Record<string, unknown>[]
): RenderablePanelConfig {
  if (chart.chartType === 'metric' && trendData && trendData.length > 0) {
    return {
      ...chart,
      data,
      trend: {
        data: trendData.map((row) => ({
          x: new Date(row[chart.trendXField!] as string).getTime(),
          y: Number(row[chart.trendYField!]) || 0,
        })),
        shape: chart.trendShape || 'area',
      },
    };
  }

  return { ...chart, data };
}

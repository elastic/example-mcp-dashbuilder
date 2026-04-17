/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { EuiCallOut } from '@elastic/eui';
import { PanelChrome } from './PanelChrome';
import { ChartPanel } from './ChartPanel';
import { useEsqlQuery } from '../hooks/useEsqlQuery';
import { useTimeRange } from '../context/TimeRangeContext';
import { useBuildRenderableConfig } from '../hooks/useBuildRenderableConfig';
import type { PanelConfig } from '../types';

export function DashboardPanel({ config }: { config: PanelConfig }) {
  const { timeRange } = useTimeRange();
  const { data, isLoading, error } = useEsqlQuery(config.esqlQuery, timeRange, config.timeField);

  // Fetch trend data for metrics with a trend query
  const trendQuery = config.chartType === 'metric' ? config.trendEsqlQuery : undefined;
  const { data: trendData } = useEsqlQuery(trendQuery, timeRange, config.timeField);

  const liveConfig = useBuildRenderableConfig(config, data, trendData);

  return (
    <PanelChrome title={config.title} isLoading={isLoading}>
      {error ? (
        <EuiCallOut color="danger" iconType="warning" size="s" title="Query error">
          <p>{error}</p>
        </EuiCallOut>
      ) : (
        <ChartPanel config={liveConfig} />
      )}
    </PanelChrome>
  );
}
